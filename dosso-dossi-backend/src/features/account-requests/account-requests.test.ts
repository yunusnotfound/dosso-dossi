import type { AdminRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signAdminToken } from '../../middleware/admin-auth.js';
import { login } from '../../test/helpers.js';

const app = createApp();
const auth = (token: string) => ['Authorization', `Bearer ${token}`] as const;
async function admin(role: AdminRole = 'MANAGER') {
  const record = await prisma.adminUser.create({ data: {
    email: `${role}@tests.local`, passwordHash: 'test-unused-password-hash', role,
    ...(role === 'BRANCH_MANAGER' ? { branchId: 'beylikduzu-vadi-loca' } : {}),
  } });
  return signAdminToken(record.id);
}
async function createClosure(token: string) {
  const result = await request(app).post('/me/account-requests').set(...auth(token)).send({ kind: 'CLOSURE', note: 'Hesabımı kapatmak istiyorum.' });
  expect(result.status).toBe(201);
  return result.body.id as string;
}

describe('hesap talepleri ve kişisel veri dışa aktarımı', () => {
  it('aynı tür paralel talep tek açık kayıt üretir ve kullanıcılar birbirinin kaydını göremez', async () => {
    const first = await login(app, '05551112233');
    const second = await login(app, '05554445566');
    const results = await Promise.all(Array.from({ length: 3 }, () => request(app).post('/me/account-requests')
      .set(...auth(first)).send({ kind: 'DATA_EXPORT', note: 'Verilerim' })));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await prisma.accountRequest.count()).toBe(1);
    const own = await request(app).get('/me/account-requests').set(...auth(first));
    expect(own.body).toHaveLength(1);
    expect(own.body[0]).not.toHaveProperty('userId');
    expect((await request(app).get('/me/account-requests').set(...auth(second))).body).toEqual([]);
    expect((await request(app).post(`/me/account-requests/${results[0]!.body.id}/cancel`).set(...auth(second))).status).toBe(404);
  });

  it('iptal edilen talep tekrar güvenle iptal edilir, ardından yeni açık talep oluşturulabilir', async () => {
    const token = await login(app, '05551112233');
    const id = await createClosure(token);
    for (let i = 0; i < 2; i++) {
      const cancelled = await request(app).post(`/me/account-requests/${id}/cancel`).set(...auth(token));
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('CANCELLED');
    }
    expect((await prisma.accountRequest.findUniqueOrThrow({ where: { id } })).openKey).toBeNull();
    expect(await createClosure(token)).not.toBe(id);
  });

  it('yetki sınırları ve anlamlı yanıt şartı uygulanır', async () => {
    const token = await login(app, '05551112233');
    const id = await createClosure(token);
    const manager = await admin(), viewer = await admin('VIEWER'), branch = await admin('BRANCH_MANAGER');
    expect((await request(app).get('/admin/account-requests').set(...auth(viewer))).body.entries).toHaveLength(1);
    expect((await request(app).get('/admin/account-requests').set(...auth(branch))).status).toBe(403);
    expect((await request(app).get('/admin/account-requests').set(...auth(token))).status).toBe(401);
    expect((await request(app).patch(`/admin/account-requests/${id}`).set(...auth(viewer))
      .send({ status: 'IN_REVIEW', response: 'İnceleniyor' })).status).toBe(403);
    expect((await request(app).patch(`/admin/account-requests/${id}`).set(...auth(manager))
      .send({ status: 'COMPLETED', response: ' ' })).status).toBe(400);
    const updated = await request(app).patch(`/admin/account-requests/${id}`).set(...auth(manager))
      .send({ status: 'IN_REVIEW', response: 'İncelemeye alındı.' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('IN_REVIEW');
    expect(await prisma.auditLog.count({ where: { action: 'accountRequest.update' } })).toBe(1);
    expect(await prisma.userNotification.count({ where: { kind: 'ACCOUNT_REQUEST' } })).toBe(1);
  });

  it('bakiye, aktif sipariş, bekleyen ödeme ve bekleyen hediye hesap kapanışını engeller', async () => {
    const token = await login(app, '05551112233');
    const user = await prisma.user.findFirstOrThrow();
    const id = await createClosure(token), manager = await admin();
    const complete = () => request(app).patch(`/admin/account-requests/${id}`).set(...auth(manager))
      .send({ status: 'COMPLETED', response: 'Hesap kapatıldı.' });
    await prisma.wallet.update({ where: { userId: user.id }, data: { balance: 1 } });
    expect((await complete()).status).toBe(409);
    await prisma.wallet.update({ where: { userId: user.id }, data: { balance: 0 } });
    const order = await prisma.order.create({ data: { userId: user.id, branchId: 'beylikduzu-vadi-loca', number: 1042, pickupSlot: 'asap', subtotal: 0, total: 0 } });
    expect((await complete()).status).toBe(409);
    await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });
    const payment = await prisma.paymentIntent.create({ data: { userId: user.id, amount: 1, provider: 'dev' } });
    expect((await complete()).status).toBe(409);
    await prisma.paymentIntent.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    const gift = await prisma.gift.create({ data: { senderId: user.id, recipientPhone: '5559998877', type: 'BALANCE', label: '1 TL', amount: 1, redeemCode: 'CLOSURE-TEST' } });
    expect((await complete()).status).toBe(409);
    await prisma.gift.update({ where: { id: gift.id }, data: { status: 'REDEEMED' } });
    await login(app, '05554445566');
    const sender = await prisma.user.findUniqueOrThrow({ where: { phone: '5554445566' } });
    const incoming = await prisma.gift.create({ data: { senderId: sender.id, recipientPhone: user.phone, type: 'DRINK', label: 'Kahve', amount: 190, redeemCode: 'INCOMING-CLOSURE-TEST' } });
    expect((await complete()).status).toBe(409);
    await prisma.gift.update({ where: { id: incoming.id }, data: { status: 'REDEEMED', recipientId: user.id } });
    expect((await complete()).status).toBe(200);
    expect((await prisma.accountRequest.findUniqueOrThrow({ where: { id } })).status).toBe('COMPLETED');
  });

  it('kapanış oturumları ve QR kodlarını iptal eder, tekrar giriş ve yeni hediye reddedilir; kayıtlar korunur', async () => {
    const loginResult = await request(app).post('/auth/otp/verify').send({ phone: '05551112233', code: '111111' });
    const token = loginResult.body.token as string;
    const user = await prisma.user.findFirstOrThrow();
    const qr = await request(app).post('/me/wallet/qr-token').set(...auth(token));
    const id = await createClosure(token), manager = await admin();
    const completed = await request(app).patch(`/admin/account-requests/${id}`).set(...auth(manager))
      .send({ status: 'COMPLETED', response: 'Hesabınız kapatıldı.' });
    expect(completed.status).toBe(200);
    const closed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(closed.closedAt).not.toBeNull();
    expect(closed.isBlocked).toBe(true);
    expect(closed.tokenVersion).toBe(1);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    expect((await prisma.qrToken.findUniqueOrThrow({ where: { code: qr.body.code } })).consumedAt).not.toBeNull();
    expect((await request(app).get('/me/wallet').set(...auth(token))).status).toBe(401);
    expect((await request(app).post('/auth/otp/verify').send({ phone: '05551112233', code: '111111' })).status).toBe(401);
    const other = await login(app, '05554445566');
    const rejected = await request(app).post('/gifts').set(...auth(other)).send({ recipientPhone: '05551112233', type: 'balance', amount: 1 });
    expect(rejected.status).toBe(409);
    expect(await prisma.gift.count()).toBe(0);
    expect(await prisma.wallet.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.accountRequest.count({ where: { userId: user.id } })).toBe(1);
  });

  it('kişisel export yalnız sahibini ve seçili güvenli alanları 100 satırlık sayfalarla verir', async () => {
    const token = await login(app, '05551112233');
    await login(app, '05554445566');
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: '5551112233' }, include: { wallet: true } });
    await prisma.walletTransaction.createMany({ data: Array.from({ length: 101 }, (_, i) => ({
      walletId: user.wallet!.id, type: 'ADJUSTMENT' as const, amount: 1, balanceAfter: i + 1,
      note: 'Hediye → 5554445566',
    })) });
    const profile = await request(app).get('/me/data-export?section=profile').set(...auth(token));
    expect(profile.body.entries).toHaveLength(1);
    expect(profile.body.entries[0].phone).toBe('5551112233');
    for (const key of ['refreshTokens', 'tokenVersion', 'passwordHash', 'codeHash', 'tokenHash']) {
      expect(JSON.stringify(profile.body)).not.toContain(key);
    }
    const first = await request(app).get('/me/data-export?section=wallet&page=1').set(...auth(token));
    expect(first.body.entries).toHaveLength(100);
    expect(first.body.hasMore).toBe(true);
    expect(JSON.stringify(first.body)).not.toContain('5554445566');
    const second = await request(app).get('/me/data-export?section=wallet&page=2').set(...auth(token));
    expect(second.body.entries).toHaveLength(1);
    expect(second.body.hasMore).toBe(false);
    expect(new Set([...first.body.entries, ...second.body.entries].map((row) => row.id)).size).toBe(101);
    expect((await request(app).get('/me/data-export?section=refreshTokens').set(...auth(token))).status).toBe(400);
    expect((await request(app).get('/me/data-export?section=profile&page=-1').set(...auth(token))).status).toBe(400);
    expect((await request(app).get('/me/data-export')).status).toBe(401);
  });
});
