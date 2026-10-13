import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import { hash } from '@node-rs/argon2';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { webTestDatabaseUrl } from '../config/web.js';
import { createCatalogRouter } from '../features/web/catalog.routes.js';
import { errorHandler } from '../middleware/error-handler.js';

const target = webTestDatabaseUrl(process.env);
if (target !== process.env.WEB_INTEGRATION_DATABASE_URL) throw new Error('Web test DB seçimi uyuşmuyor.');
const database = new PrismaClient({ datasourceUrl: target });
const mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dd-web-catalog-test-'));
let app: express.Express;
let passwordHash: string;
let token: string;
let png: string;
async function clear() {
  await database.webCatalogAudit.deleteMany(); await database.webStockAdjustment.deleteMany();
  await database.webProduct.deleteMany(); await database.webMedia.deleteMany();
  await database.webAdmin.deleteMany();
}
beforeAll(async () => {
  passwordHash = await hash('Test-password-012345');
  png = (await sharp({ create: { width: 20, height: 30, channels: 4, background: '#fa983b' } }).png().toBuffer()).toString('base64');
});
beforeEach(async () => {
  await clear();
  await database.webAdmin.create({ data: { email: 'web-admin@example.test', name: 'Web Admin', passwordHash } });
  app = express(); app.use('/web', createCatalogRouter(() => database, mediaRoot)); app.use(errorHandler);
  const login = await request(app).post('/web/admin/auth/login').send({ email: 'web-admin@example.test', password: 'Test-password-012345' });
  expect(login.status).toBe(200); token = login.body.token;
});
afterAll(async () => { await clear(); await database.$disconnect(); await fs.rm(mediaRoot, { recursive: true, force: true }); });
const auth = () => ({ Authorization: `Bearer ${token}` });
async function fixture(slug = 'test-coffee') {
  const upload = await request(app).post('/web/admin/media').set(auth()).send({ filename: 'coffee.png', mimeType: 'image/png', data: png });
  expect(upload.status).toBe(201);
  return {
    slug, type: 'COFFEE', status: 'PUBLISHED', nameTr: 'Kahve', nameEn: 'Coffee', descriptionTr: 'Açıklama', descriptionEn: 'Description', sortOrder: 0,
    images: [{ mediaId: upload.body.media.id, altTr: 'Kahve', altEn: 'Coffee', sortOrder: 0 }],
    variants: [{ sku: `SKU-${slug}`, labelTr: '250 g', labelEn: '250 g', weightGrams: 250, priceMinor: 35000, stock: 12, active: true, imageId: upload.body.media.id }],
    grindOptions: [
      { code: 'whole', nameTr: 'Çekirdek', nameEn: 'Whole bean', priceDeltaMinor: 0, sortOrder: 0, active: true },
      { code: 'filter', nameTr: 'Filtre', nameEn: 'Filter', priceDeltaMinor: 500, sortOrder: 1, active: true },
    ],
  };
}
const updateInput = (product: any) => {
  const { id: _id, ...input } = product;
  return { ...input, images: input.images.map(({ url: _url, ...image }: any) => image) };
};
async function create(slug?: string) {
  const result = await request(app).post('/web/admin/products').set(auth()).send(await fixture(slug));
  expect(result.status).toBe(201); return result.body.product;
}

describe('web catalogue admin and PostgreSQL persistence', () => {
  it('requires independent opaque admin sessions; does not accept a mobile JWT', async () => {
    expect((await request(app).get('/web/admin/products')).status).toBe(401);
    expect((await request(app).get('/web/admin/products').set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.mobile.signature')).status).toBe(401);
    const session = await request(app).get('/web/admin/auth/session').set(auth());
    expect(session.body.admin.email).toBe('web-admin@example.test');
    expect(JSON.stringify(session.body)).not.toMatch(/passwordHash|tokenHash/);
    const stored = await database.webAdminSession.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token); expect(stored.tokenHash).toHaveLength(64);
    expect((await request(app).post('/web/admin/auth/logout').set(auth())).status).toBe(204);
    expect((await request(app).get('/web/admin/products').set(auth())).status).toBe(401);
  });
  it('rejects inactive and expired administrators and rate limits login attempts', async () => {
    await database.webAdminSession.updateMany({ data: { expiresAt: new Date(0) } });
    expect((await request(app).get('/web/admin/products').set(auth())).status).toBe(401);
    await database.webAdmin.updateMany({ data: { active: false } });
    expect((await request(app).post('/web/admin/auth/login').send({ email: 'web-admin@example.test', password: 'Test-password-012345' })).status).toBe(401);
    for (let i = 0; i < 14; i++) await request(app).post('/web/admin/auth/login').send({ email: 'nobody@example.test', password: 'wrong' });
    expect((await request(app).post('/web/admin/auth/login').send({ email: 'nobody@example.test', password: 'wrong' })).status).toBe(429);
  });
  it('limits failed accounts independently behind the same Next.js address', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/web/admin/auth/login').send({ email: 'blocked@example.test', password: 'wrong' })).status).toBe(401);
    }
    expect((await request(app).post('/web/admin/auth/login').send({ email: 'BLOCKED@example.test', password: 'wrong' })).status).toBe(429);
    expect((await request(app).post('/web/admin/auth/login').send({ email: 'web-admin@example.test', password: 'Test-password-012345' })).status).toBe(200);
  });
  it('does not exhaust the account failure budget through successful logins and resets previous failures', async () => {
    const login = (password: string) => request(app).post('/web/admin/auth/login').send({ email: 'web-admin@example.test', password });
    for (let i = 0; i < 18; i++) expect((await login('Test-password-012345')).status).toBe(200);
    for (let i = 0; i < 9; i++) expect((await login('wrong')).status).toBe(401);
    expect((await login('Test-password-012345')).status).toBe(200);
    for (let i = 0; i < 9; i++) expect((await login('wrong')).status).toBe(401);
    expect((await login('Test-password-012345')).status).toBe(200);
  });
  it('persists product variants and shared grind inventory; public data excludes private fields', async () => {
    const product = await create();
    expect(product.variants).toHaveLength(1); expect(product.grindOptions).toHaveLength(2);
    expect(await database.webProductVariant.count()).toBe(1);
    expect(product.variants[0].stock).toBe(12);
    const publicData = await request(app).get('/web/catalog');
    expect(publicData.body.products[0].id).toBe(product.id);
    expect(JSON.stringify(publicData.body)).not.toMatch(/passwordHash|tokenHash|adminId|originalName|createdAt/);
    expect(await database.webCatalogAudit.count()).toBe(1);
    expect((await database.webStockAdjustment.findFirstOrThrow()).current).toBe(12);
    expect((await request(app).get(`/web/admin/products/${product.id}`).set(auth())).body.product).toEqual(product);
  });
  it('keeps drafts and inactive choices out of the public catalogue and archives without deletion', async () => {
    let product = await create();
    let input = updateInput(product); input.status = 'DRAFT';
    product = (await request(app).put(`/web/admin/products/${product.id}`).set(auth()).send(input)).body.product;
    expect((await request(app).get('/web/catalog')).body.products).toEqual([]);
    input = updateInput(product); input.status = 'PUBLISHED'; input.grindOptions[1].active = false;
    product = (await request(app).put(`/web/admin/products/${product.id}`).set(auth()).send(input)).body.product;
    expect((await request(app).get('/web/catalog')).body.products[0].grindOptions).toHaveLength(1);
    input = updateInput(product); input.status = 'ARCHIVED';
    expect((await request(app).put(`/web/admin/products/${product.id}`).set(auth()).send(input)).status).toBe(200);
    expect((await request(app).get('/web/catalog')).body.products).toHaveLength(0);
    expect(await database.webProduct.count()).toBe(1);
  });
  it('rejects negative/fractional money, inventory and invalid publication', async () => {
    const input = await fixture();
    for (const [field, value] of [['priceMinor', -1], ['priceMinor', 1.5], ['stock', -1], ['stock', 1.5]] as const) {
      const invalid = structuredClone(input); invalid.variants[0]![field] = value;
      expect((await request(app).post('/web/admin/products').set(auth()).send(invalid)).status).toBe(400);
    }
    expect((await request(app).post('/web/admin/products').set(auth()).send({ ...input, images: [], variants: [] })).status).toBe(400);
    expect(await database.webProduct.count()).toBe(0);
  });
  it('requires a stock adjustment reason and saves stock history atomically with the edit', async () => {
    const product = await create(); const input = updateInput(product); input.variants[0].stock = 9;
    expect((await request(app).put(`/web/admin/products/${product.id}`).set(auth()).send(input)).status).toBe(400);
    expect((await database.webProductVariant.findFirstOrThrow()).stock).toBe(12);
    const edited = await request(app).put(`/web/admin/products/${product.id}`).set(auth()).send({ ...input, stockReason: 'Sayım düzeltmesi' });
    expect(edited.status).toBe(200); expect(edited.body.product.version).toBe(2);
    expect(edited.body.product.variants[0].id).toBe(product.variants[0].id);
    const adjustment = await database.webStockAdjustment.findFirstOrThrow({ where: { reason: 'Sayım düzeltmesi' } });
    expect([adjustment.previous, adjustment.current]).toEqual([12, 9]);
    expect(await database.webCatalogAudit.count()).toBe(2);
  });
  it('rejects stale versions and serializes simultaneous updates without lost edits', async () => {
    const product = await create(); const input = updateInput(product);
    const updates = await Promise.all(['First', 'Second'].map((nameEn) => request(app).put(`/web/admin/products/${product.id}`).set(auth()).send({ ...input, nameEn })));
    expect(updates.map((res) => res.status).sort()).toEqual([200, 409]);
    expect((await database.webProduct.findUniqueOrThrow({ where: { id: product.id } })).version).toBe(2);
    expect(await database.webCatalogAudit.count()).toBe(2);
  });
  it('rejects foreign nested IDs and retains historical variants and grinding choices', async () => {
    const first = await create('first'); const second = await create('second');
    let input = updateInput(first); input.variants[0].id = second.variants[0].id;
    expect((await request(app).put(`/web/admin/products/${first.id}`).set(auth()).send(input)).status).toBe(400);
    input = updateInput(first); input.variants = []; input.status = 'DRAFT';
    expect((await request(app).put(`/web/admin/products/${first.id}`).set(auth()).send(input)).status).toBe(400);
    input = updateInput(first); input.grindOptions = [];
    expect((await request(app).put(`/web/admin/products/${first.id}`).set(auth()).send(input)).status).toBe(400);
    expect(await database.webProductVariant.count()).toBe(2);
  });
  it('enforces globally unique SKU and slug with a safe conflict response', async () => {
    await create();
    const input = await fixture('second'); input.variants[0]!.sku = 'SKU-test-coffee';
    expect((await request(app).post('/web/admin/products').set(auth()).send(input)).status).toBe(409);
    input.variants[0]!.sku = 'SKU-unique'; input.slug = 'test-coffee';
    expect((await request(app).post('/web/admin/products').set(auth()).send(input)).status).toBe(409);
    expect(await database.webProduct.count()).toBe(1);
  });
  it('authenticates uploads, verifies content, reencodes WebP and only serves registered safe filenames', async () => {
    expect((await request(app).post('/web/admin/media').send({ filename: 'a.png', mimeType: 'image/png', data: png })).status).toBe(401);
    expect((await request(app).post('/web/admin/media').set(auth()).send({ filename: 'bad.png', mimeType: 'image/png', data: Buffer.from('<svg/>').toString('base64') })).status).toBe(400);
    expect((await request(app).post('/web/admin/media').set(auth()).send({ filename: 'bad.jpg', mimeType: 'image/jpeg', data: png })).status).toBe(400);
    const upload = await request(app).post('/web/admin/media').set(auth()).send({ filename: '../../safe.png', mimeType: 'image/png', data: png });
    expect(upload.status).toBe(201);
    const media = await request(app).get(upload.body.media.url);
    expect(media.status).toBe(200); expect(media.headers['content-type']).toMatch(/image\/webp/);
    expect((await sharp(media.body).metadata()).format).toBe('webp');
    expect((await request(app).get('/web/media/00000000-0000-4000-8000-000000000000.webp')).status).toBe(404);
    expect((await request(app).get('/web/media/anything.svg')).status).toBe(404);
  });
  it('allows a catalog EDITOR and keeps stock and media scopes web-only', async () => {
    await database.webAdmin.updateMany({ data: { role: 'EDITOR' } });
    const product = await create();
    expect(product.status).toBe('PUBLISHED');
    const tables = await database.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    expect(tables.every(({ tablename }) => tablename.startsWith('Web') || tablename === '_prisma_migrations')).toBe(true);
  });
});
