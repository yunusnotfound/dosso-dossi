import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { readWebSandboxPaymentConfiguration, type WebEnvironment, type WebSandboxPaymentConfiguration } from '../../config/web.js';

const BASE_URL = 'https://sandbox-api.iyzipay.com';
const INITIALIZE_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
const RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail';
const MAX_RESPONSE_BYTES = 262_144;
// Explicit provider sample identity, sandbox only. This is never customer identity data.
const SANDBOX_IDENTITY_NUMBER = '74300864791';
const provinces = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş','Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'];
const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const tokenValue = z.string().min(8).max(256).regex(/^[A-Za-z0-9_-]+$/);
const text = (max: number) => z.string().trim().min(1).max(max).refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const money = z.number().int().min(0).max(2_147_483_647);
const initializeInput = z.object({
  orderId: id, orderNumber: text(80).optional(), conversationId: id,
  totalMinor: money.min(1), subtotalMinor: money, shippingFeeMinor: money,
  customer: z.object({ id, name: text(200), email: z.email() }),
  address: z.object({ recipientName: text(120), phone: z.string().regex(/^\+90[2-5]\d{9}$/),
    provinceCode: z.string().regex(/^(0[1-9]|[1-7][0-9]|8[01])$/), district: text(100),
    neighborhood: text(120), addressLine: text(500), postalCode: z.string().regex(/^(?:\d{5})?$/), country: z.literal('TR') }),
  lines: z.array(z.object({ id, nameTr: text(200), quantity: z.number().int().min(1).max(99), lineTotalMinor: money })).min(1).max(100),
  locale: z.enum(['tr', 'en']), ip: z.string().refine((v) => isIP(v) !== 0),
}).strict();
export type SandboxPaymentInput = z.infer<typeof initializeInput>;
export type SandboxPaymentResult = {
  status: 'SUCCESS' | 'FAILURE' | 'PENDING'; paymentId: string; conversationId: string;
  basketId: string; currency: 'TRY'; priceMinor: number; paidPriceMinor: number; fraudStatus: 1 | 0 | -1 | null;
  itemTransactions?: Array<{ paymentTransactionId: string; itemId: string; priceMinor: number; paidPriceMinor: number }>;
};
export type IyzipayErrorCode = 'NOT_CONFIGURED' | 'INVALID_REQUEST' | 'INITIALIZE_REJECTED' | 'AMBIGUOUS' | 'INVALID_RESPONSE';
export class IyzipayError extends Error {
  readonly ambiguous: boolean;
  constructor(readonly code: IyzipayErrorCode) {
    super(code === 'NOT_CONFIGURED' ? 'iyzico sandbox henüz yapılandırılmadı.' : 'Ödeme sağlayıcısının sonucu doğrulanamadı.');
    this.name = 'IyzipayError';
    this.ambiguous = code === 'AMBIGUOUS' || code === 'INVALID_RESPONSE';
  }
}

export function getPaymentAvailability(source: WebEnvironment = process.env) {
  return { provider: 'IYZICO' as const, mode: 'sandbox' as const, configured: readWebSandboxPaymentConfiguration(source) !== null };
}
function configuration(): WebSandboxPaymentConfiguration {
  const config = readWebSandboxPaymentConfiguration(process.env);
  if (!config) throw new IyzipayError('NOT_CONFIGURED');
  return config;
}

/** Decimal values are parsed without floating-point multiplication or rounding. */
export function iyzicoMoneyMinor(input: unknown): number {
  const raw = typeof input === 'number' && Number.isFinite(input) ? String(input) : input;
  if (typeof raw !== 'string' || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,10})?$/.test(raw)) throw new IyzipayError('INVALID_RESPONSE');
  const [whole = '', fraction = ''] = raw.split('.');
  if (/[1-9]/.test(fraction.slice(2))) throw new IyzipayError('INVALID_RESPONSE');
  const minor = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor > 2_147_483_647) throw new IyzipayError('INVALID_RESPONSE');
  return minor;
}
const decimal = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
const normalizedDecimal = (minor: number) => decimal(minor).replace(/\.?0+$/, '');

/** Sign the exact serialized body subsequently passed to fetch. */
export function iyzicoAuthorization(path: string, body: string, apiKey: string, secretKey: string, randomKey: string): string {
  const signature = createHmac('sha256', secretKey).update(`${randomKey}${path}${body}`).digest('hex');
  return `IYZWSv2 ${Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`).toString('base64')}`;
}
function verifySignature(values: string[], signature: unknown, secretKey: string): void {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) throw new IyzipayError('INVALID_RESPONSE');
  const expected = createHmac('sha256', secretKey).update(values.join(':')).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new IyzipayError('INVALID_RESPONSE');
}

/** No arbitrary redirects, live host, credentials, port, fragment, or mismatched token. */
export function sandboxPaymentPageUrl(value: unknown, token: string): string {
  if (typeof value !== 'string' || value.length > 2048) throw new IyzipayError('INVALID_RESPONSE');
  let url: URL;
  try { url = new URL(value); } catch { throw new IyzipayError('INVALID_RESPONSE'); }
  const hosted = url.hostname === 'sandbox-cpp.iyzipay.com' && url.pathname === '/';
  const legacy = url.hostname === 'sandbox-api.iyzipay.com' && /^\/checkoutform\/[A-Za-z0-9_/-]*$/.test(url.pathname);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || (!hosted && !legacy)
    || url.searchParams.getAll('token').length !== 1 || url.searchParams.get('token') !== token
    || [...url.searchParams.keys()].some((key) => !['token', 'lang'].includes(key))
    || (url.searchParams.has('lang') && !['tr', 'en'].includes(url.searchParams.get('lang')!))) throw new IyzipayError('INVALID_RESPONSE');
  return url.toString();
}

async function request(path: string, payload: object, config: WebSandboxPaymentConfiguration): Promise<Record<string, unknown>> {
  const body = JSON.stringify(payload);
  const randomKey = `${Date.now()}${randomBytes(16).toString('hex')}`;
  try {
    const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-iyzi-rnd': randomKey,
        Authorization: iyzicoAuthorization(path, body, config.apiKey, config.secretKey, randomKey) },
      body, signal: AbortSignal.timeout(15_000) });
    // No automatic retry: initialize is not idempotent and a lost response may have created a session.
    if ((!response.ok && response.status !== 400) || !response.body
      || Number(response.headers.get('content-length') ?? 0) > MAX_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new IyzipayError('AMBIGUOUS');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new IyzipayError('AMBIGUOUS'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new IyzipayError('AMBIGUOUS');
    return result as Record<string, unknown>;
  } catch (error) {
    // Never expose provider response body, HTML, credentials, checkout token, buyer, or URL in an error.
    if (error instanceof IyzipayError) throw error;
    throw new IyzipayError('AMBIGUOUS');
  }
}

export async function initializeSandboxPayment(input: SandboxPaymentInput): Promise<{ token: string; paymentPageUrl: string; expiresAt: Date }> {
  const config = configuration();
  const parsed = initializeInput.safeParse(input);
  if (!parsed.success) throw new IyzipayError('INVALID_REQUEST');
  const data = parsed.data;
  if (data.subtotalMinor + data.shippingFeeMinor !== data.totalMinor
    || data.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0) !== data.subtotalMinor
    || new Set(data.lines.map((line) => line.id)).size !== data.lines.length) throw new IyzipayError('INVALID_REQUEST');
  const nameParts = data.customer.name.split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts.pop()! : nameParts[0]!;
  const name = nameParts.join(' ');
  const city = provinces[Number(data.address.provinceCode) - 1]!;
  const street = `${data.address.addressLine}, ${data.address.neighborhood}, ${data.address.district}`;
  const address = { address: street, contactName: data.address.recipientName, city, country: 'Turkey', zipCode: data.address.postalCode };
  // Complimentary lines stay in the immutable order, but have no provider money transaction.
  const basketItems = data.lines.filter((line) => line.lineTotalMinor > 0).map((line) => ({ id: line.id, name: line.nameTr,
    category1: 'Dosso Dossi Coffee', itemType: 'PHYSICAL', price: decimal(line.lineTotalMinor) }));
  if (data.shippingFeeMinor > 0) basketItems.push({ id: `shipping_${data.orderId}`, name: 'Kargo', category1: 'Teslimat', itemType: 'VIRTUAL', price: decimal(data.shippingFeeMinor) });
  const response = await request(INITIALIZE_PATH, {
    locale: data.locale, conversationId: data.conversationId, price: decimal(data.totalMinor), paidPrice: decimal(data.totalMinor),
    currency: 'TRY', basketId: data.orderId, paymentGroup: 'PRODUCT', callbackUrl: config.callbackUrl, enabledInstallments: [1],
    buyer: { id: data.customer.id, name, surname, email: data.customer.email, gsmNumber: data.address.phone,
      identityNumber: SANDBOX_IDENTITY_NUMBER, registrationAddress: street, city, country: 'Turkey', zipCode: data.address.postalCode, ip: data.ip },
    shippingAddress: address, billingAddress: address, basketItems,
  }, config);
  if (response.status === 'failure' && response.conversationId === data.conversationId
    && !response.token && typeof response.errorCode === 'string' && /^\d{1,12}$/.test(response.errorCode)) throw new IyzipayError('INITIALIZE_REJECTED');
  if (response.status !== 'success' || response.conversationId !== data.conversationId || !tokenValue.safeParse(response.token).success) throw new IyzipayError('AMBIGUOUS');
  const token = response.token as string;
  verifySignature([data.conversationId, token], response.signature, config.secretKey);
  const paymentPageUrl = sandboxPaymentPageUrl(response.paymentPageUrl, token);
  // A conservative local checkout window; never assume the provider token outlives this lease.
  const seconds = typeof response.tokenExpireTime === 'number' && Number.isInteger(response.tokenExpireTime) && response.tokenExpireTime > 0
    ? Math.min(response.tokenExpireTime, 900) : 900;
  return { token, paymentPageUrl, expiresAt: new Date(Date.now() + seconds * 1000) };
}

export async function retrieveSandboxPayment(input: {
  token: string; conversationId: string; orderId: string; totalMinor: number; locale?: 'tr' | 'en';
}): Promise<SandboxPaymentResult> {
  const config = configuration();
  if (!tokenValue.safeParse(input.token).success || !id.safeParse(input.conversationId).success
    || !id.safeParse(input.orderId).success || !money.min(1).safeParse(input.totalMinor).success
    || (input.locale !== undefined && !['tr', 'en'].includes(input.locale))) throw new IyzipayError('INVALID_REQUEST');
  const response = await request(RETRIEVE_PATH, { locale: input.locale ?? 'tr', conversationId: input.conversationId, token: input.token }, config);
  if (response.status !== 'success' || response.conversationId !== input.conversationId || response.token !== input.token
    || response.basketId !== input.orderId || response.currency !== 'TRY' || !id.safeParse(response.paymentId).success
    || typeof response.paymentStatus !== 'string' || !/^[A-Z_]{1,40}$/.test(response.paymentStatus)) throw new IyzipayError('INVALID_RESPONSE');
  const priceMinor = iyzicoMoneyMinor(response.price);
  const paidPriceMinor = iyzicoMoneyMinor(response.paidPrice);
  verifySignature([response.paymentStatus, response.paymentId as string, 'TRY', input.orderId, input.conversationId,
    normalizedDecimal(paidPriceMinor), normalizedDecimal(priceMinor), input.token], response.signature, config.secretKey);
  if (priceMinor !== input.totalMinor || paidPriceMinor !== input.totalMinor) throw new IyzipayError('INVALID_RESPONSE');
  let itemTransactions: SandboxPaymentResult['itemTransactions'];
  if (response.itemTransactions !== undefined) {
    if (!Array.isArray(response.itemTransactions) || response.itemTransactions.length > 101) throw new IyzipayError('INVALID_RESPONSE');
    itemTransactions = response.itemTransactions.map((item: unknown) => {
      if (!item || typeof item !== 'object' || !('paymentTransactionId' in item) || !id.safeParse(item.paymentTransactionId).success
        || !('itemId' in item) || !id.safeParse(item.itemId).success || !('price' in item) || !('paidPrice' in item)) throw new IyzipayError('INVALID_RESPONSE');
      return { paymentTransactionId: item.paymentTransactionId as string, itemId: item.itemId as string,
        priceMinor: iyzicoMoneyMinor(item.price), paidPriceMinor: iyzicoMoneyMinor(item.paidPrice) };
    });
    // Provider signatures cover payment-level fields, not item details. These IDs
    // are accounting metadata received over authenticated TLS, never payment authority.
    if (new Set(itemTransactions.map((item) => item.paymentTransactionId)).size !== itemTransactions.length
      || new Set(itemTransactions.map((item) => item.itemId)).size !== itemTransactions.length
      || (itemTransactions.length && (itemTransactions.reduce((sum, item) => sum + item.priceMinor, 0) !== priceMinor
        || itemTransactions.reduce((sum, item) => sum + item.paidPriceMinor, 0) !== paidPriceMinor))) throw new IyzipayError('INVALID_RESPONSE');
  }
  const fraudStatus = response.fraudStatus === 1 || response.fraudStatus === 0 || response.fraudStatus === -1 ? response.fraudStatus : null;
  const status = response.paymentStatus === 'SUCCESS' && fraudStatus === 1 ? 'SUCCESS'
    : response.paymentStatus === 'FAILURE' || fraudStatus === -1 ? 'FAILURE' : 'PENDING';
  return { status, paymentId: response.paymentId as string, conversationId: input.conversationId, basketId: input.orderId,
    currency: 'TRY', priceMinor, paidPriceMinor, fraudStatus, ...(itemTransactions ? { itemTransactions } : {}) };
}
