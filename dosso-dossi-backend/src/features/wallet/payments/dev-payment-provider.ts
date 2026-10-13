import { logger } from '../../../lib/logger.js';
import { env } from '../../../config/env.js';
import { PaymentProviderError } from './payment-provider.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.js';

/// Geliştirme sağlayıcısı: ödemeyi anında onaylar (para çekilmez).
/// iyzico adaptörü geldiğinde PAYMENT_PROVIDER env'i ile değiştirilecek.
export class DevPaymentProvider implements PaymentProvider {
  readonly name = 'dev' as const;

  assertReady(): void {
    if (env.NODE_ENV === 'production') throw new PaymentProviderError(true);
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertReady();
    logger.info(
      `[Ödeme dev] ${input.amount} ₺ tahsilat simüle edildi (intent ${input.intentId})`,
    );
    return { providerRef: `dev_${input.intentId}`, status: 'succeeded' };
  }
}

export const paymentProvider: PaymentProvider = new DevPaymentProvider();
