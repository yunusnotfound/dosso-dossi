import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { buildSignatureHeader } from '../../middleware/pos-auth.js';
import { login } from '../../test/helpers.js';

const app = createApp();
const PHONE = '05551112233';

function signedPost(path: string, body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  return request(app)
    .post(path)
    .set('Content-Type', 'application/json')
    .set('X-Dosso-Signature', buildSignatureHeader(env.POS_WEBHOOK_SECRET, raw))
    .send(raw);
}

/// Kullanıcı + QR kodu hazırlar (kasada kimlik eşleştirme için)
async function setupCustomer() {
  const token = await login(app, PHONE);
  const qr = await request(app)
    .post('/me/wallet/qr-token')
    .set('Authorization', `Bearer ${token}`);
  return { token, qrCode: qr.body.code as string };
}

function saleBody(qrCode: string, overrides: Record<string, unknown> = {}) {
  return {
    saleId: 'sale-1',
    branchId: 'beylikduzu-vadi-loca',
    customer: { qrCode },
    items: [{ productId: 'caffe-latte', quantity: 2 }],
    ...overrides,
  };
}

describe('Kerzz satış webhook — kasada damga', () => {
  it('imzasız istek 401 döner', async () => {
    const res = await request(app)
      .post('/webhooks/kerzz/sale')
      .send(saleBody('DDPAY-x'));
    expect(res.status).toBe(401);
  });

  it('satış damga kazandırır, sadakat geçmişine işlenir', async () => {
    const { qrCode } = await setupCustomer();
    const res = await signedPost('/webhooks/kerzz/sale', saleBody(qrCode));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, stampsEarned: 2 });

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.stamps).toBe(2);
    const event = await prisma.loyaltyEvent.findFirstOrThrow({
      where: { type: 'STAMPS_EARNED' },
    });
    expect(event.title).toContain('Kasadan satış sale-1');
  });

  it('aynı saleId iki kez gelirse damga bir kez sayılır', async () => {
    const { qrCode } = await setupCustomer();
    await signedPost('/webhooks/kerzz/sale', saleBody(qrCode));
    const replay = await signedPost('/webhooks/kerzz/sale', saleBody(qrCode));
    expect(replay.status).toBe(200);

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.stamps).toBe(2); // 4 değil
  });

  it('hedef dolunca damgalar ikrama çevrilir (kasadan 5 kahve)', async () => {
    const { qrCode } = await setupCustomer();
    const res = await signedPost(
      '/webhooks/kerzz/sale',
      saleBody(qrCode, { items: [{ productId: 'caffe-latte', quantity: 5 }] }),
    );
    expect(res.body).toMatchObject({ stampsEarned: 5, rewardsEarned: 1 });

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.stamps).toBe(0);
    expect(loyalty.freeDrinks).toBe(1);
  });

  it('bilinmeyen ürün ve damgasız ürün 0 damga; hata dönmez', async () => {
    const { qrCode } = await setupCustomer();
    const res = await signedPost(
      '/webhooks/kerzz/sale',
      saleBody(qrCode, {
        items: [
          { productId: 'olmayan-urun', quantity: 3 },
          { productId: 'mug-konik', quantity: 1 }, // stampMultiplier 0
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body.stampsEarned).toBe(0);
  });

  it('eşleşmeyen müşteri skip döner, POS retry fırtınası olmaz', async () => {
    await setupCustomer();
    const res = await signedPost(
      '/webhooks/kerzz/sale',
      saleBody('DDPAY-hic-olmayan-kod'),
    );
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe('customer_unknown');
    const event = await prisma.posEvent.findFirstOrThrow({
      where: { eventType: 'sale' },
    });
    expect(event.status).toBe('SKIPPED');
  });
});
