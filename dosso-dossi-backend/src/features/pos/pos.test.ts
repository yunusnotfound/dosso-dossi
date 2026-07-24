import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { buildSignatureHeader } from '../../middleware/pos-auth.js';
import { login } from '../../test/helpers.js';

const app = createApp();
const PHONE = '05551112233';

/// HMAC imzalı POS isteği gönderir.
function posRequest(target: Express, path: string, body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  return request(target)
    .post(path)
    .set('Content-Type', 'application/json')
    .set('X-Dosso-Signature', buildSignatureHeader(env.POS_WEBHOOK_SECRET, raw))
    .send(raw);
}

async function setupUserWithQr(balance = 500) {
  const token = await login(app, PHONE);
  const auth = ['Authorization', `Bearer ${token}`] as const;
  await request(app).post('/me/wallet/topup').set(...auth).send({ amount: balance });
  const qr = await request(app).post('/me/wallet/qr-token').set(...auth);
  return { token, code: qr.body.code as string };
}

function chargeBody(code: string, overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'req-1',
    branchId: 'beylikduzu-vadi-loca',
    code,
    amount: 185.5,
    ...overrides,
  };
}

describe('POS QR tahsilat', () => {
  it('imzasız istek 401 döner', async () => {
    const res = await request(app)
      .post('/pos/charge')
      .send(chargeBody('DDPAY-x'));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('geçerli kod tahsil edilir: bakiye düşer, token tüketilir, ledger yazılır', async () => {
    const { code } = await setupUserWithQr(500);
    const res = await posRequest(app, '/pos/charge', chargeBody(code));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.amount).toBe(185.5);
    expect(res.body.customerName).toBeTruthy();

    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(314.5);
    const token = await prisma.qrToken.findUniqueOrThrow({ where: { code } });
    expect(token.consumedAt).not.toBeNull();
    const tx = await prisma.walletTransaction.findFirstOrThrow({
      where: { type: 'QR_PAYMENT' },
    });
    expect(Number(tx.amount)).toBe(-185.5);
    expect(tx.chargeId).toBe(res.body.chargeId);
  });

  it('aynı requestId ikinci kez gelirse tek düşüm olur, aynı yanıt döner', async () => {
    const { code } = await setupUserWithQr(500);
    const first = await posRequest(app, '/pos/charge', chargeBody(code));
    const second = await posRequest(app, '/pos/charge', chargeBody(code));
    expect(second.status).toBe(200);
    expect(second.body.chargeId).toBe(first.body.chargeId);

    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(314.5); // tek düşüm
    expect(await prisma.posCharge.count()).toBe(1);
  });

  it('tüketilmiş kod INVALID_QR döner', async () => {
    const { code } = await setupUserWithQr(500);
    await posRequest(app, '/pos/charge', chargeBody(code));
    const res = await posRequest(
      app,
      '/pos/charge',
      chargeBody(code, { requestId: 'req-2' }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QR');
  });

  it('grace penceresi: 5 sn önce süresi dolmuş kod hâlâ kabul edilir', async () => {
    const { code } = await setupUserWithQr(500);
    await prisma.qrToken.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });
    const res = await posRequest(app, '/pos/charge', chargeBody(code));
    expect(res.status).toBe(200);
  });

  it('grace penceresi dışında süresi dolmuş kod reddedilir', async () => {
    const { code } = await setupUserWithQr(500);
    await prisma.qrToken.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const res = await posRequest(app, '/pos/charge', chargeBody(code));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QR');
  });

  it('yetersiz bakiyede red: token tüketilmemiş kalır, yükleme sonrası aynı kod geçer', async () => {
    const { token, code } = await setupUserWithQr(100);
    const denied = await posRequest(app, '/pos/charge', chargeBody(code));
    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe('INSUFFICIENT_BALANCE');

    const qr = await prisma.qrToken.findUniqueOrThrow({ where: { code } });
    expect(qr.consumedAt).toBeNull(); // transaction geri sarıldı

    await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200 });
    const retry = await posRequest(
      app,
      '/pos/charge',
      chargeBody(code, { requestId: 'req-2' }),
    );
    expect(retry.status).toBe(200);
  });

  it('void: bakiye iade edilir, REFUND ledger yazılır; ikinci void reddedilir', async () => {
    const { code } = await setupUserWithQr(500);
    const charge = await posRequest(app, '/pos/charge', chargeBody(code));
    const chargeId = charge.body.chargeId as string;

    const voided = await posRequest(app, `/pos/charge/${chargeId}/void`, {
      requestId: 'void-1',
    });
    expect(voided.status).toBe(200);
    expect(voided.body.refunded).toBe(185.5);

    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(500);
    expect(
      await prisma.walletTransaction.count({ where: { type: 'REFUND' } }),
    ).toBe(1);

    // Aynı requestId → saklanan yanıt (idempotent), yeni requestId → VOID_NOT_ALLOWED
    const replay = await posRequest(app, `/pos/charge/${chargeId}/void`, {
      requestId: 'void-1',
    });
    expect(replay.status).toBe(200);
    const again = await posRequest(app, `/pos/charge/${chargeId}/void`, {
      requestId: 'void-2',
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('VOID_NOT_ALLOWED');
  });

  it('15 dakikadan eski işlem void edilemez', async () => {
    const { code } = await setupUserWithQr(500);
    const charge = await posRequest(app, '/pos/charge', chargeBody(code));
    const chargeId = charge.body.chargeId as string;
    await prisma.posCharge.update({
      where: { id: chargeId },
      data: { createdAt: new Date(Date.now() - 20 * 60_000) },
    });
    const res = await posRequest(app, `/pos/charge/${chargeId}/void`, {
      requestId: 'void-late',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VOID_NOT_ALLOWED');
  });
});
