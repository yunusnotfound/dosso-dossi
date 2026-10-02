import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './src/test/database.js';

export default defineConfig({
  test: {
    // Testler paylaşılan bir test veritabanı kullanır → seri çalıştır
    pool: 'forks',
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    setupFiles: ['src/test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET: 'test-gizli-anahtar',
      ADMIN_JWT_SECRET: 'test-admin-gizli-anahtar',
      ADMIN_ORIGINS: 'http://localhost:5173,http://localhost:4173',
      POS_WEBHOOK_SECRET: 'test-pos-sirri-1234567890',
      PAYMENT_WEBHOOK_SECRET: 'test-payment-sirri-1234567890',
      OTP_DEV_MODE: 'true',
      POS_DEV_AUTOADVANCE: 'false',
      LOG_LEVEL: 'error',
    },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
