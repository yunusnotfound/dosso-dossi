import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login } from '../../test/helpers.js';
import { emitNotification } from './notifications.service.js';
import { advanceOrderStatus } from '../orders/order-status.service.js';
import { claimGiftForUser } from '../gifts/gift-claim.js';

const app = createApp();
const auth = (token: string) => ['Authorization', `Bearer ${token}`] as const;
async function account() {
  const token = await login(app, '05551112233');
  const user = await prisma.user.findUniqueOrThrow({ where: { phone: '5551112233' } });
  return { token, userId: user.id };
}

describe('uygulama içi bildirimler', () => {
  it('bildirim kaydı işlemle birlikte geri alınır ve tekrar aynı bildirimi üretmez', async () => {
    const { userId } = await account();
    const input = { userId, kind: 'GIFT_RECEIVED' as const, dedupeKey: 'gift:one', title: 'Hediye', body: 'Hediyen geldi.', targetPath: '/ikramlarim' };
    await expect(prisma.$transaction(async (tx) => { await emitNotification(tx, input); throw new Error('rollback'); })).rejects.toThrow('rollback');
    expect(await prisma.userNotification.count()).toBe(0);
    await Promise.all(Array.from({ length: 2 }, () => prisma.$transaction((tx) => emitNotification(tx, input))));
    expect(await prisma.userNotification.count()).toBe(1);
  });

  it('sipariş/kampanya tercihlerini gözetir, operasyonel hediyeyi susturmaz', async () => {
    const { userId } = await account();
    await prisma.notificationPrefs.update({ where: { userId }, data: { orderStatus: false, campaigns: false } });
    await prisma.$transaction(async (tx) => {
      for (const kind of ['ORDER_STATUS', 'CAMPAIGN', 'GIFT_RECEIVED', 'ACCOUNT_REQUEST'] as const) {
        await emitNotification(tx, { userId, kind, dedupeKey: kind, title: kind, body: 'Test', targetPath: '/' });
      }
    });
    expect((await prisma.userNotification.findMany()).map((row) => row.kind).sort()).toEqual(['ACCOUNT_REQUEST', 'GIFT_RECEIVED']);
  });

  it('bildirimler yalnız sahibine listelenir ve okunabilir; yeniden okuma zamanı değiştirmez', async () => {
    const { token, userId } = await account();
    const other = await login(app, '05554445566');
    const notification = await prisma.userNotification.create({ data: { userId, kind: 'GIFT_RECEIVED', dedupeKey: 'own', title: 'Hediye', body: 'Test', targetPath: '/ikramlarim' } });
    expect((await request(app).get('/me/notifications').set(...auth(other))).body.entries).toEqual([]);
    expect((await request(app).patch(`/me/notifications/${notification.id}/read`).set(...auth(other))).status).toBe(404);
    expect((await request(app).get('/me/notifications').set(...auth(token))).body.unreadCount).toBe(1);
    const first = await request(app).patch(`/me/notifications/${notification.id}/read`).set(...auth(token));
    const again = await request(app).patch(`/me/notifications/${notification.id}/read`).set(...auth(token));
    expect(first.status).toBe(200);
    expect(again.body.readAt).toBe(first.body.readAt);
    expect((await request(app).get('/me/notifications').set(...auth(token))).body.unreadCount).toBe(0);
  });

  it('aktif kampanya yalnız bir kez görünür; tarih ve tercih engelleri uygulanır', async () => {
    const { token, userId } = await account();
    await prisma.campaignStory.createMany({ data: [
      { id: 'active', title: 'Aktif', action: 'siparis', imageUrl: '/media/a.webp' },
      { id: 'future', title: 'Gelecek', action: 'siparis', startsAt: new Date(Date.now() + 60_000) },
      { id: 'expired', title: 'Bitti', action: 'siparis', endsAt: new Date(Date.now() - 1000) },
      { id: 'disabled', title: 'Pasif', action: 'siparis', isActive: false },
      { id: 'parent-inactive', title: 'Bağlı pasif', action: 'yukle-kazan' },
    ] });
    const first = await request(app).get('/me/notifications').set(...auth(token));
    expect(first.body.entries.map((row: { title: string }) => row.title)).toEqual(['Aktif']);
    await prisma.campaignStory.update({ where: { id: 'active' }, data: { title: 'Yazı düzeltmesi' } });
    await request(app).get('/me/notifications').set(...auth(token));
    expect(await prisma.userNotification.count()).toBe(1);
    await prisma.notificationPrefs.update({ where: { userId }, data: { campaigns: false } });
    await prisma.campaignStory.create({ data: { id: 'new-active', title: 'Yeni kampanya', action: 'siparis' } });
    await request(app).get('/me/notifications').set(...auth(token));
    expect(await prisma.userNotification.count()).toBe(1);
  });

  it('durum ve iptal tekrarları tek bildirim, tek iade üretir', async () => {
    const { userId } = await account();
    const order = await prisma.order.create({ data: { userId, branchId: 'beylikduzu-vadi-loca', number: 1042, pickupSlot: 'asap', subtotal: 0, total: 0 } });
    await advanceOrderStatus(prisma, order.number, 'PREPARING');
    await advanceOrderStatus(prisma, order.number, 'PREPARING');
    await advanceOrderStatus(prisma, order.number, 'CANCELLED');
    await advanceOrderStatus(prisma, order.number, 'CANCELLED');
    expect(await prisma.userNotification.count({ where: { userId, kind: 'ORDER_STATUS' } })).toBe(2);
    expect(await prisma.walletTransaction.count({ where: { orderId: order.id, type: 'REFUND' } })).toBe(1);
  });

  it('hediye claim tekrarları tek bildirim ve tek kredi üretir', async () => {
    const { userId } = await account();
    const gift = await prisma.gift.create({ data: { senderId: userId, recipientPhone: '5551112233', type: 'BALANCE', label: '1 TL', amount: 1, redeemCode: 'NOTIFY-GIFT' } });
    await prisma.$transaction((tx) => claimGiftForUser(tx, gift, userId));
    await prisma.$transaction((tx) => claimGiftForUser(tx, gift, userId));
    expect(await prisma.userNotification.count({ where: { userId, kind: 'GIFT_RECEIVED' } })).toBe(1);
    expect(await prisma.walletTransaction.count({ where: { type: 'GIFT_RECEIVED' } })).toBe(1);
  });
});
