import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  env: { WEB_ENABLED: false, NODE_ENV: 'test', LOG_LEVEL: 'error', ADMIN_ORIGINS: [], TRUST_PROXY: [] },
  mobileQuery: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  webQuery: vi.fn().mockRejectedValue(new Error('web unavailable')),
}));
vi.mock('../config/env.js', () => ({ env: mocks.env }));
vi.mock('../lib/prisma.js', () => ({ prisma: { $queryRaw: mocks.mobileQuery } }));
vi.mock('../lib/web-prisma.js', () => ({ getWebPrisma: () => ({ webStoreSettings: { findUnique: mocks.webQuery } }) }));

import { createApp } from '../app.js';

describe('web mount isolation', () => {
  it('leaves web endpoints absent when disabled', async () => {
    mocks.env.WEB_ENABLED = false;
    const app = createApp();
    expect((await request(app).get('/web/config')).status).toBe(404);
    expect((await request(app).get('/web/health')).status).toBe(404);
    expect(mocks.webQuery).not.toHaveBeenCalled();
  });
  it('keeps mobile health healthy during web database failures', async () => {
    mocks.env.WEB_ENABLED = true;
    const app = createApp();
    const web = await request(app).get('/web/health');
    const mobile = await request(app).get('/health');
    expect(web.status).toBe(503);
    expect(web.body).toEqual({ ok: false, service: 'web' });
    expect(mobile.status).toBe(200);
    expect(mobile.body).toEqual({ ok: true });
  });
});
