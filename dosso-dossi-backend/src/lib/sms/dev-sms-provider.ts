import { env } from '../../config/env.js';
import { AppError, ErrorCodes } from '../errors.js';
import { logger } from '../logger.js';
import type { SmsProvider } from './sms-provider.js';

/// Geliştirme: SMS göndermez, mesajı loglar.
/// Gerçek sağlayıcı (Netgsm vb.) aynı arayüzle buraya takılır.
export class DevSmsProvider implements SmsProvider {
  async send(phone: string, message: string): Promise<void> {
    assertSmsAvailable();
    logger.info(`[SMS → ${phone}] ${message}`);
  }
}

/** Üretimde OTP gönderilmiş gibi yanıt vermeyin veya kodu loga yazmayın. */
export function assertSmsAvailable(): void {
  if (env.SMS_PROVIDER === 'disabled' || env.NODE_ENV === 'production') {
    throw new AppError(ErrorCodes.INTERNAL, 503, 'SMS hizmeti henüz kullanıma açılmadı.');
  }
}

class DisabledSmsProvider implements SmsProvider {
  async send(): Promise<void> {
    throw new AppError(ErrorCodes.INTERNAL, 503, 'SMS hizmeti henüz kullanıma açılmadı.');
  }
}

export const smsProvider: SmsProvider = env.SMS_PROVIDER === 'dev'
  ? new DevSmsProvider()
  : new DisabledSmsProvider();
