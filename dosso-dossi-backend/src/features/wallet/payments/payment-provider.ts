import { AppError, ErrorCodes } from '../../../lib/errors.js';

/** Customer-supplied billing information. Never replace absent data with dummy identity/address values. */
export interface PaymentBuyer {
  name: string;
  surname: string;
  email: string;
  identityNumber: string;
  address: string;
  city: string;
  country: string;
  zipCode?: string;
  /** Taken from the authenticated customer record, not the request body. */
  gsmNumber: string;
}

export interface CreatePaymentInput {
  intentId: string;
  userId: string;
  amount: number;
  savedCard?: boolean;
  buyer?: PaymentBuyer;
  /** Derived by the server from the connection / explicitly trusted reverse proxy. */
  buyerIp?: string;
}

export interface CreatePaymentResult {
  providerRef: string;
  status: 'succeeded' | 'pending' | 'failed';
  /// 3DS akışı için yönlendirme adresi (iyzico adaptörü dolduracak)
  redirectUrl?: string;
  expiresAt?: Date;
}

export interface RetrievePaymentInput {
  intentId: string;
  providerRef: string;
}

export interface VerifiedPaymentResult {
  status: 'succeeded' | 'pending' | 'failed';
  providerRef: string;
  paymentId?: string;
  conversationId: string;
  basketId?: string;
  currency?: string;
  amount?: number;
  paidAmount?: number;
  fraudStatus?: number;
  itemTransactions: Array<{ transactionId: string; itemId: string; price: number; paidPrice: number }>;
}

/** Sanitized errors only. Network/verification failures do not prove a payment failed. */
export class PaymentProviderError extends AppError {
  constructor(public readonly definitiveFailure = false) {
    super(ErrorCodes.PAYMENT_UNAVAILABLE, 503, 'Ödeme hizmeti şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
    this.name = 'PaymentProviderError';
  }
}

export interface PaymentProvider {
  readonly name: 'dev' | 'iyzico';
  assertReady(): void;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  retrievePayment?(input: RetrievePaymentInput): Promise<VerifiedPaymentResult>;
}
