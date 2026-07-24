import { logger } from '../../../lib/logger.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.js';

/// Geliştirme sağlayıcısı: ödemeyi anında onaylar (para çekilmez).
/// iyzico adaptörü geldiğinde PAYMENT_PROVIDER env'i ile değiştirilecek.
export class DevPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    logger.info(
      `[Ödeme dev] ${input.amount} ₺ tahsilat simüle edildi (intent ${input.intentId})`,
    );
    return { providerRef: `dev_${input.intentId}`, status: 'succeeded' };
  }
}

export const paymentProvider: PaymentProvider = new DevPaymentProvider();
