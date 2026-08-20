import fs from 'node:fs';
import { z } from 'zod';

// tsx/node .env dosyasını kendiliğinden yüklemez
if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(8),
    JWT_EXPIRES_IN: z.string().default('15m'),
    // POS köprüsü ve ödeme sağlayıcı webhook'ları için HMAC sırları.
    // Bilerek varsayılansız: eksikse sunucu HİÇ açılmaz (fail-closed) —
    // bu sırlar para hareket ettiren uçları koruyor.
    POS_WEBHOOK_SECRET: z.string().min(16),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),
    PAYMENT_PROVIDER: z.string().default('dev'),
    // Yönetim paneli: müşteri JWT'sinden AYRI sır. Aynı sır kullanılırsa
    // müşteri token'ı panele geçerdi; bu yüzden ayrı ve zorunlu.
    ADMIN_JWT_SECRET: z.string().min(16),
    ADMIN_JWT_EXPIRES_IN: z.string().default('15m'),
    // Panelin çalıştığı origin(ler); CORS yalnızca bunlara açılır.
    ADMIN_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    // Dev: sipariş durumunu otomatik ilerlet (yalnızca geliştirmede aç)
    POS_DEV_AUTOADVANCE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.string().default('info'),
    OTP_DEV_MODE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    NODE_ENV: z.string().default('development'),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return;
    // Üretimde dev kolaylıkları asla açık kalamaz
    if (cfg.OTP_DEV_MODE) {
      ctx.addIssue({
        code: 'custom',
        message: 'OTP_DEV_MODE üretimde true olamaz (111111 evrensel giriş olur)',
      });
    }
    if (cfg.POS_DEV_AUTOADVANCE) {
      ctx.addIssue({
        code: 'custom',
        message:
          'POS_DEV_AUTOADVANCE üretimde true olamaz (sahte durum ilerletme)',
      });
    }
    if (cfg.ADMIN_JWT_SECRET === cfg.JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        message:
          'ADMIN_JWT_SECRET, JWT_SECRET ile aynı olamaz (müşteri token’ı panele geçerdi)',
      });
    }
    if (cfg.ADMIN_ORIGINS.some((o) => o.startsWith('http://'))) {
      ctx.addIssue({
        code: 'custom',
        message: 'ADMIN_ORIGINS üretimde https olmalı',
      });
    }
    for (const key of [
      'POS_WEBHOOK_SECRET',
      'PAYMENT_WEBHOOK_SECRET',
      'JWT_SECRET',
      'ADMIN_JWT_SECRET',
    ] as const) {
      if (cfg[key].includes('degistir') || cfg[key].includes('dev-')) {
        ctx.addIssue({
          code: 'custom',
          message: `${key} üretimde geliştirme değeriyle kullanılamaz`,
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
