import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import { webTestDatabaseUrl } from './src/config/web.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
// Validate before any setup, migration or fixture writes can run.
const testUrl = webTestDatabaseUrl(process.env);

export default defineConfig({ test: {
  include: ['src/web-test/**/*.integration.test.ts'],
  globalSetup: ['src/web-test/global-setup.ts'],
  pool: 'forks',
  fileParallelism: false,
  env: { NODE_ENV: 'test', WEB_ENABLED: 'true', WEB_INTEGRATION_DATABASE_URL: testUrl },
  testTimeout: 20000,
  hookTimeout: 30000,
} });
