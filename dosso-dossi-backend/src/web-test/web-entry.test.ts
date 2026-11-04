import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@dosso-dossi/web-prisma';

vi.mock('../config/env.js', () => ({ env: { WEB_ENABLED: true, NODE_ENV: 'test', LOG_LEVEL: 'error', TRUST_PROXY: [] } }));
vi.mock('../lib/web-prisma.js', () => ({ getWebPrisma: vi.fn() }));
import { createWebApp } from '../web-app.js';

describe('dedicated web API boundary', () => {
  const database = () => ({ webStoreSettings: { findUnique: async () => ({ id: 'store' }) } }) as unknown as PrismaClient;
  it('serves web readiness using only the supplied web database', async () => {
    const response = await request(createWebApp(database)).get('/web/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: 'web' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it.each(['/health', '/admin', '/auth/login', '/pos/sale', '/webhooks/payment', '/me/wallet'])('does not expose mobile or POS endpoint %s', async (path) => {
    const response = await request(createWebApp(database)).post(path).send({});
    expect(response.status).toBe(404);
  });
});
