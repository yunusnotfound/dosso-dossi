import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import express from 'express';
import request from 'supertest';
import { webTestDatabaseUrl } from '../config/web.js';
import { createCommerceRouter } from '../features/web/commerce.routes.js';
import { createWebOrdersRouter } from '../features/web/orders.routes.js';
import { hashCustomerSession } from '../features/web/customer-auth.js';
import { hashSession } from '../features/web/admin-auth.js';
import { productInclude, saveProduct, serializeProduct } from '../features/web/catalog.service.js';
import { productInput } from '../features/web/catalog.schemas.js';
import { expireOrders } from '../features/web/orders.service.js';
import { reconcilePaymentToken } from '../features/web/orders.payments.js';
import { getPaymentAvailability, initializeSandboxPayment, retrieveSandboxPayment, IyzipayError } from '../features/web/iyzico.service.js';
import { errorHandler } from '../middleware/error-handler.js';
vi.mock('../features/web/iyzico.service.js', async (original) => ({ ...await original<object>(), getPaymentAvailability: vi.fn(), initializeSandboxPayment: vi.fn(), retrieveSandboxPayment: vi.fn() }));

const target = webTestDatabaseUrl(process.env);
if (target !== process.env.WEB_INTEGRATION_DATABASE_URL) throw new Error('Web test DB selection mismatch.');
const database = new PrismaClient({ datasourceUrl: target });
const tokenA = 'o'.repeat(64), tokenB = 'p'.repeat(64), tokenAdmin = 'q'.repeat(64), tokenEditor = 'r'.repeat(64);
let app: express.Express, customerA: string, customerB: string, variantId: string, grindId: string, otherGrindId: string, productId: string, adminId: string;
function makeApp() { const instance = express(); instance.use('/web', createCommerceRouter(() => database)); instance.use('/web', createWebOrdersRouter(() => database)); instance.use(errorHandler); return instance; }
const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: Record<string, unknown>, token = tokenA) => {
  const call = request(app)[method](`/web${path}`).set('Authorization', `Bearer ${token}`);
  return body === undefined ? call : call.send(body);
};
async function clear() {
  await database.webOrder.deleteMany(); await database.webCustomer.deleteMany(); await database.webShippingAudit.deleteMany();
  await database.webCatalogAudit.deleteMany(); await database.webStockAdjustment.deleteMany(); await database.webProduct.deleteMany(); await database.webAdmin.deleteMany();
}
async function stock() { return (await database.webProductVariant.findUniqueOrThrow({ where: { id: variantId } })).stock; }
async function prepare(quantity = 1, token = tokenA) {
  const address = (await api('post', '/addresses', { title: 'Ev', recipientName: 'Test Customer', phone: '0555 000 00 01', country: 'TR', provinceCode: '34', district: 'Kadıköy', neighborhood: 'Moda', addressLine: 'Test Sokak No 1', postalCode: '34710', isDefault: false }, token)).body.address;
  const cart = (await api('get', '/cart', undefined, token)).body.cart;
  let current = (await api('put', '/cart/address', { version: cart.version, addressId: address.id }, token)).body.cart;
  current = (await api('post', '/cart/items', { version: current.version, variantId, grindId, quantity }, token)).body.cart;
  expect(current?.valid).toBe(true);
  return (await api('get', '/orders/quote', undefined, token)).body.quote;
}
const input = (quote: {cartVersion: number; quoteHash: string}, extra = {}) => ({ cartVersion: quote.cartVersion, quoteHash: quote.quoteHash, idempotencyKey: randomUUID(), locale: 'tr', ...extra });
async function create(quantity = 1, token = tokenA) {
  const quote = await prepare(quantity, token); const result = await api('post', '/orders', input(quote), token); expect(result.status).toBe(201); return result.body.order;
}
async function start(id: string, version: number) {
  vi.mocked(getPaymentAvailability).mockReturnValue({ provider: 'IYZICO', mode: 'sandbox', configured: true });
  const result = await api('post', `/orders/${id}/payment`, { version }); expect(result.status).toBe(200);
  const attempt = await database.webPaymentAttempt.findFirstOrThrow({ where: { orderId: id }, orderBy: { createdAt: 'desc' } });
  return { order: result.body.order, attempt };
}
async function resultFor(token: string, extra: Record<string, unknown> = {}) {
  const attempt = await database.webPaymentAttempt.findUniqueOrThrow({ where: { token }, include: { order: true } });
  return { status: 'SUCCESS' as const, paymentId: `test_${attempt.id}`, conversationId: attempt.conversationId, basketId: attempt.orderId, currency: 'TRY' as const,
    priceMinor: attempt.order.totalMinor, paidPriceMinor: attempt.order.totalMinor, fraudStatus: 1 as const, ...extra };
}
beforeEach(async () => {
  await clear(); vi.clearAllMocks();
  vi.mocked(getPaymentAvailability).mockReturnValue({ provider: 'IYZICO', mode: 'sandbox', configured: false });
  vi.mocked(initializeSandboxPayment).mockImplementation(async () => { const token = randomUUID(); return { token, paymentPageUrl: `https://sandbox-cpp.iyzipay.com/?token=${token}`, expiresAt: new Date(Date.now() + 900000) }; });
  vi.mocked(retrieveSandboxPayment).mockImplementation(async ({ token }) => resultFor(token));
  await database.webStoreSettings.upsert({ where: { id: 'store' }, create: { id: 'store', shippingFeeMinor: 4250 }, update: { shippingVersion: 1, shippingEnabled: true, shippingFeeMinor: 4250, freeShippingThresholdMinor: 50000 } });
  for (const [email, token] of [['orders-a@example.test', tokenA], ['orders-b@example.test', tokenB]]) {
    const customer = await database.webCustomer.create({ data: { email: email!, name: 'Order Customer', passwordHash: 'test-only', emailVerifiedAt: new Date(), sessions: { create: { tokenHash: hashCustomerSession(token!), expiresAt: new Date(Date.now() + 3600000) } } } });
    if (token === tokenA) customerA = customer.id; else customerB = customer.id;
  }
  for (const [role, token] of [['ADMIN', tokenAdmin], ['EDITOR', tokenEditor]] as const) {
    const admin = await database.webAdmin.create({ data: { email: `orders-${role.toLowerCase()}@example.test`, name: role, role, passwordHash: 'test-only', sessions: { create: { tokenHash: hashSession(token), expiresAt: new Date(Date.now() + 3600000) } } } });
    if (role === 'ADMIN') adminId = admin.id;
  }
  const product = await database.webProduct.create({ data: { slug: 'orders-coffee', type: 'COFFEE', status: 'PUBLISHED', nameTr: 'Test Kahve', nameEn: 'Test Coffee',
    variants: { create: { sku: 'ORDER-250', labelTr: '250 g', labelEn: '250 g', weightGrams: 250, priceMinor: 12550, stock: 8 } },
    grindOptions: { create: [{ code: 'beans', nameTr: 'Çekirdek', nameEn: 'Whole beans' }, { code: 'filter', nameTr: 'Filtre', nameEn: 'Filter', priceDeltaMinor: 1500 }] },
  }, include: { variants: true, grindOptions: true } });
  productId = product.id; variantId = product.variants[0]!.id; grindId = product.grindOptions[0]!.id; otherGrindId = product.grindOptions[1]!.id;
  app = makeApp();
});
afterAll(async () => { await clear(); await database.$disconnect(); });

describe('web checkout snapshots and reservations', () => {
  it('requires verified customers and refuses mobile/admin sessions, forged money/owners and invalid carts', async () => {
    for (const token of ['', tokenAdmin, 'mobile.jwt.token']) expect((await api('get', '/orders', undefined, token)).status).toBe(401);
    expect((await api('get', '/orders/quote')).status).toBe(400);
    const quote = await prepare();
    for (const extra of [{ totalMinor: 1 }, { customerId: customerB }, { currency: 'USD' }, { idempotencyKey: 'no' }]) expect((await api('post', '/orders', input(quote, extra))).status).toBe(400);
    await database.webCustomer.update({ where: { id: customerA }, data: { emailVerifiedAt: null } });
    expect((await api('post', '/orders', input(quote))).status).toBe(401); expect(await database.webOrder.count()).toBe(0);
  });
  it('snapshots exact prices, grinds, address and fees, reserves shared SKU and clears the cart atomically', async () => {
    await prepare(2);
    let cart = (await api('get', '/cart')).body.cart;
    cart = (await api('post', '/cart/items', { version: cart.version, variantId, grindId: otherGrindId, quantity: 1 })).body.cart;
    const quote = (await api('get', '/orders/quote')).body.quote;
    const result = await api('post', '/orders', input(quote)); expect(result.status).toBe(201);
    expect(result.body.order).toMatchObject({ status: 'OPEN', paymentStatus: 'PENDING', fulfillmentStatus: 'UNFULFILLED', subtotalMinor: 39150, shippingFeeMinor: 4250, totalMinor: 43400, currency: 'TRY', canPay: false, canCancel: true });
    expect(result.body.order.lines).toHaveLength(2); expect(await stock()).toBe(5); expect((await api('get', '/cart')).body.cart.itemCount).toBe(0);
    await database.webDeliveryAddress.updateMany({ data: { addressLine: 'Changed later' } });
    await database.webProductVariant.update({ where: { id: variantId }, data: { priceMinor: 1 } });
    await database.webProduct.update({ where: { id: productId }, data: { nameTr: 'Changed later' } });
    const saved = (await api('get', `/orders/${result.body.order.id}`)).body.order;
    expect(saved.address.addressLine).toBe('Test Sokak No 1'); expect(saved.lines[0].nameTr).toBe('Test Kahve'); expect(saved.totalMinor).toBe(43400);
    const raw = JSON.stringify(saved); expect(raw).not.toContain('requestHash'); expect(raw).not.toContain('token'); expect(saved.customer.email).toBe('orders-a@example.test');
  });
  it('returns one order for concurrent/repeated idempotency keys after the cart has been cleared', async () => {
    const quote = await prepare(2); const body = input(quote);
    const results = await Promise.all([api('post', '/orders', body), api('post', '/orders', body)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]); expect(results[0]!.body.order.id).toBe(results[1]!.body.order.id); expect(await stock()).toBe(6);
    expect((await api('post', '/orders', body)).status).toBe(200);
    expect((await api('post', '/orders', { ...body, locale: 'en' })).status).toBe(409); expect(await database.webOrder.count()).toBe(1);
  });
  it('rejects quotes after catalogue prices, shipping settings, address contents or cart version change', async () => {
    const quote = await prepare();
    await database.webProductVariant.update({ where: { id: variantId }, data: { priceMinor: 12600 } });
    expect((await api('post', '/orders', input(quote))).status).toBe(409);
    let fresh = (await api('get', '/orders/quote')).body.quote;
    await database.webStoreSettings.update({ where: { id: 'store' }, data: { shippingFeeMinor: 5000, shippingVersion: { increment: 1 } } });
    expect((await api('post', '/orders', input(fresh))).status).toBe(409);
    fresh = (await api('get', '/orders/quote')).body.quote;
    await database.webDeliveryAddress.updateMany({ data: { district: 'Üsküdar' } });
    expect((await api('post', '/orders', input(fresh))).status).toBe(409);
    fresh = (await api('get', '/orders/quote')).body.quote;
    expect((await api('post', '/orders', { ...input(fresh), cartVersion: 0 })).status).toBe(409);
    expect(await stock()).toBe(8); expect(await database.webOrder.count()).toBe(0);
  });
  it('never oversells when two customers compete for the final shared SKU stock', async () => {
    await database.webProductVariant.update({ where: { id: variantId }, data: { stock: 3 } });
    const quoteA = await prepare(3), quoteB = await prepare(3, tokenB);
    const results = await Promise.all([api('post', '/orders', input(quoteA)), api('post', '/orders', input(quoteB), tokenB)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1); expect(results.filter((r) => [400, 409].includes(r.status))).toHaveLength(1);
    expect(await stock()).toBe(0); expect(await database.webOrder.count()).toBe(1);
  });
  it('invalidates stale administrator absolute-stock forms after a reservation', async () => {
    const before = serializeProduct(await database.webProduct.findUniqueOrThrow({ where: { id: productId }, include: productInclude }));
    await create(2);
    const { id: _id, ...values } = before;
    const stale = productInput.parse({ ...values, status: 'DRAFT', stockReason: 'Test count', images: [] });
    await expect(saveProduct(database, stale, adminId, productId)).rejects.toMatchObject({ status: 409 }); expect(await stock()).toBe(6);
  });
  it('preserves restoration headroom when administrators adjust sellable stock during reservations', async () => {
    const order = await create(2);
    const { id: _id, ...values } = serializeProduct(await database.webProduct.findUniqueOrThrow({ where: { id: productId }, include: productInclude }));
    const changes = productInput.parse({ ...values, status: 'DRAFT', stockReason: 'Stock ceiling test', images: [], variants: values.variants.map((variant) => ({ ...variant, stock: 1000000 })) });
    await expect(saveProduct(database, changes, adminId, productId)).rejects.toMatchObject({ status: 400 });
    expect(await stock()).toBe(6);
    expect((await api('post', `/orders/${order.id}/cancel`, { version: order.version })).status).toBe(200); expect(await stock()).toBe(8);
  });
  it('blocks unset/disabled shipping and excessive order totals without writes', async () => {
    const quote = await prepare();
    await database.webStoreSettings.update({ where: { id: 'store' }, data: { shippingFeeMinor: null, freeShippingThresholdMinor: null } });
    expect((await api('post', '/orders', input(quote))).status).toBe(400);
    await database.webStoreSettings.update({ where: { id: 'store' }, data: { shippingFeeMinor: 0, shippingEnabled: false } });
    expect((await api('get', '/orders/quote')).status).toBe(400);
    await database.webStoreSettings.update({ where: { id: 'store' }, data: { shippingEnabled: true, shippingFeeMinor: 1 } });
    await database.webProductVariant.update({ where: { id: variantId }, data: { priceMinor: 100000000 } }); expect((await api('get', '/orders/quote')).status).toBe(400);
    expect(await stock()).toBe(8);
  });
  it('caps outstanding unpaid orders at three while isolating customer ownership and admin-only access', async () => {
    for (let i = 0; i < 3; i++) await create();
    const quote = await prepare(); expect((await api('post', '/orders', input(quote))).status).toBe(400);
    const listed = await api('get', '/orders'); expect(listed.body.orders).toHaveLength(3);
    const id = listed.body.orders[0].id;
    for (const path of [`/orders/${id}`, '/orders']) {
      const response = await api('get', path, undefined, tokenB); expect(response.status).toBe(path.endsWith(id) ? 404 : 200); if (path === '/orders') expect(response.body.orders).toEqual([]);
    }
    expect((await api('post', `/orders/${id}/cancel`, { version: 1 }, tokenB)).status).toBe(404);
    expect((await api('get', '/admin/orders', undefined, tokenA)).status).toBe(401);
    expect((await api('get', '/admin/orders', undefined, tokenEditor)).status).toBe(403);
    expect((await api('get', '/admin/orders', undefined, tokenAdmin)).body.pagination.total).toBe(3);
  });
  it('paginates and filters across captured customer identity and rejects unbounded queries', async () => {
    await create(); await create(1, tokenB);
    const result = await api('get', '/admin/orders?page=1&limit=1&q=orders-b&paymentStatus=PENDING', undefined, tokenAdmin);
    expect(result.body.pagination).toMatchObject({ total: 1, pages: 1, page: 1, limit: 1 }); expect(result.body.orders[0].customer.email).toBe('orders-b@example.test');
    expect((await api('get', '/orders?q=orders-b')).body.orders).toEqual([]);
    for (const query of ['limit=1000', 'page=-1', 'owner=other', 'status=PAID']) expect((await api('get', `/orders?${query}`)).status).toBe(400);
  });
  it('releases reservations exactly once on concurrent cancellation and rejects stale admin updates', async () => {
    const order = await create(3);
    const results = await Promise.all([api('post', `/orders/${order.id}/cancel`, { version: order.version }), api('patch', `/admin/orders/${order.id}`, { version: order.version, action: 'CANCEL' }, tokenAdmin)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]); expect(await stock()).toBe(8);
    expect((await api('post', `/orders/${order.id}/cancel`, { version: 2 })).status).toBe(409); expect(await stock()).toBe(8);
    expect(await database.webStockAdjustment.count({ where: { reason: { startsWith: 'İptal' } } })).toBe(1);
  });
  it('expires unpaid reservations after restart and does not release stock twice', async () => {
    const order = await create(3); await database.webOrder.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(Date.now() - 1) } });
    await Promise.all([expireOrders(database), expireOrders(database)]); expect(await stock()).toBe(8);
    expect((await api('get', `/orders/${order.id}`)).body.order).toMatchObject({ status: 'EXPIRED', paymentStatus: 'PENDING', canCancel: false, canPay: false });
    await expireOrders(database); expect(await stock()).toBe(8);
  });
  it('cannot manually mark unpaid orders paid, prepared or shipped and hides internal notes from customers', async () => {
    const order = await create();
    for (const action of ['PREPARE', 'DELIVER']) expect((await api('patch', `/admin/orders/${order.id}`, { version: 1, action }, tokenAdmin)).status).toBe(409);
    expect((await api('patch', `/admin/orders/${order.id}`, { version: 1, action: 'PAID' }, tokenAdmin)).status).toBe(400);
    const cancelled = await api('patch', `/admin/orders/${order.id}`, { version: 1, action: 'CANCEL', note: 'Internal test note' }, tokenAdmin);
    expect(cancelled.status).toBe(200); expect(cancelled.body.order.audits[0].note).toBe('Internal test note');
    expect((await api('get', `/orders/${order.id}`)).body.order.audits.every((audit: {note: string}) => !audit.note)).toBe(true);
  });
});

describe('sandbox payment reconciliation and order tracking', () => {
  it('retains an honest unpaid order without credentials and never calls the provider', async () => {
    const order = await create(); expect((await api('post', `/orders/${order.id}/payment`, { version: 1 })).status).toBe(503);
    expect(initializeSandboxPayment).not.toHaveBeenCalled(); expect(await database.webPaymentAttempt.count()).toBe(0);
    expect((await api('get', `/orders/${order.id}`)).body.order.paymentStatus).toBe('PENDING');
  });
  it('initializes only once, reuses the hosted URL and exposes no token or provider credentials in DTOs', async () => {
    const order = await create(); const ready = await start(order.id, order.version);
    const replay = await api('post', `/orders/${order.id}/payment`, { version: ready.order.version });
    expect(replay.status).toBe(200); expect(initializeSandboxPayment).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(replay.body.order)).not.toContain(ready.attempt.token!);
    expect(replay.body.payment.paymentPageUrl).toContain('https://sandbox-cpp.iyzipay.com/');
  });
  it('accepts only server-retrieved payment evidence, redirects without token and ignores duplicate callbacks after shipment', async () => {
    const order = await create(); const ready = await start(order.id, order.version);
    let callback = await request(app).post('/web/payments/iyzico/callback').type('form').send({ token: ready.attempt.token });
    expect(callback.status).toBe(303); expect(callback.headers.location).toBe(`http://127.0.0.1:4000/hesabim/siparislerim/${order.id}`);
    let current = (await api('get', `/orders/${order.id}`)).body.order; expect(current.paymentStatus).toBe('PAID'); expect(current.canCancel).toBe(false);
    current = (await api('patch', `/admin/orders/${order.id}`, { version: current.version, action: 'PREPARE' }, tokenAdmin)).body.order;
    expect(current.fulfillmentStatus).toBe('PREPARING');
    expect((await api('patch', `/admin/orders/${order.id}`, { version: current.version, action: 'SHIP' }, tokenAdmin)).status).toBe(400);
    current = (await api('patch', `/admin/orders/${order.id}`, { version: current.version, action: 'SHIP', carrier: 'Test Kargo', trackingNumber: 'TEST123' }, tokenAdmin)).body.order;
    expect(current).toMatchObject({ fulfillmentStatus: 'SHIPPED', carrier: 'Test Kargo', trackingNumber: 'TEST123' });
    callback = await request(app).post('/web/payments/iyzico/callback').type('form').send({ token: ready.attempt.token }); expect(callback.status).toBe(303);
    expect((await api('get', `/orders/${order.id}`)).body.order).toMatchObject({ version: current.version, paymentStatus: 'PAID', fulfillmentStatus: 'SHIPPED' });
    current = (await api('patch', `/admin/orders/${order.id}`, { version: current.version, action: 'DELIVER' }, tokenAdmin)).body.order;
    expect(current).toMatchObject({ status: 'COMPLETED', fulfillmentStatus: 'DELIVERED', paymentStatus: 'PAID' });
    await database.webOrder.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(0) } }); await expireOrders(database); expect(await stock()).toBe(7);
  });
  it('does not trust callback paid flags, unknown tokens, JSON bodies or client payment IDs', async () => {
    const order = await create(); const ready = await start(order.id, order.version);
    expect((await request(app).post('/web/payments/iyzico/callback').type('form').send({ token: ready.attempt.token, status: 'success' })).status).toBe(400);
    expect((await request(app).post('/web/payments/iyzico/callback').send({ token: ready.attempt.token })).status).toBe(415);
    expect((await request(app).post('/web/payments/iyzico/callback').type('form').send({ token: randomUUID() })).status).toBe(404);
    expect(retrieveSandboxPayment).not.toHaveBeenCalled(); expect((await api('post', `/orders/${order.id}/payment/refresh`, { version: ready.order.version, paymentId: 'forged' })).status).toBe(400);
  });
  it('blocks duplicate initialization on ambiguous provider failures and flags abandoned initializations after restart', async () => {
    const order = await create(); vi.mocked(getPaymentAvailability).mockReturnValue({ provider: 'IYZICO', mode: 'sandbox', configured: true });
    vi.mocked(initializeSandboxPayment).mockRejectedValueOnce(new IyzipayError('AMBIGUOUS'));
    expect((await api('post', `/orders/${order.id}/payment`, { version: order.version })).status).toBe(502);
    const current = (await api('get', `/orders/${order.id}`)).body.order; expect(current).toMatchObject({ paymentStatus: 'REVIEW', canPay: false, canCancel: false });
    expect((await api('post', `/orders/${order.id}/payment`, { version: current.version })).status).toBe(409); expect(initializeSandboxPayment).toHaveBeenCalledTimes(1);
    const second = await create(); await database.webPaymentAttempt.create({ data: { orderId: second.id, conversationId: randomUUID(), createdAt: new Date(Date.now() - 100000) } });
    await expireOrders(database); expect((await api('get', `/orders/${second.id}`)).body.order.paymentStatus).toBe('REVIEW');
  });
  it('holds a fraudulent/pending result for review without allowing a new payment or cancellation', async () => {
    const order = await create(); const ready = await start(order.id, 1);
    vi.mocked(retrieveSandboxPayment).mockImplementation(async ({ token }) => resultFor(token, { status: 'PENDING', fraudStatus: 0 }));
    await reconcilePaymentToken(database, ready.attempt.token!);
    const current = (await api('get', `/orders/${order.id}`)).body.order; expect(current).toMatchObject({ paymentStatus: 'REVIEW', canPay: false, canCancel: false, canRefreshPayment: true });
    expect((await api('patch', `/admin/orders/${order.id}`, { version: current.version, action: 'PREPARE' }, tokenAdmin)).status).toBe(409);
  });
  it('requires matching provider money/correlation and treats invalid signatures as review', async () => {
    const order = await create(); const ready = await start(order.id, 1);
    vi.mocked(retrieveSandboxPayment).mockImplementationOnce(async ({ token }) => resultFor(token, { paidPriceMinor: 1 }));
    await reconcilePaymentToken(database, ready.attempt.token!); expect((await api('get', `/orders/${order.id}`)).body.order.paymentStatus).toBe('REVIEW');
    vi.mocked(retrieveSandboxPayment).mockRejectedValueOnce(new IyzipayError('INVALID_RESPONSE'));
    await expect(reconcilePaymentToken(database, ready.attempt.token!)).rejects.toMatchObject({ status: 502 }); expect(await stock()).toBe(7);
  });
  it('flags late successful payment after expiry or cancellation without reclaiming released stock', async () => {
    const order = await create(2); const ready = await start(order.id, 1);
    await database.webOrder.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(0) } });
    await reconcilePaymentToken(database, ready.attempt.token!);
    const expired = (await api('get', `/orders/${order.id}`)).body.order; expect(expired).toMatchObject({ status: 'EXPIRED', paymentStatus: 'REVIEW', paidAt: null }); expect(await stock()).toBe(8);
    const second = await create(); const pending = await start(second.id, 1);
    expect((await api('post', `/orders/${second.id}/cancel`, { version: pending.order.version })).status).toBe(200);
    await reconcilePaymentToken(database, pending.attempt.token!); expect((await api('get', `/orders/${second.id}`)).body.order).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REVIEW' }); expect(await stock()).toBe(8);
  });
  it('does not let a stale failed attempt overwrite a newer ready payment or downgrade a paid shipment', async () => {
    const order = await create(); const first = await start(order.id, 1);
    vi.mocked(retrieveSandboxPayment).mockImplementationOnce(async ({ token }) => resultFor(token, { status: 'FAILURE', fraudStatus: -1 }));
    await reconcilePaymentToken(database, first.attempt.token!);
    let current = (await api('get', `/orders/${order.id}`)).body.order;
    const second = await start(order.id, current.version);
    vi.mocked(retrieveSandboxPayment).mockImplementationOnce(async ({ token }) => resultFor(token, { status: 'FAILURE', fraudStatus: -1 }));
    await reconcilePaymentToken(database, first.attempt.token!);
    current = (await api('get', `/orders/${order.id}`)).body.order; expect(current).toMatchObject({ paymentStatus: 'PENDING', version: second.order.version });
    await reconcilePaymentToken(database, second.attempt.token!);
    current = (await api('get', `/orders/${order.id}`)).body.order;
    current = (await api('patch', `/admin/orders/${order.id}`, { version: current.version, action: 'PREPARE' }, tokenAdmin)).body.order;
    await reconcilePaymentToken(database, first.attempt.token!);
    expect((await api('get', `/orders/${order.id}`)).body.order).toMatchObject({ paymentStatus: 'PAID', fulfillmentStatus: 'PREPARING' });
    expect(await database.webPaymentAttempt.findUniqueOrThrow({ where: { id: first.attempt.id } })).toMatchObject({ status: 'REVIEW', failureCode: 'ADDITIONAL_PAYMENT' });
  });
  it('never offers an expired hosted payment URL and still allows explicit unpaid cancellation', async () => {
    const order = await create(); const ready = await start(order.id, 1);
    await database.webPaymentAttempt.update({ where: { id: ready.attempt.id }, data: { expiresAt: new Date(0) } });
    const current = (await api('get', `/orders/${order.id}`)).body.order; expect(current).toMatchObject({ canPay: false, canCancel: true });
    expect((await api('post', `/orders/${order.id}/payment`, { version: current.version })).status).toBe(409);
  });
});
