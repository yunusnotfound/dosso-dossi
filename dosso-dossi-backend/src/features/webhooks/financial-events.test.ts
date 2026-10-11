import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { cancelOrder } from '../admin/orders.service.js';
import { chargeQrCode, voidCharge } from '../pos/pos.service.js';
import { advanceOrderStatus } from '../orders/order-status.service.js';
import { placeOrder } from '../orders/orders.service.js';
import { kerzzPosClient } from '../orders/pos-client.js';
import { processSale } from './kerzz-sale.service.js';
import { runPosEvent } from './pos-events.service.js';

const BRANCH = 'beylikduzu-vadi-loca';
const orderInput = {
  branchId: BRANCH, pickupSlot: 'asap',
  items: [{ productId: 'caffe-latte', quantity: 2, size: '', milk: '', shot: '' }],
  payment: { method: 'dosso_card' as const }, useFreeDrink: false,
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
async function customer(freeDrinks = 0) {
  return prisma.user.create({ data: {
    phone: '5550000111', wallet: { create: { balance: 10000 } },
    loyalty: { create: { freeDrinks } }, notificationPrefs: { create: {} },
  } });
}
async function adminRequest() {
  const admin = await prisma.adminUser.create({ data: {
    email: 'event-test@example.invalid', passwordHash: 'fixture-only', role: 'SUPER_ADMIN',
  } });
  return { admin: { id: admin.id }, ip: '127.0.0.1' } as Request;
}
async function charge(userId: string) {
  const token = await prisma.qrToken.create({ data: { userId, code: 'DDPAY-test', expiresAt: new Date(Date.now() + 60000) } });
  const input = { requestId: 'charge-1', branchId: BRANCH, code: token.code, amount: 500 };
  const result = await runPosEvent({ source: 'kerzz', eventType: 'charge', externalId: input.requestId, payload: input }, (tx) => chargeQrCode(tx, input));
  return { id: result.response.chargeId as string, qrCode: token.code };
}
function sale(chargeId: string, saleId = 'sale-1', customerOverride?: { qrCode: string }) {
  const input = {
    saleId, branchId: BRANCH, customer: customerOverride ?? { chargeId },
    items: [{ productId: 'caffe-latte', quantity: 5 }],
  };
  return runPosEvent({ source: 'kerzz', eventType: 'sale', externalId: saleId, payload: input }, (tx) => processSale(tx, input));
}
function voidEvent(chargeId: string, requestId = 'void-1') {
  return runPosEvent({ source: 'kerzz', eventType: 'charge_void', externalId: requestId, payload: { chargeId } }, (tx) => voidCharge(tx, chargeId));
}
async function loyalty(userId: string) {
  return prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
}

beforeEach(() => vi.spyOn(kerzzPosClient, 'forwardOrder').mockResolvedValue(undefined));
afterEach(() => vi.restoreAllMocks());

describe('order cancellation from status events', () => {
  it('returns money and a consumed free drink atomically, once across status and admin replays', async () => {
    const user = await customer(1);
    await placeOrder(user.id, { ...orderInput, useFreeDrink: true });
    const event = (externalId: string) => runPosEvent({ source: 'kerzz', eventType: 'order_status', externalId, payload: {} },
      (tx) => advanceOrderStatus(tx, 1042, 'CANCELLED'));
    const req = await adminRequest();
    const results = await Promise.all([event('cancel-1'), event('cancel-2'), cancelOrder(req, 1042, 'Concurrent admin cancellation')]);
    expect(results).toHaveLength(3);
    expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balance)).toBe(10000);
    expect(await loyalty(user.id)).toMatchObject({ stamps: 0, freeDrinks: 1 });
    expect(await prisma.walletTransaction.count({ where: { type: 'REFUND' } })).toBe(1);
    expect(await prisma.loyaltyEvent.count({ where: { type: 'ADJUSTMENT' } })).toBe(1);
    expect((await event('cancel-1')).duplicate).toBe(true);
    expect((await cancelOrder(req, 1042, 'Replay of cancellation')).refunded).toBe(190);
  });

  it('rolls back cancellation and refund if loyalty fails, then safely retries', async () => {
    const user = await customer();
    await placeOrder(user.id, orderInput);
    // A missing loyalty account makes the journal step fail after the refund.
    await prisma.loyaltyEvent.deleteMany();
    await prisma.loyaltyAccount.delete({ where: { userId: user.id } });
    await expect(advanceOrderStatus(prisma, 1042, 'CANCELLED')).rejects.toThrow();
    expect((await prisma.order.findFirstOrThrow()).status).toBe('RECEIVED');
    expect(await prisma.walletTransaction.count({ where: { type: 'REFUND' } })).toBe(0);
    expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balance)).toBe(9620);
    await prisma.loyaltyAccount.create({ data: { userId: user.id, stamps: 2 } });
    await advanceOrderStatus(prisma, 1042, 'CANCELLED');
    expect((await prisma.order.findFirstOrThrow()).status).toBe('CANCELLED');
    expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balance)).toBe(10000);
  });
});

describe('QR sale and refund loyalty', () => {
  it.each(['chargeId', 'qrCode'])('refund reverses the linked %s sale and rejects later accrual', async (identity) => {
    const user = await customer();
    const qr = await charge(user.id);
    const customerByQr = identity === 'qrCode' ? { qrCode: qr.qrCode } : undefined;
    await sale(qr.id, 'sale-1', customerByQr);
    expect(await loyalty(user.id)).toMatchObject({ stamps: 0, freeDrinks: 1 });
    await voidEvent(qr.id);
    expect(await loyalty(user.id)).toMatchObject({ stamps: 0, freeDrinks: 0 });
    expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balance)).toBe(10000);
    const late = await sale(qr.id, 'late-sale', customerByQr);
    expect(late.response.skipped).toBe('charge_voided');
    expect((await voidEvent(qr.id)).duplicate).toBe(true);
    expect(await prisma.walletTransaction.count({ where: { chargeId: qr.id, type: 'REFUND' } })).toBe(1);
    expect(await loyalty(user.id)).toMatchObject({ stamps: 0, freeDrinks: 0 });
  });

  it('simultaneous sale and void cannot leave a reward after refund', async () => {
    const user = await customer();
    const qr = await charge(user.id);
    await Promise.all([sale(qr.id), voidEvent(qr.id)]);
    expect(await loyalty(user.id)).toMatchObject({ stamps: 0, freeDrinks: 0 });
    expect((await prisma.posCharge.findUniqueOrThrow({ where: { id: qr.id } })).status).toBe('VOIDED');
  });

  it('different sale IDs for one charge cannot grant the same purchase twice', async () => {
    const user = await customer();
    const qr = await charge(user.id);
    const results = await Promise.all([sale(qr.id, 'sale-A'), sale(qr.id, 'sale-B')]);
    expect(results.filter((result) => result.response.skipped === 'charge_sale_already_recorded')).toHaveLength(1);
    expect(await loyalty(user.id)).toMatchObject({ stamps: 0, freeDrinks: 1 });
  });

  it.each(['void-first', 'order-first'])('journal replay retains later progress and excludes every cancelled purchase (%s)', async (sequence) => {
    const user = await customer();
    const qr = await charge(user.id);
    await sale(qr.id);
    await placeOrder(user.id, orderInput);
    await placeOrder(user.id, orderInput);
    if (sequence === 'void-first') {
      await voidEvent(qr.id);
      await advanceOrderStatus(prisma, 1042, 'CANCELLED');
    } else {
      await advanceOrderStatus(prisma, 1042, 'CANCELLED');
      await voidEvent(qr.id);
    }
    expect(await loyalty(user.id)).toMatchObject({ stamps: 2, freeDrinks: 0 });
    const reversals = await prisma.loyaltyEvent.findMany({ where: { type: 'ADJUSTMENT' } });
    expect(reversals.map((event) => (event.metadata as { kind: string }).kind).sort()).toEqual(['cancel', 'void']);
  });

  it('refund also finds an older sale whose purchase metadata has no charge ID', async () => {
    const user = await customer();
    const qr = await charge(user.id);
    await sale(qr.id, 'older-sale', { qrCode: qr.qrCode });
    const purchase = await prisma.loyaltyEvent.findFirstOrThrow({ where: { type: 'STAMPS_EARNED' } });
    const { chargeId: _chargeId, ...oldMetadata } = purchase.metadata as Record<string, string | number | boolean | object>;
    await prisma.loyaltyEvent.update({ where: { id: purchase.id }, data: { metadata: JSON.parse(JSON.stringify(oldMetadata)) } });
    await voidEvent(qr.id);
    expect(await loyalty(user.id)).toMatchObject({ stamps: 0, freeDrinks: 0 });
  });
});

describe('delayed event failures', () => {
  it.each(['PROCESSED', 'SKIPPED'])('cannot overwrite a concurrent retry committed as %s', async (terminal) => {
    const reachedErrorWrite = deferred();
    const releaseErrorWrite = deferred();
    const updateMany = prisma.posEvent.updateMany.bind(prisma.posEvent);
    vi.spyOn(prisma.posEvent, 'updateMany').mockImplementation((args) => {
      if (args.data.status === 'FAILED') {
        reachedErrorWrite.resolve();
        return releaseErrorWrite.promise.then(() => updateMany(args)) as ReturnType<typeof updateMany>;
      }
      return updateMany(args);
    });
    const key = { source: 'kerzz', eventType: 'sale', externalId: 'retry-race', payload: {} };
    const failed = runPosEvent(key, async () => { throw new Error('Delayed first attempt'); }).catch((error: unknown) => error);
    await reachedErrorWrite.promise;
    const response = terminal === 'SKIPPED' ? { ok: true, skipped: 'customer_unknown' } : { ok: true, stampsEarned: 2 };
    await runPosEvent(key, async () => response);
    releaseErrorWrite.resolve();
    expect(await failed).toBeInstanceOf(Error);
    const stored = await prisma.posEvent.findFirstOrThrow({ where: { externalId: key.externalId } });
    expect(stored.status).toBe(terminal);
    expect(stored.error).toBeNull();
    const repeatedHandler = vi.fn(async () => ({ ok: true }));
    const replay = await runPosEvent(key, repeatedHandler);
    expect(replay).toEqual({ duplicate: true, response });
    expect(repeatedHandler).not.toHaveBeenCalled();
  });
});
