import fs from 'node:fs';
import { isIP } from 'node:net';
import { z } from 'zod';
import { readWebConfiguration } from './web.js';

// tsx/node .env dosyasını kendiliğinden yüklemez
if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const trustedProxy = z.string().refine((value) => {
  const [address, prefix, ...rest] = value.split('/');
  const version = isIP(address ?? '');
  if (!version || rest.length) return false;
  return prefix === undefined || (/^\d+$/.test(prefix) && Number(prefix) >= 1 && Number(prefix) <= (version === 4 ? 32 : 128));
}, 'TRUST_PROXY yalnız açık IP adresleri/CIDR ağları kabul eder; true, hop sayısı ve /0 kullanılamaz');

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
    // A new installation never silently simulates successful payments.
    PAYMENT_PROVIDER: z.enum(['dev', 'iyzico']).default('iyzico'),
    IYZICO_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    IYZICO_API_KEY: z.string().trim().default(''),
    IYZICO_SECRET_KEY: z.string().trim().default(''),
    IYZICO_CALLBACK_URL: z.string().trim().default(''),
    IYZICO_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
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
    // Geliştirme API'si varsayılan olarak yalnız bu bilgisayardan erişilir.
    // Cihaz testi/container deployment için HOST açıkça verilebilir.
    HOST: z.string().trim().min(1).optional(),
    // X-Forwarded-For is trusted only from explicitly listed ingress addresses.
    TRUST_PROXY: z.string().default('').transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean)).pipe(z.array(trustedProxy).max(50)),
    LOG_LEVEL: z.string().default('info'),
    OTP_DEV_MODE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    NODE_ENV: z.string().default('development'),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return;
    if (cfg.PAYMENT_PROVIDER === 'dev') {
      ctx.addIssue({ code: 'custom', message: 'PAYMENT_PROVIDER üretimde dev olamaz (sahte bakiye yükleme)' });
    }
    if (cfg.PAYMENT_PROVIDER === 'iyzico' && cfg.IYZICO_ENVIRONMENT !== 'production') {
      ctx.addIssue({ code: 'custom', message: 'IYZICO_ENVIRONMENT üretimde production olmalı' });
    }
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

const parsed = envSchema.parse(process.env);
export const env = {
  ...parsed,
  ...readWebConfiguration(process.env),
  HOST: parsed.HOST ?? (parsed.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
};
