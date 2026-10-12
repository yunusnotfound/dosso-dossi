import fs from 'node:fs';
import { isIP } from 'node:net';
import { z } from 'zod';

// tsx/node .env dosyasını kendiliğinden yüklemez
if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(8),
    JWT_EXPIRES_IN: z.string().default('15m'),
    // POS köprüsü ve ödeme sağlayıcı webhook'ları için HMAC sırları.
    // Bilerek varsayılansız: eksikse sunucu HİÇ açılmaz (fail-closed) —
    // bu sırlar para hareket ettiren uçları koruyor.
    POS_WEBHOOK_SECRET: z.string().min(16),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),
    // Gerçek adaptörler kurulana kadar üretimde tahsilat/SMS kapalıdır.
    PAYMENT_PROVIDER: z.enum(['dev', 'disabled']).optional(),
    SMS_PROVIDER: z.enum(['dev', 'disabled']).optional(),
    POS_PROVIDER: z.enum(['dev', 'disabled']).optional(),
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
    // Yalnız kontrol ettiğimiz reverse proxy IP/CIDR adresleri; genel true yok.
    TRUST_PROXY: z.string().default('')
      .transform((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean))
      .refine((entries) => entries.every((entry) => {
        const [address, prefix, extra] = entry.split('/');
        const version = isIP(address ?? '');
        if (!version || extra !== undefined) return false;
        if (prefix === undefined) return true;
        return /^\d+$/.test(prefix) && Number(prefix) > 0 && Number(prefix) <= (version === 4 ? 32 : 128);
      }), 'TRUST_PROXY virgülle ayrılmış IP/CIDR adresleri olmalı; genel güven desteklenmez'),
    LOG_LEVEL: z.string().default('info'),
    OTP_DEV_MODE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    NODE_ENV: z.string().default('development'),
  })
  .transform((cfg) => ({
    ...cfg,
    PAYMENT_PROVIDER: cfg.PAYMENT_PROVIDER ?? (cfg.NODE_ENV === 'production' ? 'disabled' : 'dev'),
    SMS_PROVIDER: cfg.SMS_PROVIDER ?? (cfg.NODE_ENV === 'production' ? 'disabled' : 'dev'),
    POS_PROVIDER: cfg.POS_PROVIDER ?? (cfg.NODE_ENV === 'production' ? 'disabled' : 'dev'),
  }))
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return;
    // Üretimde dev kolaylıkları asla açık kalamaz
    for (const key of ['PAYMENT_PROVIDER', 'SMS_PROVIDER', 'POS_PROVIDER'] as const) {
      if (cfg[key] === 'dev') {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} üretimde dev olamaz; gerçek adaptör kurulana kadar disabled kullanın`,
        });
      }
    }
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
  HOST: parsed.HOST ?? (parsed.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
};
