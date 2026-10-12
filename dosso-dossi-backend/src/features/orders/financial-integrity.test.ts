import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../middleware/auth.js';
import { smsProvider } from '../../lib/sms/dev-sms-provider.js';
import { applyLoyalty } from '../loyalty/loyalty-apply.js';
import { cancelOrder, getOrderDetail, listOrders } from '../admin/orders.service.js';
import { adjustBalance, adjustLoyalty } from '../admin/customers.service.js';
import { sendGift } from '../gifts/gifts.service.js';
import { paymentProvider } from '../wallet/payments/dev-payment-provider.js';
import { confirmTopUp } from '../wallet/payments/topup.service.js';
import { placeOrder } from './orders.service.js';
import { kerzzPosClient } from './pos-client.js';

const app = createApp();
const body = {
  branchId: 'beylikduzu-vadi-loca', pickupSlot: 'asap',
  items: [{ productId: 'caffe-latte', quantity: 1, size: '', milk: '', shot: '' }],
  payment: { method: 'dosso_card' as const }, useFreeDrink: false,
};
async function user(balance = 1000, freeDrinks = 0, phone = '5550000001') {
  return prisma.user.create({ data: {
    phone, wallet: { create: { balance } }, loyalty: { create: { freeDrinks } },
    notificationPrefs: { create: {} },
  } });
}
async function adminReq() {
  const admin = await prisma.adminUser.create({ data: {
    email: 'financial-test@example.invalid', passwordHash: 'fixture-only', role: 'SUPER_ADMIN',
  } });
  return { admin: { id: admin.id }, ip: '127.0.0.1' } as Request;
}
async function balance(userId: string) {
  return Number((await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balance);
}
function post(path: string, userId: string, value: object) {
  return request(app).post(path).set('Authorization', `Bearer ${signToken(userId)}`).send(value);
}
beforeEach(() => vi.spyOn(kerzzPosClient, 'forwardOrder').mockResolvedValue(undefined));
afterEach(() => vi.restoreAllMocks());

describe('financial integrity under concurrent requests', () => {
  it('ten cancels return one refund and both ledger entries stay linked', async () => {
    const u = await user();
    await placeOrder(u.id, body);
    const req = await adminReq();
    const results = await Promise.all(Array.from({ length: 10 }, () => cancelOrder(req, 1042, 'Fixture cancellation')));
    expect(results.every((r) => r.refunded === 190)).toBe(true);
    expect(await balance(u.id)).toBe(1000);
    expect(await prisma.walletTransaction.count({ where: { type: 'REFUND' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'order.cancel' } })).toBe(1);
    const detail = await getOrderDetail(1042);
    expect(detail.walletTransactions.map((t) => t.type).sort()).toEqual(['ORDER_PAYMENT', 'REFUND']);
  });

  it('one free drink cannot pay for ten distinct simultaneous orders', async () => {
    const u = await user(1000, 1);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => placeOrder(u.id, { ...body, useFreeDrink: true })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).freeDrinks).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it('different first payment confirmations award only one first-load bonus', async () => {
    const u = await user(0);
    const intents = await Promise.all(Array.from({ length: 10 }, () => prisma.paymentIntent.create({
      data: { userId: u.id, amount: 1000, provider: 'test' },
    })));
    await Promise.all(intents.map((intent) => confirmTopUp(intent.id)));
    expect(await balance(u.id)).toBe(10000);
    expect((await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).freeDrinks).toBe(5);
    expect(await prisma.loyaltyEvent.count({ where: { type: 'TOPUP_BONUS' } })).toBe(1);
  });

  it('ten independent loyalty accruals retain every stamp', async () => {
    const u = await user();
    await Promise.all(Array.from({ length: 10 }, () => prisma.$transaction((tx) => applyLoyalty(tx, u.id, {
      stampsEarned: 1, sourceTitle: 'Concurrent fixture',
    }))));
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 0, freeDrinks: 2 });
    expect(await prisma.loyaltyEvent.count({ where: { type: 'STAMPS_EARNED' } })).toBe(10);
  });

  it('concurrent negative adjustments cannot overdraw the wallet', async () => {
    const u = await user(100);
    const req = await adminReq();
    const results = await Promise.allSettled([adjustBalance(req, u.id, -80, 'Fixture A'), adjustBalance(req, u.id, -80, 'Fixture B')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance(u.id)).toBe(20);
    expect(await prisma.walletTransaction.count()).toBe(1);
  });

  it('cancelling an earlier order keeps progress earned by a later order', async () => {
    const u = await user(2000);
    await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { stamps: 4 } });
    await placeOrder(u.id, { ...body, items: [{ ...body.items[0]!, quantity: 2 }] });
    await placeOrder(u.id, { ...body, items: [{ ...body.items[0]!, quantity: 2 }] });
    await cancelOrder(await adminReq(), 1042, 'Earlier order cancelled');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 1, freeDrinks: 1 });
  });

  it('completed existing cards adopt a new target without losing overflow stamps', async () => {
    const u = await user();
    await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { stamps: 4, target: 5 } });
    await prisma.setting.create({ data: { key: 'loyalty.stampTarget', value: 7 } });
    await prisma.$transaction((tx) => applyLoyalty(tx, u.id, { stampsEarned: 3, sourceTitle: 'Target transition' }));
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 2, target: 7, freeDrinks: 1 });
  });

  it('cancelling the target-changing order restores its previous card progress', async () => {
    const u = await user();
    await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { stamps: 4, target: 5 } });
    await prisma.setting.create({ data: { key: 'loyalty.stampTarget', value: 7 } });
    await placeOrder(u.id, body);
    await cancelOrder(await adminReq(), 1042, 'Target-changing order cancelled');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 4, target: 5, freeDrinks: 0 });
  });

  it('cancellation replays later completed cycles using their original configured targets', async () => {
    const u = await user(10000);
    await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { stamps: 4, target: 5 } });
    await prisma.setting.create({ data: { key: 'loyalty.stampTarget', value: 7 } });
    await placeOrder(u.id, body);
    await placeOrder(u.id, { ...body, items: [{ ...body.items[0]!, quantity: 7 }] });
    await cancelOrder(await adminReq(), 1042, 'Previous cycle cancelled');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 6, target: 7, freeDrinks: 1 });
  });

  it('later gifted rights and their use survive cancellation of an earlier earned reward', async () => {
    const recipient = await user(10000);
    const sender = await user(10000, 0, '5550000002');
    await placeOrder(recipient.id, { ...body, items: [{ ...body.items[0]!, quantity: 5 }] });
    await sendGift(sender.id, { recipientPhone: recipient.phone, type: 'drink', productId: 'caffe-latte', note: '' });
    await placeOrder(recipient.id, { ...body, useFreeDrink: true });
    await cancelOrder(await adminReq(), 1042, 'Earlier earned reward cancelled');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: recipient.id } })).toMatchObject({ stamps: 1, target: 5, freeDrinks: 0 });
    expect(await prisma.gift.count({ where: { status: 'REDEEMED' } })).toBe(1);
  });

  it('later absolute admin adjustments retain their intended values during replay', async () => {
    const u = await user();
    await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { stamps: 4, target: 5 } });
    await prisma.setting.create({ data: { key: 'loyalty.stampTarget', value: 7 } });
    await placeOrder(u.id, body);
    const req = await adminReq();
    await adjustLoyalty(req, u.id, { stamps: 3, freeDrinks: 5 }, 'Explicit admin correction');
    await cancelOrder(req, 1042, 'Earlier order cancelled');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 3, target: 7, freeDrinks: 5 });
  });

  it('already consumed earned rewards never become negative after cancellation', async () => {
    const u = await user(10000);
    await placeOrder(u.id, { ...body, items: [{ ...body.items[0]!, quantity: 5 }] });
    await placeOrder(u.id, { ...body, useFreeDrink: true });
    await cancelOrder(await adminReq(), 1042, 'Previously consumed reward cancellation');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 1, freeDrinks: 0 });
  });

  it('unknown later history is explicitly flagged instead of silently replayed', async () => {
    const u = await user();
    await placeOrder(u.id, body);
    const account = await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { freeDrinks: { increment: 3 } } });
    await prisma.loyaltyEvent.create({ data: { accountId: account.id, type: 'ADJUSTMENT', title: 'Legacy import without structured data' } });
    await cancelOrder(await adminReq(), 1042, 'Mixed history cancellation');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'order.cancel' } });
    expect(audit.after).toMatchObject({ loyaltyReversalMode: 'mixed_history', loyaltyReviewRequired: true });
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 0, freeDrinks: 3 });
  });

  it('unlogged account changes between structured events are preserved and flagged', async () => {
    const u = await user(10000);
    await placeOrder(u.id, body);
    await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { freeDrinks: { increment: 3 } } });
    await placeOrder(u.id, { ...body, useFreeDrink: true });
    await cancelOrder(await adminReq(), 1043, 'Return drink after legacy balance update');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 1, freeDrinks: 3 });
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: 'order.cancel' } })).after)
      .toMatchObject({ loyaltyReversalMode: 'mixed_history', loyaltyReviewRequired: true });
  });

  it('unlogged account changes after the final event are preserved and flagged', async () => {
    const u = await user();
    await placeOrder(u.id, body);
    await prisma.loyaltyAccount.update({ where: { userId: u.id }, data: { freeDrinks: { increment: 2 } } });
    await cancelOrder(await adminReq(), 1042, 'Cancellation after unlogged legacy change');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 0, freeDrinks: 2 });
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: 'order.cancel' } })).after)
      .toMatchObject({ loyaltyReversalMode: 'mixed_history', loyaltyReviewRequired: true });
  });

  it('subsequent cancellations replay the journal without resurrecting previously cancelled orders', async () => {
    const u = await user(10000);
    const req = await adminReq();
    await placeOrder(u.id, { ...body, items: [{ ...body.items[0]!, quantity: 5 }] });
    await placeOrder(u.id, body);
    await cancelOrder(req, 1042, 'First order cancellation');
    await placeOrder(u.id, body);
    await cancelOrder(req, 1043, 'Second order cancellation');
    expect(await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ stamps: 1, freeDrinks: 0 });
    const audits = await prisma.auditLog.findMany({ where: { action: 'order.cancel' } });
    expect(audits.every((row) => (row.after as { loyaltyReversalMode: string }).loyaltyReversalMode === 'journal')).toBe(true);
  });
});

describe('client intent idempotency', () => {
  it('ten identical requests create one order and one debit, then conflict on changed content', async () => {
    const u = await user();
    const idempotencyKey = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, () => post('/orders', u.id, { ...body, idempotencyKey })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await balance(u.id)).toBe(810);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.walletTransaction.count()).toBe(1);
    const conflict = await post('/orders', u.id, { ...body, idempotencyKey, pickupSlot: '14:30' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('an explicit new intent can order the same basket again', async () => {
    const u = await user();
    await post('/orders', u.id, { ...body, idempotencyKey: randomUUID() });
    await post('/orders', u.id, { ...body, idempotencyKey: randomUUID() });
    expect(await prisma.order.count()).toBe(2);
    expect(await balance(u.id)).toBe(620);
  });

  it('a shared gift request key creates one gift and one notification', async () => {
    const u = await user();
    const sms = vi.spyOn(smsProvider, 'send');
    const idempotencyKey = randomUUID();
    const payload = { recipientPhone: '5550000002', type: 'balance', amount: 20, idempotencyKey };
    const results = await Promise.all(Array.from({ length: 10 }, () => post('/gifts', u.id, payload)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await prisma.gift.count()).toBe(1);
    expect(await balance(u.id)).toBe(980);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  it('an SMS error after gift commit can be retried without another debit', async () => {
    const u = await user();
    const sms = vi.spyOn(smsProvider, 'send').mockRejectedValue(new Error('Fixture delivery failure'));
    const payload = { recipientPhone: '5550000002', type: 'balance', amount: 20, idempotencyKey: randomUUID() };
    expect((await post('/gifts', u.id, payload)).status).toBe(500);
    expect((await post('/gifts', u.id, payload)).status).toBe(201);
    expect(await balance(u.id)).toBe(980);
    expect(await prisma.gift.count()).toBe(1);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  it('topup repeats share one durable intent and call the provider once', async () => {
    const u = await user(0);
    const provider = vi.spyOn(paymentProvider, 'createPayment');
    const idempotencyKey = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, () => post('/me/wallet/topup', u.id, { amount: 1000, idempotencyKey })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.paymentId)).size).toBe(1);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await prisma.paymentIntent.count()).toBe(1);
    expect(await balance(u.id)).toBe(1000);
    const replay = await post('/me/wallet/topup', u.id, { amount: 1000, idempotencyKey });
    expect(replay.body.status).toBe('succeeded');
    const changed = await post('/me/wallet/topup', u.id, { amount: 2000, idempotencyKey });
    expect(changed.status).toBe(409);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('payment reconciliation is owner-scoped and does not charge', async () => {
    const u = await user(0);
    const other = await user(0, 0, '5550000002');
    const topup = await post('/me/wallet/topup', u.id, { amount: 100, idempotencyKey: randomUUID() });
    const owner = await request(app).get(`/me/wallet/payments/${topup.body.paymentId}`).set('Authorization', `Bearer ${signToken(u.id)}`);
    expect(owner.body).toMatchObject({ status: 'succeeded', balance: 100 });
    const stranger = await request(app).get(`/me/wallet/payments/${topup.body.paymentId}`).set('Authorization', `Bearer ${signToken(other.id)}`);
    expect(stranger.status).toBe(404);
  });

  it('an ambiguous provider failure preserves the intent instead of retrying a charge', async () => {
    const u = await user(0);
    const provider = vi.spyOn(paymentProvider, 'createPayment').mockRejectedValue(new Error('Fixture uncertain provider result'));
    const payload = { amount: 100, idempotencyKey: randomUUID() };
    expect((await post('/me/wallet/topup', u.id, payload)).status).toBe(500);
    const retry = await post('/me/wallet/topup', u.id, payload);
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('pending');
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await prisma.paymentIntent.count()).toBe(1);
    expect(await balance(u.id)).toBe(0);
  });
});

describe('money precision, pricing and gift eligibility', () => {
  it('fractional-cent transfer and topup inputs fail before any financial mutation', async () => {
    const u = await user(1);
    expect((await post('/gifts', u.id, { recipientPhone: '5550000002', type: 'balance', amount: 0.005 })).status).toBe(400);
    expect((await post('/me/wallet/topup', u.id, { amount: 1.005 })).status).toBe(400);
    expect(await balance(u.id)).toBe(1);
    expect(await prisma.gift.count()).toBe(0);
    expect(await prisma.paymentIntent.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('price changes are returned before any debit and can be explicitly re-approved', async () => {
    const u = await user();
    await prisma.branchProduct.create({ data: { branchId: body.branchId, productId: 'caffe-latte', priceOverride: 210 } });
    const rejected = await post('/orders', u.id, { ...body, expectedTotal: 190, idempotencyKey: randomUUID() });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error).toMatchObject({ code: 'PRICE_CHANGED', details: { total: 210 } });
    expect(await balance(u.id)).toBe(1000);
    expect(await prisma.order.count()).toBe(0);
    const accepted = await post('/orders', u.id, { ...body, expectedTotal: 210, idempotencyKey: randomUUID() });
    expect(accepted.status).toBe(201);
    expect(await balance(u.id)).toBe(790);
  });

  it('gift price changes require consent before debiting', async () => {
    const u = await user();
    await prisma.product.update({ where: { id: 'caffe-latte' }, data: { price: 210 } });
    const rejected = await post('/gifts', u.id, { recipientPhone: '5550000002', type: 'drink', productId: 'caffe-latte', expectedTotal: 190, idempotencyKey: randomUUID() });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error).toMatchObject({ code: 'PRICE_CHANGED', details: { total: 210 } });
    expect(await balance(u.id)).toBe(1000);
    expect(await prisma.gift.count()).toBe(0);
  });

  it('discounts are calculated with decimal cents and the ledger matches the debit', async () => {
    const u = await user(100);
    await prisma.product.update({ where: { id: 'caffe-latte' }, data: { price: 10.15 } });
    const order = await placeOrder(u.id, { ...body, promoCode: 'DOSSO10' });
    expect(order).toMatchObject({ subtotal: 10.15, discount: 1.02, total: 9.13 });
    expect(await balance(u.id)).toBe(90.87);
    const movement = await prisma.walletTransaction.findFirstOrThrow();
    expect(Number(movement.amount)).toBe(-9.13);
    expect(Number(movement.balanceAfter)).toBe(90.87);
  });

  it('inactive options cannot silently become free and group names do not collide', async () => {
    const u = await user();
    await prisma.productOption.updateMany({ where: { group: 'milk', name: 'Yulaf sütü' }, data: { isActive: false } });
    await prisma.productOption.create({ data: { group: 'shot', name: 'Yulaf sütü', priceDelta: 15 } });
    const rejected = await post('/orders', u.id, { ...body, items: [{ ...body.items[0]!, milk: 'Yulaf sütü' }] });
    expect(rejected.status).toBe(400);
    expect(await balance(u.id)).toBe(1000);
    const standard = await post('/orders', u.id, { ...body, items: [{ ...body.items[0]!, milk: 'Normal süt', shot: 'Tek shot' }] });
    expect(standard.body.total).toBe(190);
  });

  it('branch catalog exposes its actual price and hides unavailable products', async () => {
    await prisma.branchProduct.createMany({ data: [
      { branchId: body.branchId, productId: 'caffe-latte', priceOverride: 210 },
      { branchId: body.branchId, productId: 'caramel-macchiato', isAvailable: false },
    ] });
    const catalog = await request(app).get(`/menu/products?branchId=${body.branchId}`);
    expect(catalog.body.find((p: { id: string }) => p.id === 'caffe-latte').price).toBe(210);
    expect(catalog.body.some((p: { id: string }) => p.id === 'caramel-macchiato')).toBe(false);
    const global = await request(app).get('/menu/products');
    expect(global.body.find((p: { id: string }) => p.id === 'caffe-latte').price).toBe(190);
    const options = await request(app).get('/menu/options');
    expect(options.body).toEqual(expect.arrayContaining([expect.objectContaining({ group: 'milk', name: 'Yulaf sütü', priceDelta: 60 })]));
  });

  it('non-drink gifts are rejected while eligible gifts declare the general coffee benefit', async () => {
    const u = await user();
    const rejected = await post('/gifts', u.id, { recipientPhone: u.phone, type: 'drink', productId: 'mug-konik' });
    expect(rejected.status).toBe(409);
    expect(await balance(u.id)).toBe(1000);
    const accepted = await post('/gifts', u.id, { recipientPhone: u.phone, type: 'drink', productId: 'caffe-latte', idempotencyKey: randomUUID() });
    expect(accepted.status).toBe(201);
    expect(accepted.body.benefit).toBe('free_drink');
    expect((await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: u.id } })).freeDrinks).toBe(1);
  });

  it('opposite-direction account gifts acquire account locks in one order', async () => {
    const a = await user(100);
    const b = await user(100, 0, '5550000002');
    await Promise.all([
      sendGift(a.id, { recipientPhone: b.phone, type: 'balance', amount: 10, note: '', idempotencyKey: randomUUID() }),
      sendGift(b.id, { recipientPhone: a.phone, type: 'balance', amount: 10, note: '', idempotencyKey: randomUUID() }),
    ]);
    expect(await balance(a.id)).toBe(100);
    expect(await balance(b.id)).toBe(100);
    expect(await prisma.gift.count({ where: { status: 'REDEEMED' } })).toBe(2);
  });

  it('active board filtering excludes completed work before pagination', async () => {
    const u = await user(10000);
    await placeOrder(u.id, body);
    for (let i = 0; i < 30; i++) {
      const order = await placeOrder(u.id, body);
      await prisma.order.update({ where: { number: Number(order.id.slice(3)) }, data: { status: 'COMPLETED' } });
    }
    const board = await listOrders({ activeOnly: true, pageSize: 25 });
    expect(board.total).toBe(1);
    expect(board.orders[0]?.id).toBe('DD-1042');
    expect((await listOrders({ activeOnly: true, status: 'COMPLETED' })).total).toBe(0);
    expect((await listOrders({ q: 'No customer match' })).total).toBe(0);
  });
});
