import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { buildSignatureHeader } from '../../middleware/pos-auth.js';
import { login } from '../../test/helpers.js';

const app = createApp();

function paymentWebhook(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  return request(app)
    .post('/webhooks/payment/confirmation')
    .set('Content-Type', 'application/json')
    .set(
      'X-Dosso-Signature',
      buildSignatureHeader(env.PAYMENT_WEBHOOK_SECRET, raw),
    )
    .send(raw);
}

describe('iki fazlı yükleme', () => {
  it('dev sağlayıcı: intent SUCCEEDED olur, bakiye bir kez yazılır', async () => {
    const token = await login(app, '05551112233');
    const res = await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      balance: 500,
      bonusDrinks: 0,
      status: 'succeeded',
    });

    const intent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: res.body.paymentId },
    });
    expect(intent.status).toBe('SUCCEEDED');
    expect(intent.providerRef).toBe(`dev_${intent.id}`);
    expect(await prisma.walletTransaction.count({ where: { type: 'TOPUP' } })).toBe(1);
  });

  it('onay webhook\'u aynı paymentId ile tekrar gelirse bakiye ikinci kez yazılmaz', async () => {
    const token = await login(app, '05551112233');
    const topup = await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 300 });
    const paymentId = topup.body.paymentId as string;

    const replay = await paymentWebhook({ paymentId, status: 'succeeded' });
    expect(replay.status).toBe(200);

    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(300); // 600 değil
    expect(await prisma.walletTransaction.count({ where: { type: 'TOPUP' } })).toBe(1);
  });

  it('PENDING olmayan intent için failed bildirimi PAYMENT_NOT_PENDING döner', async () => {
    const token = await login(app, '05551112233');
    const topup = await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    const res = await paymentWebhook({
      paymentId: topup.body.paymentId,
      status: 'failed',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_NOT_PENDING');

    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(100); // iade/geri alma yok
  });

  it('1000 ₺ bonus kuralı iki fazlı akışta da çalışır', async () => {
    const token = await login(app, '05551112233');
    const res = await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1000 });
    expect(res.body.bonusDrinks).toBe(5);

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.freeDrinks).toBe(5);
  });
});
