import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { createWebRouter } from '../features/web/web.routes.js';

const store = { name: 'Dosso Dossi Coffee', defaultLocale: 'tr', locales: ['tr', 'en'], currency: 'TRY', shippingCountry: 'TR' };

function fixture(result: unknown, error = false) {
  const findUnique = error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  const app = express();
  app.use('/web', createWebRouter(() => ({ webStoreSettings: { findUnique } }) as unknown as Pick<PrismaClient, 'webStoreSettings'>));
  return { app, findUnique };
}

describe('web public routes', () => {
  it('returns only the selected public store fields from the web database', async () => {
    const { app, findUnique } = fixture(store);
    const res = await request(app).get('/web/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ store });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'store' }, select: {
      name: true, defaultLocale: true, locales: true, currency: true, shippingCountry: true,
    } });
  });
  it('returns readiness only when the migrated store record exists', async () => {
    expect((await request(fixture({ id: 'store' }).app).get('/web/health')).body).toEqual({ ok: true, service: 'web' });
    const missing = await request(fixture(null).app).get('/web/health');
    expect(missing.status).toBe(503);
    expect(missing.body).toEqual({ ok: false, service: 'web' });
  });
  it.each(['/web/config', '/web/health'])('does not leak connection errors from %s', async (url) => {
    const { app } = fixture(new Error('postgresql://secret:private@host/database'), true);
    const res = await request(app).get(url);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/private|postgres|database/);
  });
  it('reports an unseeded store as unavailable rather than returning invented settings', async () => {
    const res = await request(fixture(null).app).get('/web/config');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('WEB_UNAVAILABLE');
  });
});
