import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError, ErrorCodes } from '../../lib/errors.js';
import { cartSnapshot, serializeAddress } from './commerce.service.js';
import { getPaymentAvailability } from './iyzico.service.js';
import type { OrderAdminInput, OrderCreateInput, OrderListInput } from './orders.schemas.js';

export type OrderTx = Prisma.TransactionClient;
export const RESERVATION_MINUTES = 30;
export const orderInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  attempts: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] },
  audits: { orderBy: { createdAt: 'desc' as const }, take: 50 },
};
export type OrderRecord = Prisma.WebOrderGetPayload<{ include: typeof orderInclude }>;
export const orderJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const orderConflict = () => AppError.idempotencyConflict('Sipariş veya sepet değişti. Güncel bilgileri yükleyip tekrar deneyin.');
const invalid = (message: string) => new AppError(ErrorCodes.VALIDATION_ERROR, 400, message);

export async function orderTransaction<T>(database: PrismaClient, work: (tx: OrderTx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await database.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
    catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))));
      if (!retryable) throw error;
      if (attempt >= 2) throw orderConflict();
    }
  }
}
export async function lockCustomer(tx: OrderTx, customerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "WebCustomer" WHERE "id"=${customerId} FOR UPDATE`;
  const customer = await tx.webCustomer.findUnique({ where: { id: customerId } });
  if (!customer?.active || !customer.emailVerifiedAt) throw AppError.unauthorized();
  return customer;
}
export async function lockOrder(tx: OrderTx, id: string, customerId?: string) {
  await tx.$queryRaw`SELECT "id" FROM "WebOrder" WHERE "id"=${id} FOR UPDATE`;
  const order = await tx.webOrder.findFirst({ where: { id, ...(customerId ? { customerId } : {}) }, include: orderInclude });
  if (!order) throw AppError.notFound('Sipariş bulunamadı.');
  return order;
}
async function lockProducts(tx: OrderTx, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  if (unique.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "WebProduct" WHERE "id" IN (${Prisma.join(unique)}) ORDER BY "id" FOR UPDATE`);
}
const state = (order: Pick<OrderRecord, 'status' | 'paymentStatus' | 'fulfillmentStatus' | 'version'>) => ({ status: order.status, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, version: order.version });
export async function auditOrder(tx: OrderTx, orderId: string, action: string, before: unknown, note = '', adminId?: string) {
  const after = await tx.webOrder.findUniqueOrThrow({ where: { id: orderId } });
  await tx.webOrderAudit.create({ data: { orderId, action, note, adminId, before: before ? orderJson(before) : Prisma.DbNull, after: orderJson(state(after)) } });
}
export function serializeOrder(order: OrderRecord, admin = false) {
  const attempt = order.attempts[0];
  const active = order.status === 'OPEN' && order.reservationExpiresAt.getTime() > Date.now();
  const unpaid = order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED';
  const initializing = attempt?.status === 'INITIALIZING';
  const payment = getPaymentAvailability();
  return {
    id: order.id, number: order.number, version: order.version, status: order.status,
    paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus,
    currency: 'TRY' as const, subtotalMinor: order.subtotalMinor, shippingFeeMinor: order.shippingFeeMinor, totalMinor: order.totalMinor,
    customer: order.customerSnapshot, address: order.addressSnapshot,
    lines: order.items.map(({ orderId: _orderId, sortOrder: _sortOrder, ...line }) => line),
    carrier: order.carrier, trackingNumber: order.trackingNumber, createdAt: order.createdAt, updatedAt: order.updatedAt,
    reservationExpiresAt: order.reservationExpiresAt, paidAt: order.paidAt, cancelledAt: order.cancelledAt,
    shippedAt: order.shippedAt, deliveredAt: order.deliveredAt,
    canCancel: active && unpaid && !initializing,
    canPay: active && unpaid && payment.configured && (!attempt || attempt.status === 'FAILED' || (attempt.status === 'READY' && Boolean(attempt.paymentPageUrl) && Boolean(attempt.expiresAt && attempt.expiresAt.getTime() > Date.now()))),
    canRefreshPayment: Boolean(attempt?.token && (attempt.status === 'READY' || attempt.status === 'REVIEW') && order.paymentStatus !== 'PAID'),
    audits: order.audits.map(({ id, action, note, createdAt }) => ({ id, action, note: admin ? note : '', createdAt })),
  };
}
async function quoteSnapshot(tx: OrderTx, customerId: string) {
  const customer = await tx.webCustomer.findUnique({ where: { id: customerId } });
  if (!customer?.active || !customer.emailVerifiedAt) throw AppError.unauthorized();
  const cart = await cartSnapshot(tx, customerId);
  if (!cart.valid || cart.totalMinor === null || cart.shippingFeeMinor === null || !cart.selectedAddressId) throw invalid('Sipariş için geçerli ürünler, teslimat adresi ve kargo tarifesi gerekli.');
  // Payment and PostgreSQL integer limits are checked before reserving any stock.
  if (!Number.isSafeInteger(cart.totalMinor) || cart.totalMinor <= 0 || cart.totalMinor > 100000000) throw invalid('Sipariş tutarı desteklenen sınırı aşıyor.');
  const address = await tx.webDeliveryAddress.findFirstOrThrow({ where: { id: cart.selectedAddressId, customerId } });
  if (address.country !== 'TR') throw invalid('Teslimat yalnız Türkiye adreslerine yapılabilir.');
  const store = await tx.webStoreSettings.findUniqueOrThrow({ where: { id: 'store' } });
  const lines = cart.lines.map(({ availableQuantity: _availableQuantity, issue: _issue, ...line }) => line);
  const snapshot = { customerId, cartVersion: cart.version, lines, address: serializeAddress(address), shippingVersion: store.shippingVersion,
    shipping: cart.shipping, subtotalMinor: cart.subtotalMinor, shippingFeeMinor: cart.shippingFeeMinor, totalMinor: cart.totalMinor,
    customer: { name: customer.name, email: customer.email } };
  return { ...snapshot, quoteHash: hash(snapshot), currency: 'TRY' as const, payment: getPaymentAvailability(), reservationMinutes: RESERVATION_MINUTES };
}
export async function readOrderQuote(database: PrismaClient, customerId: string) {
  return database.$transaction((tx) => quoteSnapshot(tx, customerId), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function createOrder(database: PrismaClient, customerId: string, input: OrderCreateInput) {
  return orderTransaction(database, async (tx) => {
    await lockCustomer(tx, customerId);
    const requestHash = hash({ cartVersion: input.cartVersion, quoteHash: input.quoteHash, locale: input.locale });
    const existing = await tx.webOrder.findUnique({ where: { customerId_idempotencyKey: { customerId, idempotencyKey: input.idempotencyKey } }, include: orderInclude });
    if (existing) {
      if (existing.requestHash !== requestHash) throw orderConflict();
      return { order: serializeOrder(existing), created: false };
    }
    if (await tx.webOrder.count({ where: { customerId, status: 'OPEN', paymentStatus: { not: 'PAID' } } }) >= 3) throw invalid('En fazla üç ödeme bekleyen siparişiniz olabilir. Önce mevcut siparişleri tamamlayın veya iptal edin.');
    const currentCart = await tx.webCart.findUnique({ where: { customerId }, include: { items: true } });
    if (!currentCart || currentCart.version !== input.cartVersion) throw orderConflict();
    await lockProducts(tx, currentCart.items.map((line) => line.productId));
    const quote = await quoteSnapshot(tx, customerId);
    if (quote.quoteHash !== input.quoteHash) throw new AppError(ErrorCodes.PRICE_CHANGED, 409, 'Sepet, adres veya kargo bilgileri güncellendi. Yeni özeti onaylayın.');
    const quantities = new Map<string, number>();
    quote.lines.forEach((line) => quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity));
    const variants = await tx.webProductVariant.findMany({ where: { id: { in: [...quantities.keys()] } } });
    const number = `DD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(5).toString('hex').toUpperCase()}`;
    for (const [variantId, quantity] of [...quantities.entries()].sort()) {
      const variant = variants.find((item) => item.id === variantId);
      if (!variant) throw AppError.productUnavailable();
      const changed = await tx.webProductVariant.updateMany({ where: { id: variantId, active: true, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
      if (changed.count !== 1) throw AppError.productUnavailable('Sipariş için yeterli stok kalmadı.');
      await tx.webStockAdjustment.create({ data: { productId: variant.productId, variantId, sku: variant.sku, previous: variant.stock, current: variant.stock - quantity, reason: `Sipariş rezervasyonu: ${number}` } });
    }
    // An admin form with a pre-reservation absolute stock count must become stale.
    await tx.webProduct.updateMany({ where: { id: { in: [...new Set(variants.map((item) => item.productId))] } }, data: { version: { increment: 1 } } });
    const { id: _addressId, version: _addressVersion, createdAt: _addressCreated, updatedAt: _addressUpdated, isDefault: _addressDefault, ...address } = quote.address;
    const order = await tx.webOrder.create({ data: {
      number, customerId, idempotencyKey: input.idempotencyKey, requestHash, locale: input.locale,
      customerSnapshot: orderJson(quote.customer), addressSnapshot: orderJson(address), shippingSnapshot: orderJson(quote.shipping),
      subtotalMinor: quote.subtotalMinor, shippingFeeMinor: quote.shippingFeeMinor, totalMinor: quote.totalMinor,
      reservationExpiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60000),
      items: { create: quote.lines.map((line, sortOrder) => ({ productId: line.productId!, variantId: line.variantId, grindId: line.grindId,
        sku: variants.find((variant) => variant.id === line.variantId)!.sku,
        nameTr: line.nameTr, nameEn: line.nameEn, variantLabelTr: line.variantLabelTr, variantLabelEn: line.variantLabelEn,
        grindNameTr: line.grindNameTr, grindNameEn: line.grindNameEn, imageUrl: line.imageUrl, quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor!, lineTotalMinor: line.lineTotalMinor!, sortOrder })) },
    } });
    await tx.webCartItem.deleteMany({ where: { cartId: currentCart.id } });
    await tx.webCart.update({ where: { id: currentCart.id }, data: { version: { increment: 1 } } });
    await auditOrder(tx, order.id, 'CREATED', null);
    return { order: serializeOrder(await tx.webOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude })), created: true };
  });
}
export async function readOrder(database: PrismaClient, id: string, customerId?: string) {
  const order = await database.webOrder.findFirst({ where: { id, ...(customerId ? { customerId } : {}) }, include: orderInclude });
  if (!order) throw AppError.notFound('Sipariş bulunamadı.');
  return serializeOrder(order, !customerId);
}
export async function listOrders(database: PrismaClient, input: OrderListInput, customerId?: string) {
  const where: Prisma.WebOrderWhereInput = { ...(customerId ? { customerId } : {}), status: input.status, paymentStatus: input.paymentStatus, fulfillmentStatus: input.fulfillmentStatus,
    ...(input.q ? { OR: [ { number: { contains: input.q, mode: 'insensitive' } },
      { customerSnapshot: { path: ['name'], string_contains: input.q, mode: 'insensitive' } },
      { customerSnapshot: { path: ['email'], string_contains: input.q, mode: 'insensitive' } } ] } : {}),
  };
  const [total, orders] = await database.$transaction([
    database.webOrder.count({ where }),
    database.webOrder.findMany({ where, include: orderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * input.limit, take: input.limit }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { orders: orders.map((order) => serializeOrder(order, !customerId)), pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) } };
}
export async function releaseOrderStock(tx: OrderTx, order: OrderRecord, reason: string) {
  if (order.stockReleasedAt || order.paymentStatus === 'PAID') return;
  await lockProducts(tx, order.items.map((line) => line.productId));
  const quantities = new Map<string, number>();
  order.items.forEach((line) => quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity));
  for (const [variantId, quantity] of [...quantities.entries()].sort()) {
    const variant = await tx.webProductVariant.findUniqueOrThrow({ where: { id: variantId } });
    await tx.webProductVariant.update({ where: { id: variantId }, data: { stock: { increment: quantity } } });
    await tx.webStockAdjustment.create({ data: { productId: variant.productId, variantId, sku: variant.sku, previous: variant.stock, current: variant.stock + quantity, reason: `${reason}: ${order.number}` } });
  }
  await tx.webProduct.updateMany({ where: { id: { in: [...new Set(order.items.map((line) => line.productId))] } }, data: { version: { increment: 1 } } });
  await tx.webOrder.update({ where: { id: order.id }, data: { stockReleasedAt: new Date() } });
}
export async function expireLockedOrder(tx: OrderTx, order: OrderRecord, now = new Date()) {
  if (order.status !== 'OPEN' || order.paymentStatus === 'PAID' || order.reservationExpiresAt > now) return false;
  await releaseOrderStock(tx, order, 'Süresi dolan sipariş rezervasyonu');
  await tx.webOrder.update({ where: { id: order.id }, data: { status: 'EXPIRED', version: { increment: 1 } } });
  await auditOrder(tx, order.id, 'EXPIRED', state(order));
  return true;
}
export async function expireOrders(database: PrismaClient, limit = 25) {
  // A server restart may leave a provider initialization whose response was lost.
  // Never retry that charge blindly; retain the claim for manual reconciliation.
  const unknown = await database.webPaymentAttempt.findMany({ where: { status: 'INITIALIZING', createdAt: { lte: new Date(Date.now() - 90000) } }, select: { id: true, orderId: true }, take: limit });
  for (const attempt of unknown) await orderTransaction(database, async (tx) => {
    const order = await lockOrder(tx, attempt.orderId);
    const changed = await tx.webPaymentAttempt.updateMany({ where: { id: attempt.id, status: 'INITIALIZING' }, data: { status: 'REVIEW', failureCode: 'INITIALIZATION_INTERRUPTED' } });
    if (!changed.count || order.paymentStatus === 'PAID') return;
    await tx.webOrder.update({ where: { id: order.id }, data: { paymentStatus: 'REVIEW', version: { increment: 1 } } });
    await auditOrder(tx, order.id, 'PAYMENT_REVIEW', { paymentStatus: order.paymentStatus });
  });
  const expired = await database.webOrder.findMany({ where: { status: 'OPEN', paymentStatus: { not: 'PAID' }, reservationExpiresAt: { lte: new Date() } }, select: { id: true }, orderBy: { reservationExpiresAt: 'asc' }, take: limit });
  let count = 0;
  for (const { id } of expired) if (await orderTransaction(database, async (tx) => expireLockedOrder(tx, await lockOrder(tx, id)))) count++;
  return count;
}
export function startOrderMaintenance(database: () => PrismaClient) {
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try { await expireOrders(database()); } catch { console.error('Web order reservation cleanup failed; retrying on the next interval.'); }
    finally { running = false; }
  };
  void sweep();
  const timer = setInterval(() => { void sweep(); }, 30000);
  timer.unref();
  return () => clearInterval(timer);
}
export async function cancelOrder(database: PrismaClient, id: string, version: number, customerId?: string, adminId?: string, note = '') {
  return orderTransaction(database, async (tx) => {
    if (customerId) await lockCustomer(tx, customerId);
    const order = await lockOrder(tx, id, customerId);
    if (order.version !== version) throw orderConflict();
    if (!serializeOrder(order).canCancel) throw AppError.invalidStatusTransition('Bu sipariş şu anda iptal edilemez.');
    await releaseOrderStock(tx, order, 'İptal edilen sipariş rezervasyonu');
    await tx.webOrder.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } } });
    await auditOrder(tx, id, 'CANCELLED', state(order), note, adminId);
    return serializeOrder(await tx.webOrder.findUniqueOrThrow({ where: { id }, include: orderInclude }), Boolean(adminId));
  });
}
export async function manageOrder(database: PrismaClient, id: string, input: OrderAdminInput, adminId: string) {
  if (input.action === 'CANCEL') return cancelOrder(database, id, input.version, undefined, adminId, input.note);
  const action = input.action;
  return orderTransaction(database, async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.version !== input.version) throw orderConflict();
    if (order.status !== 'OPEN' || order.paymentStatus !== 'PAID' || order.stockReleasedAt) throw AppError.invalidStatusTransition('Yalnız ödemesi doğrulanmış siparişler hazırlanabilir ve gönderilebilir.');
    const target = { PREPARE: ['UNFULFILLED', 'PREPARING'], SHIP: ['PREPARING', 'SHIPPED'], DELIVER: ['SHIPPED', 'DELIVERED'] } as const;
    const [from, to] = target[action];
    if (order.fulfillmentStatus !== from) throw AppError.invalidStatusTransition();
    await tx.webOrder.update({ where: { id }, data: { fulfillmentStatus: to, version: { increment: 1 },
      ...(input.action === 'SHIP' ? { carrier: input.carrier, trackingNumber: input.trackingNumber, shippedAt: new Date() } : {}),
      ...(input.action === 'DELIVER' ? { deliveredAt: new Date(), status: 'COMPLETED' } : {}),
    } });
    await auditOrder(tx, id, input.action, state(order), input.note, adminId);
    return serializeOrder(await tx.webOrder.findUniqueOrThrow({ where: { id }, include: orderInclude }), Boolean(adminId));
  });
}
