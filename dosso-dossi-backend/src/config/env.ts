import fs from 'node:fs';
import { z } from 'zod';

// tsx/node .env dosyasını kendiliğinden yüklemez
if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('15m'),
  // POS köprüsü ve ödeme sağlayıcı webhook'ları için HMAC sırları
  POS_WEBHOOK_SECRET: z.string().min(16).default('dev-pos-secret-degistir'),
  PAYMENT_WEBHOOK_SECRET: z
    .string()
    .min(16)
    .default('dev-payment-secret-degistir'),
  PAYMENT_PROVIDER: z.string().default('dev'),
  // Dev: sipariş durumunu otomatik ilerlet (test ortamında kapalı tut)
  POS_DEV_AUTOADVANCE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),
  // Prod'da açık unutulmasın diye varsayılan false
  OTP_DEV_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  NODE_ENV: z.string().default('development'),
});

export const env = envSchema.parse(process.env);
