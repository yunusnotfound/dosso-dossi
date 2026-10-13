import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import express from 'express';
import request from 'supertest';
import { spawnSync } from 'node:child_process';
import { webTestDatabaseUrl } from '../config/web.js';
import { createWebRouter } from '../features/web/web.routes.js';

// Repeat the safety guard in the worker before creating a client or clearing fixtures.
const target = webTestDatabaseUrl(process.env);
if (target !== process.env.WEB_INTEGRATION_DATABASE_URL) throw new Error('Web test DB seçimi uyuşmuyor.');
const prisma = new PrismaClient({ datasourceUrl: target });
const app = express();
app.use('/web', createWebRouter(() => prisma));

beforeEach(async () => { await prisma.webStoreSettings.deleteMany(); });
afterAll(async () => { await prisma.webStoreSettings.deleteMany(); await prisma.$disconnect(); });

describe('independent PostgreSQL web store', () => {
  it('serves persisted settings from the web test database', async () => {
    await prisma.webStoreSettings.create({ data: { id: 'store', name: 'Independent web store' } });
    const config = await request(app).get('/web/config');
    expect(config.status).toBe(200);
    expect(config.body).toEqual({ store: {
      name: 'Independent web store', defaultLocale: 'tr', locales: ['tr', 'en'], currency: 'TRY', shippingCountry: 'TR',
    } });
    expect((await request(app).get('/web/health')).status).toBe(200);
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    const names = tables.map((entry) => entry.tablename);
    expect(names).toContain('WebStoreSettings');
    expect(names).toContain('WebProduct');
    expect(names.every((name) => name.startsWith('Web') || name === '_prisma_migrations')).toBe(true);
  });
  it('does not claim readiness before seeding and enforces a single store', async () => {
    expect((await request(app).get('/web/health')).status).toBe(503);
    expect((await request(app).get('/web/config')).status).toBe(503);
    await expect(prisma.webStoreSettings.create({ data: { id: 'another-store' } })).rejects.toThrow();
  });
  it('seeds defaults idempotently and preserves edited store settings', async () => {
    const seed = () => {
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/web-prisma.ts', 'seed'], {
        env: { ...process.env, WEB_DATABASE_URL: target }, stdio: 'pipe',
      });
      expect(result.status).toBe(0);
    };
    seed();
    expect((await prisma.webStoreSettings.findUniqueOrThrow({ where: { id: 'store' } })).name).toBe('Dosso Dossi Coffee');
    await prisma.webStoreSettings.update({ where: { id: 'store' }, data: { name: 'Preserve merchant settings' } });
    seed();
    expect(await prisma.webStoreSettings.count()).toBe(1);
    expect((await prisma.webStoreSettings.findUniqueOrThrow({ where: { id: 'store' } })).name).toBe('Preserve merchant settings');
  });
});
