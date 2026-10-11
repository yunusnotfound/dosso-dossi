import type { AccountRequest, AccountRequestKind, AccountRequestStatus } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { assertActiveUser } from '../../lib/active-user.js';
import { AppError } from '../../lib/errors.js';
import { toMoney } from '../../lib/money.js';
import { audit } from '../admin/audit.js';
import { emitNotification } from '../notifications/notifications.service.js';

const openStatuses: AccountRequestStatus[] = ['OPEN', 'IN_REVIEW'];
export function serializeAccountRequest(record: AccountRequest) {
  return {
    id: record.id, kind: record.kind, status: record.status, note: record.note,
    response: record.response, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listAccountRequests(userId: string) {
  return (await prisma.accountRequest.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }))
    .map(serializeAccountRequest);
}

export async function createAccountRequest(userId: string, input: { kind: AccountRequestKind; note: string }) {
  return prisma.$transaction(async (tx) => {
    await lockUsers(tx, [userId]);
    await assertActiveUser(tx, userId);
    const openKey = `${userId}:${input.kind}`;
    const existing = await tx.accountRequest.findUnique({ where: { openKey } });
    if (existing) return serializeAccountRequest(existing);
    const created = await tx.accountRequest.create({ data: { userId, ...input, openKey } });
    return serializeAccountRequest(created);
  });
}

export async function cancelAccountRequest(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await lockUsers(tx, [userId]);
    const record = await tx.accountRequest.findFirst({ where: { id, userId } });
    if (!record) throw AppError.notFound('Talep bulunamadı');
    if (record.status === 'CANCELLED') return serializeAccountRequest(record);
    if (!openStatuses.includes(record.status)) throw AppError.invalidStatusTransition('Sonuçlanan talep iptal edilemez');
    return serializeAccountRequest(await tx.accountRequest.update({ where: { id }, data: { status: 'CANCELLED', openKey: null } }));
  });
}

export async function adminAccountRequests(input: { status?: AccountRequestStatus; page: number }) {
  const where = input.status ? { status: input.status } : {};
  const pageSize = 30;
  const [rows, total] = await Promise.all([
    prisma.accountRequest.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * pageSize, take: pageSize,
      include: { user: { select: { id: true, name: true, phone: true, email: true, wallet: { select: { balance: true } } } } },
    }), prisma.accountRequest.count({ where }),
  ]);
  return {
    page: input.page, total, pageSize,
    entries: rows.map((row) => ({
      ...serializeAccountRequest(row),
      user: { id: row.user.id, name: row.user.name, phone: row.user.phone, email: row.user.email },
      balance: toMoney(row.user.wallet?.balance ?? 0),
    })),
  };
}

export async function updateAccountRequest(req: Request, id: string, input: { status: 'IN_REVIEW' | 'COMPLETED' | 'REJECTED'; response: string }) {
  return prisma.$transaction(async (tx) => {
    const initial = await tx.accountRequest.findUnique({ where: { id } });
    if (!initial) throw AppError.notFound('Talep bulunamadı');
    await lockUsers(tx, [initial.userId]);
    const before = await tx.accountRequest.findUniqueOrThrow({ where: { id } });
    if (!openStatuses.includes(before.status)) {
      if (before.status === input.status && before.response === input.response) return serializeAccountRequest(before);
      throw AppError.invalidStatusTransition('Sonuçlanan talep değiştirilemez');
    }
    if (before.kind === 'CLOSURE' && input.status === 'COMPLETED') {
      const closingUser = await tx.user.findUniqueOrThrow({ where: { id: before.userId }, select: { phone: true } });
      const [wallet, activeOrders, payments, gifts] = await Promise.all([
        tx.wallet.findUnique({ where: { userId: before.userId } }),
        tx.order.count({ where: { userId: before.userId, status: { in: ['RECEIVED', 'PREPARING', 'READY'] } } }),
        tx.paymentIntent.count({ where: { userId: before.userId, status: 'PENDING' } }),
        tx.gift.count({ where: { status: 'PENDING', OR: [{ senderId: before.userId }, { recipientPhone: closingUser.phone }] } }),
      ]);
      if (wallet && !wallet.balance.equals(0)) throw AppError.invalidStatusTransition('Hesap kapatılmadan önce cüzdan bakiyesi sıfırlanmalı');
      if (activeOrders || payments || gifts) throw AppError.invalidStatusTransition('Aktif sipariş, bekleyen yükleme veya gönderilen/alınan bekleyen hediye sonuçlanmalı');
      const closedAt = new Date();
      await tx.user.update({ where: { id: before.userId }, data: { closedAt, isBlocked: true, tokenVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId: before.userId, revokedAt: null }, data: { revokedAt: closedAt } });
      await tx.qrToken.updateMany({ where: { userId: before.userId, consumedAt: null }, data: { consumedAt: closedAt, expiresAt: closedAt } });
    }
    const after = await tx.accountRequest.update({ where: { id }, data: {
      ...input, ...(input.status === 'IN_REVIEW' ? {} : { openKey: null }),
    } });
    await audit(tx, req, { action: 'accountRequest.update', entity: 'AccountRequest', entityId: id, before, after, reason: input.response });
    await emitNotification(tx, {
      userId: before.userId, kind: 'ACCOUNT_REQUEST', dedupeKey: `account-request:${id}:${input.status}`,
      title: 'Hesap talebin güncellendi', body: input.response, targetPath: '/profil/hesap-talepleri',
    });
    return serializeAccountRequest(after);
  });
}
