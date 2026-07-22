import fs from 'node:fs';
import { z } from 'zod';

// tsx/node .env dosyasını kendiliğinden yüklemez
if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('30d'),
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
