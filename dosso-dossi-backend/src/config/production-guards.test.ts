import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { DevSmsProvider } from '../lib/sms/dev-sms-provider.js';
import { DevPaymentProvider } from '../features/wallet/payments/dev-payment-provider.js';
import { kerzzPosClient, startForwardSweep } from '../features/orders/pos-client.js';
import { env } from './env.js';

const original = { ...env };
const app = createApp();

function productionMode() {
  Object.assign(env, {
    NODE_ENV: 'production', PAYMENT_PROVIDER: 'disabled', SMS_PROVIDER: 'disabled',
    POS_PROVIDER: 'disabled', OTP_DEV_MODE: false,
  });
}

async function customerToken() {
  const user = await prisma.user.create({
    data: {
      phone: '5550000001', wallet: { create: { balance: 500 } },
      loyalty: { create: {} }, notificationPrefs: { create: {} },
    },
  });
  return signToken(user.id);
}

afterEach(() => {
  Object.assign(env, original);
  vi.restoreAllMocks();
});

describe('unavailable production integrations', () => {
  it('returns 503 for OTP requests without creating a code or claiming delivery', async () => {
    productionMode();
    const response = await request(app).post('/auth/otp/send').send({ phone: '05551112233' });
    expect(response.status).toBe(503);
    expect(response.body.error.message).toContain('SMS');
    expect(await prisma.otpCode.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects top-up and retry before any payment intent, idempotency record or credit', async () => {
    const token = await customerToken();
    productionMode();
    const payload = { amount: 1000, idempotencyKey: randomUUID() };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(app).post('/me/wallet/topup')
        .set('Authorization', `Bearer ${token}`).send(payload);
      expect(response.status).toBe(503);
    }
    expect(await prisma.paymentIntent.count()).toBe(0);
    expect(await prisma.financialRequest.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(Number((await prisma.wallet.findFirstOrThrow()).balance)).toBe(500);
  });

  it('rejects an order before debiting the wallet or writing an order', async () => {
    const token = await customerToken();
    productionMode();
    const response = await request(app).post('/orders').set('Authorization', `Bearer ${token}`).send({
      branchId: 'beylikduzu-vadi-loca', pickupSlot: '12:30',
      items: [{ productId: 'caffe-latte', quantity: 1 }],
      payment: { method: 'dosso_card' }, idempotencyKey: randomUUID(),
    });
    expect(response.status).toBe(503);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.financialRequest.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(Number((await prisma.wallet.findFirstOrThrow()).balance)).toBe(500);
  });

  it('rejects gifts requiring SMS before transferring funds', async () => {
    const token = await customerToken();
    productionMode();
    const response = await request(app).post('/gifts').set('Authorization', `Bearer ${token}`).send({
      recipientPhone: '05550000002', type: 'balance', amount: 100, idempotencyKey: randomUUID(),
    });
    expect(response.status).toBe(503);
    expect(await prisma.gift.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(Number((await prisma.wallet.findFirstOrThrow()).balance)).toBe(500);
  });

  it('does not report simulated payment, SMS or POS delivery even if dev clients are called directly', async () => {
    productionMode();
    await expect(new DevSmsProvider().send('5550000001', 'must not be logged')).rejects.toMatchObject({ status: 503 });
    await expect(new DevPaymentProvider().createPayment({ userId: 'fixture', intentId: 'fixture', amount: 100 }))
      .rejects.toMatchObject({ status: 503 });
    const update = vi.spyOn(prisma.order, 'update');
    await expect(kerzzPosClient.forwardOrder({ id: 'fixture', number: 1042, branchId: 'fixture' }))
      .rejects.toMatchObject({ status: 503 });
    expect(update).not.toHaveBeenCalled();
    const sweep = vi.spyOn(prisma.order, 'findMany');
    startForwardSweep();
    expect(sweep).not.toHaveBeenCalled();
  });

  it('trusts only explicitly configured reverse proxies', () => {
    expect(createApp().get('trust proxy')).toBe(false);
    env.TRUST_PROXY = ['127.0.0.1', '::1', '172.30.5.0/24'];
    const trust = createApp().get('trust proxy fn') as (address: string) => boolean;
    expect(trust('127.0.0.1')).toBe(true);
    expect(trust('172.30.5.4')).toBe(true);
    expect(trust('172.30.6.4')).toBe(false);
    expect(trust('203.0.113.20')).toBe(false);
  });
});
