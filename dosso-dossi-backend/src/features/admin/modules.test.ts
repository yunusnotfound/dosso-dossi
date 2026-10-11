import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login as customerLogin } from '../../test/helpers.js';
import { hashPassword } from './admin-auth.service.js';
import { invalidateSettingsCache } from '../settings/settings.service.js';
import { invalidateOptionCache } from '../menu/options.service.js';

const app = createApp();
const PASSWORD = 'cok-uzun-panel-sifresi';

async function token(
  role: 'SUPER_ADMIN' | 'MANAGER' | 'BRANCH_MANAGER' | 'VIEWER' = 'SUPER_ADMIN',
  branchId: string | null = null,
): Promise<string> {
  const email = `${role.toLowerCase()}@dossodossi.com`;
  await prisma.adminUser.upsert({
    where: { email },
    update: { role, branchId, isActive: true },
    create: { email, passwordHash: await hashPassword(PASSWORD), role, branchId },
  });
  const res = await request(app)
    .post('/admin/auth/login')
    .send({ email, password: PASSWORD });
  return res.body.token as string;
}

const auth = (t: string) => ['Authorization', `Bearer ${t}`] as const;

describe('A3 menü yönetimi', () => {
  let t: string;
  beforeEach(async () => {
    t = await token();
    // Ayar/opsiyon önbellekleri testler arası sızmasın
    invalidateSettingsCache();
    invalidateOptionCache();
  });

  it('kategori oluşturur, sıralar ve ürünlü kategoriyi silmeye izin vermez', async () => {
    const created = await request(app)
      .post('/admin/menu/categories')
      .set(...auth(t))
      .send({ id: 'tatlilar', name: 'Tatlılar', sortOrder: 5 });
    expect(created.status).toBe(200);

    const reorder = await request(app)
      .post('/admin/menu/categories/reorder')
      .set(...auth(t))
      .send({ ids: ['tatlilar', 'sicak-kahveler', 'merch'] });
    expect(reorder.status).toBe(200);
    const list = await request(app).get('/admin/menu/categories').set(...auth(t));
    expect(list.body[0].id).toBe('tatlilar');

    // Ürünü olan kategori silinemez
    const denied = await request(app)
      .delete('/admin/menu/categories/sicak-kahveler')
      .set(...auth(t));
    expect(denied.status).toBe(409);

    const ok = await request(app)
      .delete('/admin/menu/categories/tatlilar')
      .set(...auth(t));
    expect(ok.status).toBe(200);
  });

  it('ürün ekler/günceller ve pasifleştirir (silmez)', async () => {
    const res = await request(app)
      .post('/admin/menu/products')
      .set(...auth(t))
      .send({
        id: 'yeni-latte',
        name: 'Yeni Latte',
        price: 200,
        categoryId: 'sicak-kahveler',
        stampMultiplier: 1,
        hasOptions: true,
      });
    expect(res.status).toBe(200);

    const off = await request(app)
      .post('/admin/menu/products/yeni-latte/active')
      .set(...auth(t))
      .send({ isActive: false });
    expect(off.status).toBe(200);

    // Kayıt duruyor, yalnız pasif
    const row = await prisma.product.findUniqueOrThrow({ where: { id: 'yeni-latte' } });
    expect(row.isActive).toBe(false);
  });

  it('toplu fiyat zammı yuvarlar ve tek audit kaydında saklar', async () => {
    const res = await request(app)
      .post('/admin/menu/bulk-price')
      .set(...auth(t))
      .send({
        categoryId: 'sicak-kahveler',
        percent: 10,
        roundTo: 5,
        reason: 'Yıllık fiyat güncellemesi',
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    // 190 → 209 → yuvarla 5'e → 210
    const latte = await prisma.product.findUniqueOrThrow({ where: { id: 'caffe-latte' } });
    expect(Number(latte.price)).toBe(210);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'product.bulkPrice' },
    });
    expect(log.reason).toContain('Yıllık');
  });

  it('opsiyon fiyatı panelden değişince sipariş fiyatı da değişir', async () => {
    const res = await request(app)
      .post('/admin/menu/options')
      .set(...auth(t))
      .send({ group: 'milk', name: 'Yulaf sütü', priceDelta: 99 });
    expect(res.status).toBe(200);

    const customer = await customerLogin(app, '05551112233');
    await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${customer}`)
      .send({ amount: 2000 });

    const order = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({
        branchId: 'beylikduzu-vadi-loca',
        pickupSlot: 'asap',
        payment: { method: 'dosso_card' },
        items: [
          {
            productId: 'caffe-latte',
            quantity: 1,
            size: 'Orta',
            milk: 'Yulaf sütü',
            shot: '',
          },
        ],
      });
    // 190 taban + 99 opsiyon
    expect(order.body.total).toBe(289);
  });

  it('şube × ürün müsaitlik matrisi satır yoksa müsait sayar', async () => {
    const before = await request(app)
      .get('/admin/branches/beylikduzu-vadi-loca/availability')
      .set(...auth(t));
    expect(before.status).toBe(200);
    expect(before.body.every((p: { isAvailable: boolean }) => p.isAvailable)).toBe(true);

    await request(app)
      .post('/admin/branches/beylikduzu-vadi-loca/availability/caffe-latte')
      .set(...auth(t))
      .send({ isAvailable: false, priceOverride: null });

    const after = await request(app)
      .get('/admin/branches/beylikduzu-vadi-loca/availability')
      .set(...auth(t));
    const latte = after.body.find((p: { productId: string }) => p.productId === 'caffe-latte');
    expect(latte.isAvailable).toBe(false);
  });
});

describe('A4 şubeler', () => {
  let t: string;
  beforeEach(async () => {
    t = await token();
  });

  it('şubeyi kapatınca sipariş alınamaz', async () => {
    const closed = await request(app)
      .post('/admin/branches/beylikduzu-vadi-loca/open')
      .set(...auth(t))
      .send({ isOpen: false });
    expect(closed.status).toBe(200);

    const customer = await customerLogin(app, '05551112233');
    await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${customer}`)
      .send({ amount: 2000 });

    const order = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({
        branchId: 'beylikduzu-vadi-loca',
        pickupSlot: 'asap',
        payment: { method: 'dosso_card' },
        items: [{ productId: 'caffe-latte', quantity: 1, size: '', milk: '', shot: '' }],
      });
    expect(order.status).toBe(409);
    expect(order.body.error.code).toBe('BRANCH_CLOSED');
  });
});

describe('A5 kampanya, promosyon, ayarlar', () => {
  let t: string;
  beforeEach(async () => {
    t = await token();
    invalidateSettingsCache();
  });

  it('promosyon kodu ekler ve kullanım sayısını raporlar', async () => {
    const res = await request(app)
      .post('/admin/promos')
      .set(...auth(t))
      .send({ code: 'yeni10', discountRate: 0.1, isActive: true });
    expect(res.status).toBe(200);

    const list = await request(app).get('/admin/promos').set(...auth(t));
    const created = list.body.find((p: { code: string }) => p.code === 'YENI10');
    expect(created.usageCount).toBe(0);
  });

  it('geçersiz indirim oranı reddedilir', async () => {
    const res = await request(app)
      .post('/admin/promos')
      .set(...auth(t))
      .send({ code: 'HATALI', discountRate: 1.5, isActive: true });
    expect(res.status).toBe(400);
  });

  it('yükleme eşiği ayarı değişince ikram kuralı da değişir', async () => {
    const res = await request(app)
      .post('/admin/settings')
      .set(...auth(t))
      .send({ key: 'loyalty.topUpBonusThreshold', value: 500 });
    expect(res.status).toBe(200);
    expect(res.body['loyalty.topUpBonusThreshold']).toBe(500);

    const customer = await customerLogin(app, '05551112233');
    const topup = await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${customer}`)
      .send({ amount: 500 });
    // Eski eşikte (1000) ikram çıkmazdı
    expect(topup.body.bonusDrinks).toBe(5);
  });

  it('ayar değiştirmek yalnız süper yöneticiye açık', async () => {
    const manager = await token('MANAGER');
    const res = await request(app)
      .post('/admin/settings')
      .set(...auth(manager))
      .send({ key: 'loyalty.topUpBonusDrinks', value: 99 });
    expect(res.status).toBe(403);
  });
});

describe('A6 müşteriler', () => {
  let t: string;
  let userId: string;

  beforeEach(async () => {
    t = await token();
    await customerLogin(app, '05551112233');
    userId = (await prisma.user.findFirstOrThrow()).id;
  });

  it('bakiye düzeltmesi defter kaydı üretir ve gerekçesiz yapılamaz', async () => {
    const noReason = await request(app)
      .post(`/admin/customers/${userId}/balance`)
      .set(...auth(t))
      .send({ amount: 100 });
    expect(noReason.status).toBe(400);

    const ok = await request(app)
      .post(`/admin/customers/${userId}/balance`)
      .set(...auth(t))
      .send({ amount: 100, reason: 'Kasada yaşanan hata telafisi' });
    expect(ok.status).toBe(200);
    expect(ok.body.balance).toBe(100);

    const tx = await prisma.walletTransaction.findFirstOrThrow();
    expect(tx.note).toContain('Panel düzeltmesi');

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'wallet.adjust' },
    });
    expect(log.reason).toContain('telafi');
  });

  it('bakiye eksiye düşürülemez', async () => {
    const res = await request(app)
      .post(`/admin/customers/${userId}/balance`)
      .set(...auth(t))
      .send({ amount: -50, reason: 'Hatalı yükleme geri alımı' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('hesap dondurulunca oturumları da düşer', async () => {
    expect(
      await prisma.refreshToken.count({ where: { userId, revokedAt: null } }),
    ).toBeGreaterThan(0);

    const res = await request(app)
      .post(`/admin/customers/${userId}/block`)
      .set(...auth(t))
      .send({ isBlocked: true, reason: 'Şüpheli işlem incelemesi' });
    expect(res.status).toBe(200);

    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
  });

  it('360° kart cüzdan, sipariş ve sadakat geçmişini birleştirir', async () => {
    const res = await request(app).get(`/admin/customers/${userId}`).set(...auth(t));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactions');
    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('loyaltyEvents');
    expect(res.body.loyalty).toHaveProperty('target');
  });
});

describe('A7 finans', () => {
  let t: string;
  beforeEach(async () => {
    t = await token();
  });

  it('cüzdan defteri tipe göre toplar', async () => {
    const customer = await customerLogin(app, '05551112233');
    await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${customer}`)
      .send({ amount: 1000 });

    const res = await request(app)
      .get('/admin/finance/ledger?type=TOPUP')
      .set(...auth(t));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.totalsByType[0].amount).toBe(1000);
  });

  it('mutabakat raporu saleRef’i olmayanları ayırır', async () => {
    const res = await request(app)
      .get('/admin/finance/reconciliation?days=3')
      .set(...auth(t));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('missingSaleRef');
  });

  it('CSV dışa aktarımı BOM ile gelir', async () => {
    const res = await request(app).get('/admin/finance/ledger.csv').set(...auth(t));
    expect(res.status).toBe(200);
    expect(res.text.startsWith('﻿')).toBe(true);
  });
});

describe('A8 POS izleme', () => {
  let t: string;
  beforeEach(async () => {
    t = await token();
  });

  it('sağlık göstergesi kaynak ve outbox döner', async () => {
    const res = await request(app).get('/admin/pos/health').set(...auth(t));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sources');
    expect(res.body).toHaveProperty('outbox');
  });

  it('yalnız FAILED olay yeniden kuyruğa alınır', async () => {
    const ok = await prisma.posEvent.create({
      data: {
        source: 'kerzz',
        eventType: 'sale',
        externalId: 'x1',
        payload: {},
        status: 'PROCESSED',
      },
    });
    const denied = await request(app)
      .post(`/admin/pos/events/${ok.id}/requeue`)
      .set(...auth(t))
      .send({ reason: 'Yeniden deneme talebi' });
    expect(denied.status).toBe(409);

    const failed = await prisma.posEvent.create({
      data: {
        source: 'kerzz',
        eventType: 'sale',
        externalId: 'x2',
        payload: {},
        status: 'FAILED',
        error: 'timeout',
      },
    });
    const res = await request(app)
      .post(`/admin/pos/events/${failed.id}/requeue`)
      .set(...auth(t))
      .send({ reason: 'Geçici ağ hatası, yeniden denenecek' });
    expect(res.status).toBe(200);

    const after = await prisma.posEvent.findUniqueOrThrow({ where: { id: failed.id } });
    expect(after.status).toBe('RECEIVED');
    expect(after.error).toBeNull();
  });
});

describe('A9 yönetim', () => {
  let t: string;
  beforeEach(async () => {
    t = await token();
  });

  it('yönetici ekler, geçici şifre bir kez döner ve o şifreyle giriş yapılır', async () => {
    const res = await request(app)
      .post('/admin/admins')
      .set(...auth(t))
      .send({ email: 'yeni@dossodossi.com', name: 'Yeni', role: 'VIEWER' });
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeTruthy();

    const login = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yeni@dossodossi.com', password: res.body.tempPassword });
    expect(login.status).toBe(200);
    expect(login.body.admin.role).toBe('VIEWER');
  });

  it('şube müdürü şubesiz oluşturulamaz', async () => {
    const res = await request(app)
      .post('/admin/admins')
      .set(...auth(t))
      .send({ email: 'bm@dossodossi.com', name: 'BM', role: 'BRANCH_MANAGER' });
    expect(res.status).toBe(404);
  });

  it('son aktif süper yönetici pasifleştirilemez', async () => {
    const me = await prisma.adminUser.findFirstOrThrow({
      where: { role: 'SUPER_ADMIN' },
    });
    const res = await request(app)
      .patch(`/admin/admins/${me.id}`)
      .set(...auth(t))
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('şifre sıfırlanınca eski şifre çalışmaz, oturumlar düşer', async () => {
    const created = await request(app)
      .post('/admin/admins')
      .set(...auth(t))
      .send({ email: 'sifirla@dossodossi.com', name: 'S', role: 'VIEWER' });
    const first = created.body.tempPassword as string;

    const admin = await prisma.adminUser.findUniqueOrThrow({
      where: { email: 'sifirla@dossodossi.com' },
    });
    const reset = await request(app)
      .post(`/admin/admins/${admin.id}/reset-password`)
      .set(...auth(t));
    expect(reset.status).toBe(200);

    const old = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'sifirla@dossodossi.com', password: first });
    expect(old.status).toBe(401);

    const fresh = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'sifirla@dossodossi.com', password: reset.body.tempPassword });
    expect(fresh.status).toBe(200);
  });

  it('audit tarayıcısı yapılan işlemleri listeler', async () => {
    await request(app)
      .post('/admin/branches/beylikduzu-vadi-loca/open')
      .set(...auth(t))
      .send({ isOpen: false });

    const res = await request(app).get('/admin/audit?entity=Branch').set(...auth(t));
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.logs[0].action).toBe('branch.close');
    expect(res.body.logs[0].adminEmail).toContain('@');
  });

  it('audit yalnız yönetici rollerine açık', async () => {
    const viewer = await token('VIEWER');
    const res = await request(app).get('/admin/audit').set(...auth(viewer));
    expect(res.status).toBe(403);
  });
});
