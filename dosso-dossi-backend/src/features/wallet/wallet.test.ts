import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login } from '../../test/helpers.js';

const app = createApp();

describe('wallet', () => {
  it('yükleme bakiyeyi artırır ve ledger kaydı oluşturur', async () => {
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

    const tx = await prisma.walletTransaction.findFirstOrThrow({
      where: { type: 'TOPUP' },
    });
    expect(Number(tx.amount)).toBe(500);
    expect(Number(tx.balanceAfter)).toBe(500);
  });

  it('ilk yükleme 1000 ise 5 ikram verir, sonraki yüklemeler ikram vermez', async () => {
    const token = await login(app, '05551112233');
    const auth = ['Authorization', `Bearer ${token}`] as const;

    const first = await request(app)
      .post('/me/wallet/topup')
      .set(...auth)
      .send({ amount: 1000 });
    expect(first.body.bonusDrinks).toBe(5);

    // Kampanya tek seferlik: aynı tutarı tekrar yüklemek ikram getirmez.
    const second = await request(app)
      .post('/me/wallet/topup')
      .set(...auth)
      .send({ amount: 1000 });
    expect(second.body.bonusDrinks).toBe(0);
    expect(second.body.balance).toBeCloseTo(2000);

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.freeDrinks).toBe(5);
    expect(
      await prisma.loyaltyEvent.count({ where: { type: 'TOPUP_BONUS' } }),
    ).toBe(1);
  });

  it('ilk yükleme eşiğin altındaysa hak düşer, sonraki 1000 yükleme ikram vermez', async () => {
    const token = await login(app, '05551112233');
    const auth = ['Authorization', `Bearer ${token}`] as const;

    const almost = await request(app)
      .post('/me/wallet/topup')
      .set(...auth)
      .send({ amount: 999.99 });
    expect(almost.body.bonusDrinks).toBe(0);

    const later = await request(app)
      .post('/me/wallet/topup')
      .set(...auth)
      .send({ amount: 1000 });
    expect(later.body.bonusDrinks).toBe(0);
    expect(later.body.balance).toBeCloseTo(1999.99);

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.freeDrinks).toBe(0);
    expect(
      await prisma.loyaltyEvent.count({ where: { type: 'TOPUP_BONUS' } }),
    ).toBe(0);
  });

  it('qr-token 60 saniyelik tek kullanımlık kod üretir; yenisi eskisini geçersiz kılar', async () => {
    const token = await login(app, '05551112233');
    const auth = ['Authorization', `Bearer ${token}`] as const;

    const first = await request(app).post('/me/wallet/qr-token').set(...auth);
    expect(first.status).toBe(200);
    expect(first.body.code).toMatch(/^DDPAY-/);
    const ttlMs = new Date(first.body.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(50_000);
    expect(ttlMs).toBeLessThanOrEqual(60_000);

    const second = await request(app).post('/me/wallet/qr-token').set(...auth);
    const firstRow = await prisma.qrToken.findUniqueOrThrow({
      where: { code: first.body.code },
    });
    expect(firstRow.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    const secondRow = await prisma.qrToken.findUniqueOrThrow({
      where: { code: second.body.code },
    });
    expect(secondRow.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
