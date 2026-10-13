import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { AppError, ErrorCodes } from '../../../lib/errors.js';
import {
  PaymentProviderError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type RetrievePaymentInput,
  type VerifiedPaymentResult,
} from './payment-provider.js';

export interface IyzicoConfiguration {
  environment: 'sandbox' | 'production';
  apiKey: string;
  secretKey: string;
  callbackUrl: string;
  timeoutMs: number;
}

const INITIALIZE_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
const RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const hmac = (secret: string, value: string) => createHmac('sha256', secret).update(value, 'utf8').digest('hex');

function matchesSignature(actual: unknown, expected: string): boolean {
  if (typeof actual !== 'string' || !/^[a-fA-F0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

/** The exact serialized request body must also be sent on the wire. */
export function createIyzicoAuthorization(apiKey: string, secretKey: string, path: string, body: string, nonce: string): string {
  const signature = hmac(secretKey, nonce + path + body);
  return 'IYZWSv2 ' + Buffer.from(`apiKey:${apiKey}&randomKey:${nonce}&signature:${signature}`, 'utf8').toString('base64');
}

function textField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f:]/.test(value) ? value : undefined;
}

/** iyzico signs decimal values without their trailing fractional zeroes. */
export function canonicalIyzicoPrice(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const raw = String(value);
  if (!/^\d{1,14}(?:\.\d{1,12})?$/.test(raw)) return undefined;
  return raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
}

function monetaryValue(value: unknown): number | undefined {
  const canonical = canonicalIyzicoPrice(value);
  if (canonical === undefined || !/^\d+(?:\.\d{1,2})?$/.test(canonical)) return undefined;
  const amount = Number(canonical);
  return Number.isSafeInteger(Math.round(amount * 100)) ? amount : undefined;
}

/** No wildcard subdomains, credentials, custom ports or non-HTTPS redirects. */
export function isIyzicoHostedPaymentUrl(value: string, environment: IyzicoConfiguration['environment']): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    const prefix = environment === 'sandbox' ? 'sandbox-' : '';
    return url.hostname === `${prefix}cpp.iyzipay.com`
      || (url.hostname === `${prefix}api.iyzipay.com` && url.pathname.startsWith('/checkoutform/'));
  } catch {
    return false;
  }
}

/** HPP webhook v3 authenticates a notification; callers still retrieve and reconcile the payment. */
export function verifyIyzicoWebhook(payload: unknown, signature: unknown, secretKey: string): boolean {
  if (!secretKey || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const body = payload as Record<string, unknown>;
  const event = textField(body.iyziEventType);
  const token = textField(body.token);
  const conversationId = textField(body.paymentConversationId);
  const status = textField(body.status);
  const paymentId = typeof body.iyziPaymentId === 'number'
    ? (Number.isSafeInteger(body.iyziPaymentId) && body.iyziPaymentId >= 0 ? String(body.iyziPaymentId) : undefined)
    : textField(body.iyziPaymentId);
  if (!event || !/^[A-Z_]+$/.test(event) || !token || !conversationId || !status || !/^[A-Z_]+$/.test(status)
    || !paymentId || !/^\d+$/.test(paymentId)) return false;
  return matchesSignature(signature, hmac(secretKey, secretKey + event + paymentId + token + conversationId + status));
}

export class IyzicoPaymentProvider implements PaymentProvider {
  readonly name = 'iyzico' as const;

  constructor(private readonly config: IyzicoConfiguration) {}

  assertReady(): void {
    const { apiKey, secretKey, callbackUrl, environment, timeoutMs } = this.config;
    let callback: URL;
    try { callback = new URL(callbackUrl); } catch { throw new PaymentProviderError(true); }
    if (!apiKey || !secretKey || /[\s:&]/.test(apiKey) || /\s/.test(secretKey)
      || !['sandbox', 'production'].includes(environment)
      || callback.protocol !== 'https:' || callback.username || callback.password || callback.hash || callback.search
      || callback.pathname !== '/webhooks/iyzico/callback'
      || callback.hostname === 'localhost' || callback.hostname === '127.0.0.1' || callback.hostname === '[::1]'
      || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000
      || (environment === 'production' && (apiKey.startsWith('sandbox-') || secretKey.startsWith('sandbox-')))) {
      throw new PaymentProviderError(true);
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertReady();
    const buyer = input.buyer;
    if (!buyer || !input.buyerIp || !isIP(input.buyerIp)
      || ![buyer.name, buyer.surname, buyer.email, buyer.identityNumber, buyer.address, buyer.city, buyer.country, buyer.gsmNumber]
        .every((value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)
      || !/^\d{11}$/.test(buyer.identityNumber)
      || !/^\+[1-9]\d{7,14}$/.test(buyer.gsmNumber)
      || !textField(input.intentId) || !textField(input.userId)
      || !Number.isFinite(input.amount) || input.amount <= 0 || monetaryValue(input.amount) === undefined) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Ödeme için geçerli alıcı ve fatura bilgileri gerekli.');
    }
    const amount = input.amount.toFixed(2);
    const body = {
      locale: 'tr',
      conversationId: input.intentId,
      price: amount,
      paidPrice: amount,
      currency: 'TRY',
      basketId: input.intentId,
      paymentGroup: 'PRODUCT',
      callbackUrl: this.config.callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: input.userId,
        name: buyer.name,
        surname: buyer.surname,
        email: buyer.email,
        identityNumber: buyer.identityNumber,
        gsmNumber: buyer.gsmNumber,
        registrationAddress: buyer.address,
        city: buyer.city,
        country: buyer.country,
        ...(buyer.zipCode ? { zipCode: buyer.zipCode } : {}),
        ip: input.buyerIp,
      },
      billingAddress: {
        contactName: `${buyer.name} ${buyer.surname}`,
        address: buyer.address,
        city: buyer.city,
        country: buyer.country,
        ...(buyer.zipCode ? { zipCode: buyer.zipCode } : {}),
      },
      // Wallet funding is a virtual item; merchant-account approval must cover this business model.
      basketItems: [{ id: input.intentId, name: 'Dosso Dossi Kart bakiye yükleme', category1: 'Bakiye Yükleme', itemType: 'VIRTUAL', price: amount }],
    };
    const response = await this.request(INITIALIZE_PATH, body);
    if (response.status === 'failure') throw new PaymentProviderError(true);
    const token = textField(response.token);
    const conversationId = textField(response.conversationId);
    if (response.status !== 'success' || !token || conversationId !== input.intentId
      || !matchesSignature(response.signature, hmac(this.config.secretKey, `${conversationId}:${token}`))) {
      throw new PaymentProviderError();
    }
    const redirectUrl = response.paymentPageUrl;
    if (typeof redirectUrl !== 'string' || !isIyzicoHostedPaymentUrl(redirectUrl, this.config.environment)) throw new PaymentProviderError();
    const urlTokens = new URL(redirectUrl).searchParams.getAll('token');
    if (urlTokens.length > 1 || (urlTokens.length === 1 && urlTokens[0] !== token)) throw new PaymentProviderError();
    const lifetime = response.tokenExpireTime;
    // Local resume lifetime only; expiry must never be treated as proof of non-payment.
    const lifetimeSeconds = typeof lifetime === 'number' && Number.isInteger(lifetime) && lifetime > 0 && lifetime <= 86400 ? lifetime : 1800;
    return {
      providerRef: token,
      status: 'pending',
      redirectUrl,
      expiresAt: new Date(Date.now() + lifetimeSeconds * 1000),
    };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<VerifiedPaymentResult> {
    this.assertReady();
    if (!textField(input.intentId) || !textField(input.providerRef)) throw new PaymentProviderError();
    const response = await this.request(RETRIEVE_PATH, { locale: 'tr', conversationId: input.intentId, token: input.providerRef });
    // An API/transport error is not evidence of a declined payment. Preserve pending state.
    const paymentStatus = textField(response.paymentStatus);
    const conversationId = textField(response.conversationId);
    const token = textField(response.token);
    const paymentId = textField(response.paymentId);
    const currency = textField(response.currency);
    const basketId = textField(response.basketId);
    const paidPrice = canonicalIyzicoPrice(response.paidPrice);
    const price = canonicalIyzicoPrice(response.price);
    const signedFields = [paymentStatus, paymentId, currency, basketId, conversationId, paidPrice, price, token];
    if (!paymentStatus || conversationId !== input.intentId || token !== input.providerRef
      || !matchesSignature(response.signature, hmac(this.config.secretKey, signedFields.map((field) => field ?? '').join(':')))) {
      throw new PaymentProviderError();
    }
    const amount = monetaryValue(response.price);
    const paidAmount = monetaryValue(response.paidPrice);
    const fraudStatus = [-1, 0, 1].includes(response.fraudStatus as number) ? response.fraudStatus as number : undefined;
    const successful = response.status === 'success' && paymentStatus === 'SUCCESS' && fraudStatus === 1;
    if (successful && (!paymentId || !currency || !basketId || amount === undefined || paidAmount === undefined)) throw new PaymentProviderError();
    const itemTransactions: VerifiedPaymentResult['itemTransactions'] = [];
    if (Array.isArray(response.itemTransactions)) {
      for (const item of response.itemTransactions) {
        if (!item || typeof item !== 'object') throw new PaymentProviderError();
        const transactionId = textField(item.paymentTransactionId);
        const itemId = textField(item.itemId);
        const itemPrice = monetaryValue(item.price);
        const itemPaidPrice = monetaryValue(item.paidPrice);
        if (!transactionId || !itemId || itemPrice === undefined || itemPaidPrice === undefined) throw new PaymentProviderError();
        itemTransactions.push({ transactionId, itemId, price: itemPrice, paidPrice: itemPaidPrice });
      }
    }
    if (successful && itemTransactions.length !== 1) throw new PaymentProviderError();
    return {
      status: successful ? 'succeeded' : paymentStatus === 'FAILURE' || fraudStatus === -1 ? 'failed' : 'pending',
      providerRef: token,
      conversationId,
      paymentId,
      basketId,
      currency,
      amount,
      paidAmount,
      fraudStatus,
      itemTransactions,
    };
  }

  private async request(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = JSON.stringify(payload);
    const nonce = randomBytes(24).toString('hex');
    const baseUrl = this.config.environment === 'sandbox' ? 'https://sandbox-api.iyzipay.com' : 'https://api.iyzipay.com';
    try {
      const response = await fetch(baseUrl + path, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.timeoutMs),
        headers: {
          Authorization: createIyzicoAuthorization(this.config.apiKey, this.config.secretKey, path, body, nonce),
          'x-iyzi-rnd': nonce,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new PaymentProviderError();
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new PaymentProviderError(); }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new PaymentProviderError();
      return parsed as Record<string, unknown>;
    } catch {
      // Never leak request bodies, PAN/identity data, keys or provider error strings to logs/clients.
      throw new PaymentProviderError();
    }
  }
}
