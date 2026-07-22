import { defineConfig } from 'vitest/config';

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
      DATABASE_URL: 'postgresql://dosso:dosso@localhost:5433/dosso_dossi_test',
      JWT_SECRET: 'test-gizli-anahtar',
      OTP_DEV_MODE: 'true',
      LOG_LEVEL: 'error',
    },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
