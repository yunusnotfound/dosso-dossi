import { defineConfig } from 'vitest/config';

// No mobile setup and no database connection: these tests validate the isolation boundary.
export default defineConfig({ test: {
  include: ['src/web-test/**/*.test.ts'],
  exclude: ['src/web-test/**/*.integration.test.ts'],
  env: { NODE_ENV: 'test', WEB_ENABLED: 'false' },
} });
