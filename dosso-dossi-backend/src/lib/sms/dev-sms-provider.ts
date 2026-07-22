import { logger } from '../logger.js';
import type { SmsProvider } from './sms-provider.js';

/// Geliştirme: SMS göndermez, mesajı loglar.
/// Gerçek sağlayıcı (Netgsm vb.) aynı arayüzle buraya takılır.
export class DevSmsProvider implements SmsProvider {
  async send(phone: string, message: string): Promise<void> {
    logger.info(`[SMS → ${phone}] ${message}`);
  }
}

export const smsProvider: SmsProvider = new DevSmsProvider();
