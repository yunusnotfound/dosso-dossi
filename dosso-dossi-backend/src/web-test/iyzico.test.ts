import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWebSandboxPaymentConfiguration } from '../config/web.js';
import {
  getPaymentAvailability, initializeSandboxPayment, retrieveSandboxPayment, IyzipayError,
  iyzicoAuthorization, iyzicoMoneyMinor, sandboxPaymentPageUrl, type SandboxPaymentInput,
} from '../features/web/iyzico.service.js';

const environment = { NODE_ENV: 'test', WEB_PAYMENT_MODE: 'sandbox', WEB_IYZICO_API_KEY: 'sandbox-unit-api-not-real',
  WEB_IYZICO_SECRET_KEY: 'sandbox-unit-secret-not-real', WEB_IYZICO_CALLBACK_URL: 'https://api.coffee.example.com/web/payments/iyzico/callback',
  WEB_PUBLIC_URL: 'http://127.0.0.1:4000' };
const token = '00000000-0000-4000-8000-000000000001';
const input: SandboxPaymentInput = {
  orderId: 'order_1', orderNumber: 'DD-1234', conversationId: 'attempt_1', totalMinor: 43400, subtotalMinor: 39150, shippingFeeMinor: 4250,
  customer: { id: 'customer_1', name: 'Yerel Kontrol', email: 'customer@example.test' },
  address: { recipientName: 'Yerel Kontrol', phone: '+905550000001', provinceCode: '34', district: 'Kadıköy', neighborhood: 'Test Mahallesi',
    addressLine: 'Yerel örnek adres No 1', postalCode: '34710', country: 'TR' },
  lines: [{ id: 'line_1', nameTr: 'Kahve / 250 g / Çekirdek', quantity: 2, lineTotalMinor: 25100 },
    { id: 'line_2', nameTr: 'Kahve / 250 g / Filtre', quantity: 1, lineTotalMinor: 14050 }], locale: 'tr', ip: '127.0.0.1',
};
const expected = { token, conversationId: input.conversationId, orderId: input.orderId, totalMinor: input.totalMinor };
function setup() { for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value); }
const signature = (values: string[]) => createHmac('sha256', environment.WEB_IYZICO_SECRET_KEY).update(values.join(':')).digest('hex');
const initialized = (overrides: Record<string, unknown> = {}) => ({ status: 'success', conversationId: input.conversationId,
  token, paymentPageUrl: `https://sandbox-cpp.iyzipay.com?token=${token}&lang=tr`, tokenExpireTime: 1800,
  checkoutFormContent: '<script>private provider HTML</script>', signature: signature([input.conversationId, token]), ...overrides });
function retrieved(overrides: Record<string, unknown> = {}) {
  const data = { status: 'success', paymentStatus: 'SUCCESS', paymentId: 'payment_1', currency: 'TRY', basketId: input.orderId,
    conversationId: input.conversationId, token, price: '434.000', paidPrice: 434, fraudStatus: 1, ...overrides };
  return { ...data, signature: signature([data.paymentStatus, data.paymentId, data.currency, data.basketId, data.conversationId,
    String(data.paidPrice).replace(/\.0+$/, ''), String(data.price).replace(/\.0+$/, ''), data.token]) };
}
function response(data: object, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('web iyzico sandbox configuration isolation', () => {
  it('has no implicit keys, mobile fallback, simulation or live provider', async () => {
    vi.stubEnv('WEB_IYZICO_API_KEY', ''); vi.stubEnv('WEB_IYZICO_SECRET_KEY', '');
    vi.stubEnv('PAYMENT_PROVIDER', 'dev');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(getPaymentAvailability()).toEqual({ provider: 'IYZICO', mode: 'sandbox', configured: false });
    await expect(initializeSandboxPayment(input)).rejects.toMatchObject({ code: 'NOT_CONFIGURED', ambiguous: false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('exposes only availability, never credentials or callback configuration', () => {
    expect(getPaymentAvailability(environment)).toEqual({ provider: 'IYZICO', mode: 'sandbox', configured: true });
    expect(readWebSandboxPaymentConfiguration(environment)?.callbackUrl).toBe(environment.WEB_IYZICO_CALLBACK_URL);
  });
  it.each([
    { WEB_PAYMENT_MODE: 'live' }, { WEB_IYZICO_API_KEY: 'production-not-allowed' },
    { WEB_IYZICO_SECRET_KEY: 'sandbox-bad\nInjected: header' }, { WEB_IYZICO_CALLBACK_URL: '' },
    { WEB_IYZICO_CALLBACK_URL: 'http://api.example.com/web/payments/iyzico/callback' },
    { WEB_IYZICO_CALLBACK_URL: 'https://127.0.0.1/web/payments/iyzico/callback' },
    { WEB_IYZICO_CALLBACK_URL: 'https://backend.local/web/payments/iyzico/callback' },
    { WEB_IYZICO_CALLBACK_URL: 'https://api.example.com/other' },
    { WEB_IYZICO_CALLBACK_URL: 'https://api.example.com/web/payments/iyzico/callback?return=https://evil.example.com' },
    { WEB_IYZICO_CALLBACK_URL: 'https://user:secret@api.example.com/web/payments/iyzico/callback' },
    { WEB_PUBLIC_URL: 'https://coffee.example.com/return' },
    { WEB_PUBLIC_URL: 'http://coffee.example.com' },
    { NODE_ENV: 'production', WEB_PUBLIC_URL: 'http://127.0.0.1:4000' },
  ])('fails closed for unsafe or incomplete configuration %j', (override) => {
    expect(getPaymentAvailability({ ...environment, ...override }).configured).toBe(false);
  });
});

describe('payment protocol, signed payload and exact money', () => {
  it('implements the documented IYZWSv2 header over the exact request bytes', () => {
    const body = '{"price":"10.50","name":"Türkçe"}';
    const auth = iyzicoAuthorization('/payment/test', body, 'test-api', 'test-secret', '123456789');
    expect(auth.startsWith('IYZWSv2 ')).toBe(true);
    expect(Buffer.from(auth.slice(8), 'base64').toString()).toBe(`apiKey:test-api&randomKey:123456789&signature:${createHmac('sha256', 'test-secret').update('123456789/payment/test' + body).digest('hex')}`);
    expect(iyzicoAuthorization('/payment/test', body + ' ', 'test-api', 'test-secret', '123456789')).not.toBe(auth);
  });
  it.each([['10', 1000], ['10.50', 1050], ['10.51000', 1051], [0.29, 29], ['0.01', 1], ['0', 0]])('parses %s to %s kuruş without rounding', (value, minor) => {
    expect(iyzicoMoneyMinor(value)).toBe(minor);
  });
  it.each(['10.001', '1e2', '-1', '1,50', '01.50', 'Infinity', NaN, null, '', 21_474_836.48])('rejects invalid money %s', (value) => {
    expect(() => iyzicoMoneyMinor(value)).toThrow(IyzipayError);
  });
  it.each([
    'http://sandbox-cpp.iyzipay.com', 'https://api.iyzipay.com', 'https://sandbox-cpp.iyzipay.com.evil.example.com',
    'https://sandbox-cpp.iyzipay.com@evil.example.com', 'https://user@ sandbox-cpp.iyzipay.com',
    'https://sandbox-cpp.iyzipay.com:8443', 'https://sandbox-cpp.iyzipay.com/other', 'https://127.0.0.1',
  ])('rejects payment redirect destination %s', (url) => {
    expect(() => sandboxPaymentPageUrl(`${url}?token=${token}`, token)).toThrow(IyzipayError);
  });
  it('rejects changed, duplicated or redirect-bearing token queries', () => {
    for (const suffix of ['?token=different', `?token=${token}&token=${token}`, `?token=${token}&returnUrl=https://evil.example.com`, `?token=${token}#private`]) {
      expect(() => sandboxPaymentPageUrl(`https://sandbox-cpp.iyzipay.com${suffix}`, token)).toThrow(IyzipayError);
    }
  });
});

describe('sandbox initialize transport', () => {
  it('sends server totals and shipping as a basket line, signs exact body and discards provider HTML', async () => {
    setup(); const fetch = vi.fn().mockResolvedValue(response(initialized())); vi.stubGlobal('fetch', fetch);
    const result = await initializeSandboxPayment(input);
    expect(result.token).toBe(token); expect(result.paymentPageUrl).toContain('sandbox-cpp.iyzipay.com');
    expect(result.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(900_000);
    expect(Object.keys(result).sort()).toEqual(['expiresAt', 'paymentPageUrl', 'token']);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe('https://sandbox-api.iyzipay.com/payment/iyzipos/checkoutform/initialize/auth/ecom');
    expect(options).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ price: '434.00', paidPrice: '434.00', currency: 'TRY', basketId: input.orderId,
      callbackUrl: environment.WEB_IYZICO_CALLBACK_URL, enabledInstallments: [1], buyer: { name: 'Yerel', surname: 'Kontrol', identityNumber: '74300864791', city: 'İstanbul' } });
    expect(body.basketItems.map((line: {price: string}) => line.price)).toEqual(['251.00', '140.50', '42.50']);
    expect(body.basketItems[2]).toMatchObject({ id: 'shipping_order_1', itemType: 'VIRTUAL' });
    expect(options.headers.Authorization).toBe(iyzicoAuthorization(new URL(url).pathname, options.body, environment.WEB_IYZICO_API_KEY,
      environment.WEB_IYZICO_SECRET_KEY, options.headers['x-iyzi-rnd']));
    expect(body).not.toHaveProperty('paymentCard');
  });
  it('blocks inconsistent server snapshots before any request', async () => {
    setup(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const data of [{ ...input, totalMinor: 1 }, { ...input, subtotalMinor: 39000 },
      { ...input, address: { ...input.address, country: 'DE' } }, { ...input, callbackUrl: 'https://evil.example.com' }]) {
      await expect(initializeSandboxPayment(data as SandboxPaymentInput)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains complimentary order lines without sending zero-value provider transactions', async () => {
    setup(); const fetch = vi.fn().mockResolvedValue(response(initialized())); vi.stubGlobal('fetch', fetch);
    await initializeSandboxPayment({ ...input, lines: [...input.lines, { id: 'free_sample', nameTr: 'Ücretsiz numune', quantity: 1, lineTotalMinor: 0 }] });
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.basketItems).toHaveLength(3);
    expect(body.basketItems.some((line: { id: string }) => line.id === 'free_sample')).toBe(false);
    expect(body.paidPrice).toBe('434.00');
  });
  it.each([
    { signature: '0'.repeat(64) }, { signature: undefined }, { conversationId: 'another_attempt' },
    { paymentPageUrl: `https://evil.example.com?token=${token}` }, { paymentPageUrl: `https://sandbox-cpp.iyzipay.com?token=different` },
  ])('treats an untrustworthy initialization as ambiguous, never a safe retry %j', async (override) => {
    setup(); const fetch = vi.fn().mockResolvedValue(response(initialized(override))); vi.stubGlobal('fetch', fetch);
    await expect(initializeSandboxPayment(input)).rejects.toMatchObject({ ambiguous: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('recognizes only an explicit correlated provider rejection as safe failure', async () => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 'failure', conversationId: input.conversationId, errorCode: '10001', errorMessage: 'private details' }, 400)));
    await expect(initializeSandboxPayment(input)).rejects.toMatchObject({ code: 'INITIALIZE_REJECTED', ambiguous: false });
  });
  it('never retries timeout/transport errors or exposes their private content', async () => {
    setup(); const fetch = vi.fn().mockRejectedValue(new Error(`Timeout ${token} ${environment.WEB_IYZICO_SECRET_KEY}`)); vi.stubGlobal('fetch', fetch);
    await expect(initializeSandboxPayment(input)).rejects.toEqual(new IyzipayError('AMBIGUOUS'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('bounds streamed responses even without a content-length', async () => {
    setup(); const fetch = vi.fn().mockResolvedValue(new Response('x'.repeat(262_145))); vi.stubGlobal('fetch', fetch);
    await expect(initializeSandboxPayment(input)).rejects.toMatchObject({ code: 'AMBIGUOUS' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('authoritative checkout result verification', () => {
  it('accepts only signed server-retrieved, correlated exact TRY amounts with fraud approval', async () => {
    setup(); const fetch = vi.fn().mockResolvedValue(response(retrieved())); vi.stubGlobal('fetch', fetch);
    expect(await retrieveSandboxPayment(expected)).toEqual({ status: 'SUCCESS', paymentId: 'payment_1',
      conversationId: input.conversationId, basketId: input.orderId, currency: 'TRY', priceMinor: 43400, paidPriceMinor: 43400, fraudStatus: 1 });
    expect(fetch.mock.calls[0]![0]).toBe('https://sandbox-api.iyzipay.com/payment/iyzipos/checkoutform/auth/ecom/detail');
  });
  it.each([0, null, undefined, '1', 2])('does not permit fulfillment for fraud status %s', async (fraudStatus) => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(retrieved({ fraudStatus }))));
    expect((await retrieveSandboxPayment(expected)).status).toBe('PENDING');
  });
  it.each([['100.00', '100', 10000], ['100.10', '100.1', 10010], ['0.10', '0.1', 10]])('normalizes signed prices %s without stripping whole-number zeros', async (price, signedValue, totalMinor) => {
    setup(); const data = { ...retrieved(), price, paidPrice: price,
      signature: signature(['SUCCESS', 'payment_1', 'TRY', input.orderId, input.conversationId, signedValue, signedValue, token]) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(data)));
    expect((await retrieveSandboxPayment({ ...expected, totalMinor })).status).toBe('SUCCESS');
  });
  it('returns verified fraud rejection as failure', async () => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(retrieved({ fraudStatus: -1 }))));
    expect((await retrieveSandboxPayment(expected)).status).toBe('FAILURE');
  });
  it.each([
    { conversationId: 'another_attempt' }, { token: 'another_checkout' }, { basketId: 'another_order' },
    { currency: 'EUR' }, { price: '433.00' }, { paidPrice: '435.00' }, { price: '434.001' },
  ])('rejects signed but mismatched result %j', async (override) => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(retrieved(override))));
    await expect(retrieveSandboxPayment(expected)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', ambiguous: true });
  });
  it.each([undefined, 'bad', '0'.repeat(64)])('rejects missing or forged signature %s', async (invalidSignature) => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...retrieved(), signature: invalidSignature })));
    await expect(retrieveSandboxPayment(expected)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each([{ paymentId: 'payment_2' }, { paymentStatus: 'FAILURE' }, { price: '433' }, { paidPrice: '435' },
    { currency: 'EUR' }, { basketId: 'order_2' }, { conversationId: 'attempt_2' }, { token: 'another_token' }])('rejects each tampered signed field %j', async (override) => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...retrieved(), ...override })));
    await expect(retrieveSandboxPayment(expected)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('does not turn an unsigned failed-query response into a failed payment', async () => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 'failure', errorCode: '10000' })));
    await expect(retrieveSandboxPayment(expected)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', ambiguous: true });
  });
  it('keeps only normalized transaction references and amounts for accounting, discarding card and provider PII', async () => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(retrieved({
      itemTransactions: [{ itemId: 'line_1', paymentTransactionId: 'transaction_1', price: '434', paidPrice: '434', binNumber: 'private' }],
      cardFamily: 'private', lastFourDigits: 'private', buyer: { email: 'private' },
    }))));
    const result = await retrieveSandboxPayment(expected);
    expect(result.itemTransactions).toEqual([{ itemId: 'line_1', paymentTransactionId: 'transaction_1', priceMinor: 43400, paidPriceMinor: 43400 }]);
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('rejects inconsistent transaction metadata instead of storing incorrect refund references', async () => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(retrieved({
      itemTransactions: [{ itemId: 'line_1', paymentTransactionId: 'transaction_1', price: '433', paidPrice: '434' }],
    }))));
    await expect(retrieveSandboxPayment(expected)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
