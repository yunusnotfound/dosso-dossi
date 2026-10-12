import { describe, expect, it } from 'vitest';
import { envSchema } from './env.js';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://unused/unused',
  JWT_SECRET: 'production-fixture-customer-key',
  ADMIN_JWT_SECRET: 'production-fixture-admin-key',
  POS_WEBHOOK_SECRET: 'production-fixture-pos-key',
  PAYMENT_WEBHOOK_SECRET: 'production-fixture-payment-key',
  ADMIN_ORIGINS: 'https://admin.example.com',
};

describe('production environment', () => {
  it('starts with unavailable integrations disabled and no trusted proxies', () => {
    expect(envSchema.parse(production)).toMatchObject({
      PAYMENT_PROVIDER: 'disabled', SMS_PROVIDER: 'disabled', POS_PROVIDER: 'disabled',
      OTP_DEV_MODE: false, POS_DEV_AUTOADVANCE: false, TRUST_PROXY: [],
    });
  });

  it.each(['PAYMENT_PROVIDER', 'SMS_PROVIDER', 'POS_PROVIDER'] as const)(
    'rejects dev and unimplemented %s providers in production', (key) => {
      expect(envSchema.safeParse({ ...production, [key]: 'dev' }).success).toBe(false);
      expect(envSchema.safeParse({ ...production, [key]: 'not-implemented' }).success).toBe(false);
      expect(envSchema.safeParse({ ...production, [key]: 'disabled' }).success).toBe(true);
    },
  );

  it('preserves simulated integrations for development and tests', () => {
    for (const NODE_ENV of ['test', 'development']) {
      expect(envSchema.parse({ ...production, NODE_ENV })).toMatchObject({
        PAYMENT_PROVIDER: 'dev', SMS_PROVIDER: 'dev', POS_PROVIDER: 'dev',
      });
    }
  });

  it('accepts only explicit proxy addresses or CIDRs, never blanket trust', () => {
    expect(envSchema.parse({ ...production, TRUST_PROXY: '127.0.0.1, ::1,172.30.5.0/24' }).TRUST_PROXY)
      .toEqual(['127.0.0.1', '::1', '172.30.5.0/24']);
    for (const TRUST_PROXY of ['true', '1', '*', '0.0.0.0/0', '::/0', 'proxy.example.com', '172.30.0.0/33']) {
      expect(envSchema.safeParse({ ...production, TRUST_PROXY }).success).toBe(false);
    }
  });
});
