import { env } from '../../../config/env.js';
import { AppError, ErrorCodes } from '../../../lib/errors.js';
import { logger } from '../../../lib/logger.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.js';

/// Geliştirme sağlayıcısı: ödemeyi anında onaylar (para çekilmez).
/// Yalnız geliştirme/test ortamında ve PAYMENT_PROVIDER=dev iken kullanılabilir.
export class DevPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    assertPaymentAvailable();
    logger.info(
      `[Ödeme dev] ${input.amount} ₺ tahsilat simüle edildi (intent ${input.intentId})`,
    );
    return { providerRef: `dev_${input.intentId}`, status: 'succeeded' };
  }
}

/** Dev tahsilatının üretimde gerçek bakiyeye dönüşmesini engeller. */
export function assertPaymentAvailable(): void {
  if (env.PAYMENT_PROVIDER === 'disabled' || env.NODE_ENV === 'production') {
    throw new AppError(ErrorCodes.INTERNAL, 503, 'Bakiye yükleme hizmeti henüz kullanıma açılmadı.');
  }
}

class DisabledPaymentProvider implements PaymentProvider {
  async createPayment(): Promise<CreatePaymentResult> {
    throw new AppError(ErrorCodes.INTERNAL, 503, 'Bakiye yükleme hizmeti henüz kullanıma açılmadı.');
  }
}

export const paymentProvider: PaymentProvider = env.PAYMENT_PROVIDER === 'dev'
  ? new DevPaymentProvider()
  : new DisabledPaymentProvider();
