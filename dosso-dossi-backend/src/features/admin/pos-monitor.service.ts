import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from './audit.js';

export async function listEvents(opts: {
  source?: string;
  eventType?: string;
  status?: 'RECEIVED' | 'PROCESSED' | 'FAILED';
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, opts.pageSize ?? 50));
  const where: Prisma.PosEventWhereInput = {
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.eventType ? { eventType: opts.eventType } : {}),
    ...(opts.status ? { status: opts.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.posEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.posEvent.count({ where }),
  ]);

  return {
    page,
    pageSize,
    total,
    events: rows.map((e) => ({
      id: e.id,
      source: e.source,
      eventType: e.eventType,
      externalId: e.externalId,
      status: e.status,
      error: e.error,
      payload: e.payload,
      response: e.response,
      createdAt: e.createdAt.toISOString(),
      processedAt: e.processedAt?.toISOString() ?? null,
    })),
  };
}

/// Webhook sağlık göstergesi: kaynak başına en son ne zaman ses geldi.
export async function health() {
  const grouped = await prisma.posEvent.groupBy({
    by: ['source', 'status'],
    _count: true,
    _max: { createdAt: true },
  });

  const bySource = new Map<
    string,
    { source: string; lastSeenAt: string | null; total: number; failed: number }
  >();
  for (const g of grouped) {
    const cur = bySource.get(g.source) ?? {
      source: g.source,
      lastSeenAt: null,
      total: 0,
      failed: 0,
    };
    cur.total += g._count;
    if (g.status === 'FAILED') cur.failed += g._count;
    const seen = g._max.createdAt?.toISOString() ?? null;
    if (seen && (!cur.lastSeenAt || seen > cur.lastSeenAt)) cur.lastSeenAt = seen;
    bySource.set(g.source, cur);
  }

  // Mini-outbox: iletilememiş siparişler
  const outbox = await prisma.order.findMany({
    where: { forwardedAt: null, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { branch: { select: { name: true } } },
  });

  return {
    sources: [...bySource.values()],
    outbox: outbox.map((o) => ({
      id: `DD-${o.number}`,
      number: o.number,
      branchName: o.branch.name,
      createdAt: o.createdAt.toISOString(),
      // Kaç dakikadır bekliyor — sweep 60 sn'de bir denediği için
      // uzun süre bekleyen gerçek bir aksaklıktır.
      waitingMinutes: Math.floor((Date.now() - o.createdAt.getTime()) / 60_000),
    })),
  };
}

/// FAILED olayı yeniden işlenebilir duruma çeker. İşin kendisi idempotent
/// runPosEvent tarafından yapılır; burada yalnızca kilit açılır ve iz düşülür.
export async function requeue(req: Request, id: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.posEvent.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Olay bulunamadı');
    if (before.status !== 'FAILED') {
      throw AppError.invalidStatusTransition('Yalnızca FAILED olaylar yeniden kuyruğa alınır');
    }
    const after = await tx.posEvent.update({
      where: { id },
      data: { status: 'RECEIVED', error: null, processedAt: null },
    });
    await audit(tx, req, {
      action: 'posEvent.requeue',
      entity: 'PosEvent',
      entityId: id,
      before: { status: before.status, error: before.error },
      after: { status: after.status },
      reason,
    });
    return { ok: true };
  });
}
