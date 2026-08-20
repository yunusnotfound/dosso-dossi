import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login as customerLogin } from '../../test/helpers.js';
import { hashPassword } from './admin-auth.service.js';

const app = createApp();
const PASSWORD = 'cok-uzun-panel-sifresi';

async function adminToken(
  role: 'SUPER_ADMIN' | 'MANAGER' | 'BRANCH_MANAGER' | 'VIEWER' = 'SUPER_ADMIN',
  branchId: string | null = null,
): Promise<string> {
  const email = `${role.toLowerCase()}@dossodossi.com`;
  await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      role,
      branchId,
    },
  });
  const res = await request(app)
    .post('/admin/auth/login')
    .send({ email, password: PASSWORD });
  return res.body.token as string;
}

/// Bakiyesi olan bir müşteri ve ondan bir sipariş üretir.
async function seedOrder(opts: { useFreeDrink?: boolean } = {}) {
  const token = await customerLogin(app, '05551112233');
  const auth = ['Authorization', `Bearer ${token}`] as const;

  await request(app)
    .post('/me/wallet/topup')
    .set(...auth)
    .send({ amount: 2000 });

  if (opts.useFreeDrink) {
    // İkram hakkı ver (yükleme bonusu ilk yüklemede zaten verildi)
    const acc = await prisma.loyaltyAccount.findFirstOrThrow();
    await prisma.loyaltyAccount.update({
      where: { id: acc.id },
      data: { freeDrinks: { increment: 1 } },
    });
  }

  const res = await request(app)
    .post('/orders')
    .set(...auth)
    .send({
      branchId: 'beylikduzu-vadi-loca',
      pickupSlot: 'asap',
      useFreeDrink: opts.useFreeDrink ?? false,
      payment: { method: 'dosso_card' },
      items: [
        { productId: 'caffe-latte', quantity: 2, size: 'Orta', milk: '', shot: '' },
      ],
    });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Sipariş kurulamadı: ${JSON.stringify(res.body)}`);
  }
  return res.body as { id: string; total: number };
}

describe('admin siparişler', () => {
  let token: string;
  beforeEach(async () => {
    token = await adminToken();
  });

  it('listeler, filtreler ve sipariş numarasıyla arar', async () => {
    const order = await seedOrder();

    const all = await request(app)
      .get('/admin/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(1);
    expect(all.body.orders[0].id).toBe(order.id);
    expect(all.body.orders[0].customerPhone).toBe('5551112233');

    const found = await request(app)
      .get(`/admin/orders?q=${order.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(found.body.total).toBe(1);

    const none = await request(app)
      .get('/admin/orders?status=COMPLETED')
      .set('Authorization', `Bearer ${token}`);
    expect(none.body.total).toBe(0);
  });

  it('detayda kalemler ve cüzdan hareketi görünür', async () => {
    const order = await seedOrder();
    const res = await request(app)
      .get(`/admin/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].productName).toBe('Caffe Latte');
    expect(res.body.walletTransactions[0].type).toBe('ORDER_PAYMENT');
  });

  it('durum ilerletir ve audit kaydı düşer', async () => {
    const order = await seedOrder();
    const res = await request(app)
      .post(`/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PREPARING' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('preparing');

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'order.status' },
    });
    expect(log.after).toMatchObject({ status: 'PREPARING' });
  });

  it('geçersiz durum sıçraması 409 döner (kural kopyalanmıyor)', async () => {
    const order = await seedOrder();
    const res = await request(app)
      .post(`/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('durum ucundan CANCELLED gönderilemez', async () => {
    const order = await seedOrder();
    const res = await request(app)
      .post(`/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' });
    // enum dışı → doğrulama hatası
    expect(res.status).toBe(400);
  });

  it('iptal: bakiye iade edilir, damga geri alınır, defter ve audit yazılır', async () => {
    const order = await seedOrder();
    const before = await prisma.wallet.findFirstOrThrow();
    const loyaltyBefore = await prisma.loyaltyAccount.findFirstOrThrow();

    const res = await request(app)
      .post(`/admin/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Müşteri vazgeçti, şube onayladı' });

    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(order.total);

    const after = await prisma.wallet.findFirstOrThrow();
    expect(Number(after.balance)).toBeCloseTo(Number(before.balance) + order.total);

    const refund = await prisma.walletTransaction.findFirstOrThrow({
      where: { type: 'REFUND' },
    });
    expect(Number(refund.amount)).toBeCloseTo(order.total);

    const loyaltyAfter = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyaltyAfter.stamps).toBe(loyaltyBefore.stamps - 2);

    const dbOrder = await prisma.order.findFirstOrThrow();
    expect(dbOrder.status).toBe('CANCELLED');

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'order.cancel' },
    });
    expect(log.reason).toContain('vazgeçti');
  });

  it('iptal gerekçesiz yapılamaz', async () => {
    const order = await seedOrder();
    const res = await request(app)
      .post(`/admin/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'yok' });
    expect(res.status).toBe(400);
  });

  it('kullanılan ikram iptalde geri verilir', async () => {
    const order = await seedOrder({ useFreeDrink: true });
    const before = await prisma.loyaltyAccount.findFirstOrThrow();

    await request(app)
      .post(`/admin/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Yanlış ürün hazırlandı' });

    const after = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(after.freeDrinks).toBe(before.freeDrinks + 1);
  });

  it('aynı sipariş iki kez iptal edilemez (çifte iade olmaz)', async () => {
    const order = await seedOrder();
    const first = await request(app)
      .post(`/admin/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'İlk iptal gerekçesi' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/admin/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'İkinci iptal denemesi' });
    expect(second.status).toBe(409);

    expect(await prisma.walletTransaction.count({ where: { type: 'REFUND' } })).toBe(1);
  });

  it('VIEWER durum değiştiremez, okuyabilir', async () => {
    const order = await seedOrder();
    const viewer = await adminToken('VIEWER');

    expect(
      (await request(app).get('/admin/orders').set('Authorization', `Bearer ${viewer}`))
        .status,
    ).toBe(200);

    const res = await request(app)
      .post(`/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${viewer}`)
      .send({ status: 'PREPARING' });
    expect(res.status).toBe(403);
  });

  it('şube müdürü başka şubenin siparişini göremez', async () => {
    const order = await seedOrder();
    await prisma.branch.create({
      data: {
        id: 'baska-sube',
        name: 'Başka Şube',
        address: '-',
        city: 'İstanbul',
        lat: 41,
        lng: 29,
        hours: '09:00–22:00',
      },
    });
    const bm = await adminToken('BRANCH_MANAGER', 'baska-sube');

    const list = await request(app)
      .get('/admin/orders')
      .set('Authorization', `Bearer ${bm}`);
    expect(list.body.total).toBe(0);

    const detail = await request(app)
      .get(`/admin/orders/${order.id}`)
      .set('Authorization', `Bearer ${bm}`);
    expect(detail.status).toBe(403);
  });

  it('CSV dışa aktarımı BOM ve noktalı virgülle gelir', async () => {
    await seedOrder();
    const res = await request(app)
      .get('/admin/orders/export.csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.startsWith('﻿')).toBe(true);
    expect(res.text).toContain('Sipariş;Tarih;Şube');
    expect(res.text).toContain('DD-');
  });
});
