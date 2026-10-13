import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import express from 'express';
import request from 'supertest';
import { webTestDatabaseUrl } from '../config/web.js';
import { createCommerceRouter } from '../features/web/commerce.routes.js';
import { hashCustomerSession } from '../features/web/customer-auth.js';
import { hashSession } from '../features/web/admin-auth.js';
import { errorHandler } from '../middleware/error-handler.js';

const target = webTestDatabaseUrl(process.env);
if (target !== process.env.WEB_INTEGRATION_DATABASE_URL) throw new Error('Web test DB seçimi uyuşmuyor.');
const database = new PrismaClient({ datasourceUrl: target });
const tokenA = 'a'.repeat(64), tokenB = 'b'.repeat(64), tokenAdmin = 'c'.repeat(64), tokenEditor = 'd'.repeat(64);
let app: express.Express;
let customerA: string, customerB: string, variantId: string, grindId: string, otherGrindId: string, thermosId: string, productId: string, adminId: string;
function makeApp() { const instance = express(); instance.use('/web', createCommerceRouter(() => database)); instance.use(errorHandler); return instance; }
const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: Record<string, unknown>, token = tokenA) => {
  const call = request(app)[method](`/web${path}`).set('Authorization', `Bearer ${token}`);
  return body === undefined ? call : call.send(body);
};
const addressInput = (extra: Record<string, unknown> = {}) => ({ title: 'Ev', recipientName: 'Yerel Kontrol', phone: '0532 123 45 67', country: 'TR', provinceCode: '34', district: 'Kadıköy', neighborhood: 'Caferağa', addressLine: 'Test Sokak No: 10 Daire: 5', postalCode: '34710', isDefault: false, ...extra });
const add = (version: number, quantity = 1, extra: Record<string, unknown> = {}) => api('post', '/cart/items', { version, variantId, grindId, quantity, ...extra });
const cart = async () => (await api('get', '/cart')).body.cart;
const createAddress = async (extra: Record<string, unknown> = {}, token = tokenA) => { const result = await api('post', '/addresses', addressInput(extra), token); expect(result.status).toBe(201); return result.body.address; };
const shippingInput = (extra: Record<string, unknown> = {}) => ({ version: 1, enabled: true, feeMinor: 7500, freeShippingThresholdMinor: 100000, country: 'TR', currency: 'TRY', ...extra });
async function clear() {
  await database.webCustomer.deleteMany();
  await database.webShippingAudit.deleteMany();
  await database.webCatalogAudit.deleteMany();
  await database.webStockAdjustment.deleteMany();
  await database.webProduct.deleteMany();
  await database.webAdmin.deleteMany();
}
beforeEach(async () => {
  await clear();
  await database.webStoreSettings.upsert({ where: { id: 'store' }, create: { id: 'store' }, update: { shippingVersion: 1, shippingEnabled: true, shippingFeeMinor: null, freeShippingThresholdMinor: null } });
  for (const [email, token] of [['cart-a@example.test', tokenA], ['cart-b@example.test', tokenB]]) {
    const customer = await database.webCustomer.create({ data: { email: email!, name: 'Cart fixture', passwordHash: 'test-only', emailVerifiedAt: new Date(), sessions: { create: { tokenHash: hashCustomerSession(token!), expiresAt: new Date(Date.now() + 3600000) } } } });
    if (token === tokenA) customerA = customer.id; else customerB = customer.id;
  }
  for (const [role, token] of [['ADMIN', tokenAdmin], ['EDITOR', tokenEditor]] as const) {
    const admin = await database.webAdmin.create({ data: { email: `${role.toLowerCase()}@example.test`, name: role, role, passwordHash: 'test-only', sessions: { create: { tokenHash: hashSession(token), expiresAt: new Date(Date.now() + 3600000) } } } });
    if (role === 'ADMIN') adminId = admin.id;
  }
  const coffee = await database.webProduct.create({ data: { slug: 'cart-coffee', type: 'COFFEE', status: 'PUBLISHED', nameTr: 'Test Kahve', nameEn: 'Test Coffee',
    variants: { create: { sku: 'COFFEE-250', labelTr: '250 g', labelEn: '250 g', weightGrams: 250, priceMinor: 20000, stock: 5 } },
    grindOptions: { create: [{ code: 'beans', nameTr: 'Çekirdek', nameEn: 'Whole beans' }, { code: 'filter', nameTr: 'Filtre', nameEn: 'Filter', priceDeltaMinor: 1500 }] },
  }, include: { variants: true, grindOptions: true } });
  productId = coffee.id; variantId = coffee.variants[0]!.id; grindId = coffee.grindOptions.find((entry) => entry.code === 'beans')!.id; otherGrindId = coffee.grindOptions.find((entry) => entry.code === 'filter')!.id;
  const thermos = await database.webProduct.create({ data: { slug: 'cart-thermos', type: 'THERMOS', status: 'PUBLISHED', nameTr: 'Test Termos', nameEn: 'Test Thermos', variants: { create: { sku: 'THERMOS-ORANGE', labelTr: 'Turuncu', labelEn: 'Orange', colorNameTr: 'Turuncu', colorNameEn: 'Orange', priceMinor: 90000, stock: 3 } } }, include: { variants: true } });
  thermosId = thermos.variants[0]!.id;
  app = makeApp();
});
afterAll(async () => { await clear(); await database.$disconnect(); });

describe('account-owned persistent carts', () => {
  it('returns a private virtual empty cart without writes and rejects missing/unverified/admin/mobile sessions', async () => {
    const result = await api('get', '/cart');
    expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.cart).toMatchObject({ customerId: customerA, version: 0, lines: [], subtotalMinor: 0, itemCount: 0, shippingFeeMinor: 0, totalMinor: 0, valid: false });
    expect(await database.webCart.count()).toBe(0);
    for (const token of ['', tokenAdmin, 'eyJhbGciOi.mobile.signature']) expect((await api('get', '/cart', undefined, token)).status).toBe(401);
    await database.webCustomer.update({ where: { id: customerA }, data: { emailVerifiedAt: null } });
    expect((await api('get', '/cart')).status).toBe(401);
  });
  it('persists across router sessions, merges identical selections and prices distinct grinds from the live catalogue', async () => {
    let result = await add(0, 1); expect(result.status).toBe(200);
    expect(result.body.cart).toMatchObject({ version: 1, itemCount: 1, subtotalMinor: 20000, totalMinor: null });
    result = await add(1, 1); expect(result.body.cart.lines).toHaveLength(1); expect(result.body.cart.lines[0].quantity).toBe(2);
    result = await add(2, 1, { grindId: otherGrindId });
    expect(result.body.cart.lines).toHaveLength(2); expect(result.body.cart.subtotalMinor).toBe(61500);
    app = makeApp(); expect((await cart()).itemCount).toBe(3);
    expect((await api('get', '/cart', undefined, tokenB)).body.cart.lines).toEqual([]);
    expect(await database.webProductVariant.findUniqueOrThrow({ where: { id: variantId } })).toMatchObject({ stock: 5 });
  });
  it('enforces shared SKU stock across grind lines without reserving stock between customers', async () => {
    expect((await add(0, 3)).status).toBe(200);
    expect((await add(1, 3, { grindId: otherGrindId })).status).toBe(409);
    expect((await cart()).version).toBe(1);
    expect((await add(1, 2, { grindId: otherGrindId })).status).toBe(200);
    expect((await api('post', '/cart/items', { version: 0, variantId, grindId, quantity: 5 }, tokenB)).status).toBe(200);
    const current = await cart(); expect(current.lines.map((line: {availableQuantity: number}) => line.availableQuantity)).toEqual([3, 2]);
  });
  it('serializes concurrent adds and returns 409 for stale versions without duplicate increments', async () => {
    const results = await Promise.all([add(0), add(0)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await cart()).itemCount).toBe(1);
    expect((await add(0)).status).toBe(409);
    expect(await database.webCartItem.count()).toBe(1);
  });
  it('updates absolute quantities and deletes owned lines but never another account line', async () => {
    const first = (await add(0, 2)).body.cart.lines[0];
    expect((await api('patch', `/cart/items/${first.id}`, { version: 0, quantity: 1 }, tokenB)).status).toBe(404);
    expect((await api('delete', `/cart/items/${first.id}`, { version: 0 }, tokenB)).status).toBe(404);
    expect((await api('patch', `/cart/items/${first.id}`, { version: 1, quantity: 3 })).body.cart.itemCount).toBe(3);
    expect((await api('delete', `/cart/items/${first.id}`, { version: 1 })).status).toBe(409);
    const removed = await api('delete', `/cart/items/${first.id}`, { version: 2 });
    expect(removed.body.cart).toMatchObject({ version: 3, lines: [], totalMinor: 0 });
  });
  it('reprices persisted lines and marks lowered stock or archived selections invalid', async () => {
    await add(0, 4);
    await database.webProductVariant.update({ where: { id: variantId }, data: { priceMinor: 23000, stock: 2, labelTr: '' } });
    await database.webGrindOption.update({ where: { id: grindId }, data: { priceDeltaMinor: 500 } });
    let current = await cart(); expect(current.lines[0]).toMatchObject({ unitPriceMinor: 23500, lineTotalMinor: 94000, variantLabelTr: '250 g', issue: 'INSUFFICIENT_STOCK', availableQuantity: 2 });
    expect(current.totalMinor).toBeNull();
    await database.webProduct.update({ where: { id: productId }, data: { status: 'ARCHIVED' } });
    current = await cart(); expect(current.lines[0]).toMatchObject({ issue: 'UNAVAILABLE', unitPriceMinor: null, lineTotalMinor: null });
    expect((await add(1)).status).toBe(409);
    expect((await api('delete', `/cart/items/${current.lines[0].id}`, { version: 1 })).status).toBe(200);
  });
  it('retains unavailable snapshots when catalogue records are deleted without restrictive foreign keys', async () => {
    const added = (await add(0)).body.cart;
    await database.webProduct.delete({ where: { id: productId } });
    const current = await cart(); expect(current.lines[0]).toMatchObject({ id: added.lines[0].id, productId: null, slug: null, nameTr: 'Test Kahve', issue: 'UNAVAILABLE' });
  });
  it('allows incremental reductions after shared stock falls while retaining the invalid-cart warning', async () => {
    const added = (await add(0, 5)).body.cart;
    await database.webProductVariant.update({ where: { id: variantId }, data: { stock: 2 } });
    let result = await api('patch', `/cart/items/${added.lines[0].id}`, { version: 1, quantity: 4 });
    expect(result.status).toBe(200); expect(result.body.cart.lines[0].issue).toBe('INSUFFICIENT_STOCK'); expect(result.body.cart.totalMinor).toBeNull();
    expect((await api('patch', `/cart/items/${added.lines[0].id}`, { version: 2, quantity: 5 })).status).toBe(409);
    result = await api('patch', `/cart/items/${added.lines[0].id}`, { version: 2, quantity: 2 });
    expect(result.status).toBe(200); expect(result.body.cart.lines[0].issue).toBeNull();
  });
  it('rejects missing/inactive/foreign grinds and grinders on thermoses', async () => {
    for (const extra of [{ grindId: null }, { grindId: 'missing' }, { variantId: thermosId, grindId }, { variantId: 'missing' }]) expect((await add(0, 1, extra)).status).toBe(409);
    await database.webGrindOption.update({ where: { id: grindId }, data: { active: false } });
    expect((await add(0)).status).toBe(409);
    expect((await add(0, 1, { variantId: thermosId, grindId: null })).status).toBe(200);
  });
  it('requires every client version and rejects client prices, owners and invalid quantities', async () => {
    for (const quantity of [0, -1, 1.5, 100]) expect((await add(0, quantity)).status).toBe(400);
    for (const extra of [{ priceMinor: 1 }, { customerId: customerB }, { version: -1 }, { grindId: [] }]) expect((await add(0, 1, extra)).status).toBe(400);
    expect((await api('post', '/cart/items', { variantId, grindId, quantity: 1 })).status).toBe(400);
    expect(await database.webCart.count()).toBe(0);
  });
  it('allows only own addresses and clears selections with version changes when an address is deleted', async () => {
    const own = await createAddress(); const foreign = await createAddress({}, tokenB);
    expect((await api('put', '/cart/address', { version: 0, addressId: foreign.id })).status).toBe(404);
    let current = (await api('put', '/cart/address', { version: 0, addressId: own.id })).body.cart;
    expect(current.selectedAddressId).toBe(own.id);
    expect((await api('delete', `/addresses/${own.id}`, { version: own.version })).status).toBe(204);
    current = await cart(); expect(current.selectedAddressId).toBeNull(); expect(current.version).toBe(2);
    expect((await api('put', '/cart/address', { version: 1, addressId: null })).status).toBe(409);
  });
});

describe('Turkey delivery address ownership and concurrency', () => {
  it('normalizes a Turkish phone and sets the first address as default with safe public fields', async () => {
    const created = await createAddress();
    expect(created).toMatchObject({ phone: '+905321234567', country: 'TR', isDefault: true, version: 1 });
    expect(created.customerId).toBeUndefined();
    const result = await api('get', '/addresses'); expect(result.body.customerId).toBe(customerA); expect(result.body.addresses).toHaveLength(1);
    expect((await api('get', '/addresses', undefined, tokenB)).body.addresses).toEqual([]);
  });
  it('updates only owned addresses, rejects stale edits/deletes, and refreshes the selected cart', async () => {
    const created = await createAddress();
    await api('put', '/cart/address', { version: 0, addressId: created.id });
    expect((await api('put', `/addresses/${created.id}`, { ...addressInput(), version: 1 }, tokenB)).status).toBe(404);
    expect((await api('delete', `/addresses/${created.id}`, { version: 1 }, tokenB)).status).toBe(404);
    const updated = await api('put', `/addresses/${created.id}`, { ...addressInput({ title: 'İş', isDefault: true }), version: 1 });
    expect(updated.status).toBe(200); expect(updated.body.address.version).toBe(2); expect((await cart()).version).toBe(2);
    expect((await api('put', `/addresses/${created.id}`, { ...addressInput(), version: 1 })).status).toBe(409);
    expect((await api('delete', `/addresses/${created.id}`, { version: 1 })).status).toBe(409);
  });
  it('keeps exactly one default through concurrent additions and promotes one after deletion', async () => {
    const results = await Promise.all(['Ev', 'İş'].map((title) => api('post', '/addresses', addressInput({ title, isDefault: true }))));
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    const all = (await api('get', '/addresses')).body.addresses;
    expect(all.filter((entry: {isDefault: boolean}) => entry.isDefault)).toHaveLength(1);
    const selected = all.find((entry: {isDefault: boolean}) => entry.isDefault);
    expect((await api('delete', `/addresses/${selected.id}`, { version: selected.version })).status).toBe(204);
    expect((await api('get', '/addresses')).body.addresses[0].isDefault).toBe(true);
  });
  it('rejects unsupported countries, cities, phones and mismatched postal codes but accepts blank postal codes', async () => {
    for (const fields of [{ country: 'DE' }, { provinceCode: '00' }, { provinceCode: '82' }, { postalCode: '06000' }, { postalCode: '123' }, { phone: '+491234567890' }, { phone: '+901234567890' }, { recipientName: 'x' }, { customerId: customerB }]) expect((await api('post', '/addresses', addressInput(fields))).status).toBe(400);
    expect((await api('post', '/addresses', addressInput({ postalCode: '' }))).status).toBe(201);
  });
  it('caps address books at ten without affecting another customer', async () => {
    for (let i = 0; i < 10; i++) await createAddress({ title: `Adres ${i}` });
    expect((await api('post', '/addresses', addressInput())).status).toBe(400);
    expect((await api('post', '/addresses', addressInput(), tokenB)).status).toBe(201);
  });
  it('normalizes multiline street addresses without accepting control characters in other fields', async () => {
    const created = await createAddress({ addressLine: 'Test Sokak No:10\nDaire:5' });
    expect(created.addressLine).toBe('Test Sokak No:10 Daire:5');
    expect((await api('post', '/addresses', addressInput({ title: 'Ev\nAdres' }))).status).toBe(400);
  });
  it('validates JSON body types and bounds mutations before writes', async () => {
    const plain = await request(app).post('/web/addresses').set('Authorization', `Bearer ${tokenA}`).type('text').send(JSON.stringify(addressInput()));
    expect(plain.status).toBe(415);
    expect((await api('post', '/addresses', addressInput({ addressLine: 'x'.repeat(5000) }))).status).toBe(413);
    expect(await database.webDeliveryAddress.count()).toBe(0);
  });
});

describe('administrator configured Turkey shipping', () => {
  it('starts unconfigured without inventing a fee and permits only ADMIN to manage settings', async () => {
    const result = await request(app).get('/web/shipping');
    expect(result.body.shipping).toEqual({ version: 1, enabled: true, feeMinor: null, freeShippingThresholdMinor: null, country: 'TR', currency: 'TRY' });
    for (const token of ['', tokenA, tokenEditor]) {
      expect((await api('get', '/admin/shipping', undefined, token)).status).toBe(token === tokenEditor ? 403 : 401);
      expect((await api('put', '/admin/shipping', shippingInput(), token)).status).toBe(token === tokenEditor ? 403 : 401);
    }
    expect((await api('get', '/admin/shipping', undefined, tokenAdmin)).status).toBe(200);
  });
  it('stores and audits admin updates, rejects stale versions and exposes a safe public setting', async () => {
    const saved = await api('put', '/admin/shipping', shippingInput(), tokenAdmin);
    expect(saved.status).toBe(200); expect(saved.body.shipping.version).toBe(2);
    expect((await api('put', '/admin/shipping', shippingInput({ feeMinor: 1 }), tokenAdmin)).status).toBe(409);
    const audit = await database.webShippingAudit.findFirstOrThrow();
    expect(audit.adminId).toBe(adminId); expect(audit.before).toMatchObject({ feeMinor: null, version: 1 }); expect(audit.after).toMatchObject({ feeMinor: 7500, version: 2 });
    expect((await request(app).get('/web/shipping')).body).toEqual(saved.body);
  });
  it('computes exact-kurus totals and threshold equality while requiring an owned address', async () => {
    await api('put', '/admin/shipping', shippingInput(), tokenAdmin);
    let current = (await add(0, 4)).body.cart;
    expect(current).toMatchObject({ subtotalMinor: 80000, shippingFeeMinor: 7500, totalMinor: null, freeShippingRemainingMinor: 20000, valid: false });
    const address = await createAddress();
    current = (await api('put', '/cart/address', { version: 1, addressId: address.id })).body.cart;
    expect(current).toMatchObject({ totalMinor: 87500, valid: true });
    current = (await add(2)).body.cart;
    expect(current).toMatchObject({ subtotalMinor: 100000, shippingFeeMinor: 0, totalMinor: 100000, freeShippingRemainingMinor: 0, valid: true });
  });
  it('supports explicitly free shipping and no threshold, and invalidates totals when disabled/unconfigured', async () => {
    await api('put', '/admin/shipping', shippingInput({ feeMinor: 0, freeShippingThresholdMinor: null }), tokenAdmin);
    const address = await createAddress(); await api('put', '/cart/address', { version: 0, addressId: address.id }); await add(1);
    expect(await cart()).toMatchObject({ shippingFeeMinor: 0, totalMinor: 20000, valid: true, freeShippingRemainingMinor: null });
    await api('put', '/admin/shipping', shippingInput({ version: 2, feeMinor: 0, freeShippingThresholdMinor: 100000 }), tokenAdmin);
    expect(await cart()).toMatchObject({ shippingFeeMinor: 0, totalMinor: 20000, freeShippingRemainingMinor: 0 });
    await api('put', '/admin/shipping', shippingInput({ version: 3, enabled: false }), tokenAdmin);
    expect(await cart()).toMatchObject({ shippingFeeMinor: null, totalMinor: null, valid: false });
    await api('put', '/admin/shipping', shippingInput({ version: 4, feeMinor: null, freeShippingThresholdMinor: null }), tokenAdmin);
    expect(await cart()).toMatchObject({ shipping: { configured: false }, totalMinor: null, valid: false });
  });
  it('rejects client country/currency changes and invalid or contradictory money values', async () => {
    for (const fields of [{ country: 'US' }, { currency: 'USD' }, { feeMinor: -1 }, { feeMinor: 1.5 }, { feeMinor: 100000001 }, { freeShippingThresholdMinor: 0 }, { feeMinor: null, freeShippingThresholdMinor: 1 }, { version: 0 }]) expect((await api('put', '/admin/shipping', shippingInput(fields), tokenAdmin)).status).toBe(400);
    expect(await database.webShippingAudit.count()).toBe(0);
  });
  it('serializes concurrent shipping edits so only one matching version wins', async () => {
    const results = await Promise.all([7500, 5000].map((feeMinor) => api('put', '/admin/shipping', shippingInput({ feeMinor }), tokenAdmin)));
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await database.webShippingAudit.count()).toBe(1);
  });
});
