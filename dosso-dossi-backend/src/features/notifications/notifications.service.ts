import type { NotificationKind, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { builtInStoryActions } from '../campaign-stories/stories.schema.js';

export interface NotificationInput {
  userId: string;
  kind: NotificationKind;
  dedupeKey: string;
  title: string;
  body: string;
  targetPath: string;
}

/** Call with the domain transaction: notifications never outlive a rolled-back action. */
export async function emitNotification(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void> {
  if (input.kind === 'ORDER_STATUS' || input.kind === 'CAMPAIGN') {
    const preferences = await tx.notificationPrefs.findUnique({ where: { userId: input.userId } });
    if (input.kind === 'ORDER_STATUS' && preferences?.orderStatus === false) return;
    if (input.kind === 'CAMPAIGN' && preferences?.campaigns === false) return;
  }
  await tx.userNotification.createMany({ data: [input], skipDuplicates: true });
}

const orderMessages: Record<OrderStatus, string> = {
  RECEIVED: 'Siparişin alındı.', PREPARING: 'Siparişin hazırlanıyor.', READY: 'Siparişin teslim almaya hazır.',
  COMPLETED: 'Siparişin teslim edildi. Afiyet olsun!', CANCELLED: 'Siparişin iptal edildi; iaden cüzdanına işlendi.',
};

export function notifyOrderStatus(tx: Prisma.TransactionClient, order: { id: string; userId: string; number: number }, status: OrderStatus) {
  return emitNotification(tx, {
    userId: order.userId, kind: 'ORDER_STATUS', dedupeKey: `order:${order.id}:${status}`,
    title: `Sipariş DD-${order.number}`, body: orderMessages[status], targetPath: `/siparis-takip/DD-${order.number}`,
  });
}

const campaignPaths: Record<string, string> = {
  'kahve-ictikce': '/ikramlarim', 'yukle-kazan': '/kampanya/yukle-kazan',
  'online-magaza': '/online-magaza', siparis: '/siparis', none: '/',
};

/** Lazily deliver the latest active campaigns to this user, at most once per published story. */
async function syncCampaignNotifications(userId: string): Promise<void> {
  const prefs = await prisma.notificationPrefs.findUnique({ where: { userId } });
  if (prefs?.campaigns === false) return;
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: [...builtInStoryActions] }, isActive: true }, select: { id: true },
  });
  const stories = await prisma.campaignStory.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        { OR: [{ action: { notIn: [...builtInStoryActions] } }, { action: { in: campaigns.map((c) => c.id) } }] },
      ],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
    select: { id: true, title: true, description: true, action: true },
  });
  if (!stories.length) return;
  await prisma.userNotification.createMany({
    data: stories.map((story) => ({
      userId, kind: 'CAMPAIGN', dedupeKey: `story:${story.id}`, title: story.title,
      body: story.description, targetPath: campaignPaths[story.action] ?? '/',
    })), skipDuplicates: true,
  });
}

export async function listNotifications(userId: string, page = 1) {
  await syncCampaignNotifications(userId);
  const pageSize = 30;
  const [rows, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({
      where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize + 1,
      select: { id: true, kind: true, title: true, body: true, targetPath: true, readAt: true, createdAt: true },
    }),
    prisma.userNotification.count({ where: { userId, readAt: null } }),
  ]);
  return { page, entries: rows.slice(0, pageSize), unreadCount, hasMore: rows.length > pageSize };
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.userNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  const row = await prisma.userNotification.findFirst({
    where: { id, userId }, select: { id: true, readAt: true },
  });
  if (!row) throw AppError.notFound('Bildirim bulunamadı');
  return row;
}
