import type { OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { logger } from '../../lib/logger.js';
import { cancelOrderInTransaction } from './cancel-order.service.js';
import { notifyOrderStatus } from '../notifications/notifications.service.js';

/// Bir duruma hangi önceki durumlardan geçilebilir.
const VALID_PREDECESSORS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: [],
  PREPARING: ['RECEIVED'],
  READY: ['RECEIVED', 'PREPARING'],
  COMPLETED: ['READY'],
  CANCELLED: ['RECEIVED', 'PREPARING'],
};

/// Geriye gidiş (ör. READY'den sonra PREPARING gelirse) POS olaylarının
/// sırasız ulaşmasındandır → sessizce atlanır. İleri yönde bile tabloda
/// olmayan sıçrama (ör. COMPLETED→PREPARING zaten geriye; RECEIVED→COMPLETED
/// gibi) gerçek hatadır → INVALID_STATUS_TRANSITION.
const ORDER_OF = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED'] as const;

/// tx: runPosEvent transaction'ı YA DA doğrudan prisma istemcisi
/// (PrismaClient yapısal olarak TransactionClient'a atanabilir).
export async function advanceOrderStatus(
  tx: Prisma.TransactionClient | PrismaClient,
  orderNumber: number,
  newStatus: OrderStatus,
  opts: {
    /// false (webhook yolu): imkânsız geçiş hata yerine skip döner —
    /// dış sistemin asla başaramayacağı bir isteği tekrar tekrar
    /// denemesine (retry fırtınası) yol açılmaz. true: simülatör/route
    /// yolu gerçek 409 alır.
    strict?: boolean;
  } = {},
): Promise<{ ok: true; status: string; skipped?: string }> {
  // The simulator may pass the full client; cancellation must never run as
  // separate autocommit statements, and all transitions share the account lock.
  if ('$transaction' in tx) {
    return tx.$transaction((inner) => advanceOrderStatus(inner, orderNumber, newStatus, opts));
  }
  const initial = await tx.order.findUnique({ where: { number: orderNumber } });
  if (!initial) throw AppError.notFound(`Sipariş bulunamadı: DD-${orderNumber}`);
  await lockUsers(tx, [initial.userId]);
  const order = await tx.order.findUniqueOrThrow({ where: { number: orderNumber } });

  if (order.status === newStatus) {
    if (newStatus === 'CANCELLED') {
      // Validate the refund ledger on replay as the admin cancellation does.
      await cancelOrderInTransaction(tx, orderNumber);
    }
    return { ok: true, status: newStatus.toLowerCase(), skipped: 'no_change' };
  }

  const allowed = VALID_PREDECESSORS[newStatus].includes(order.status);
  if (!allowed) {
    const currentIdx = ORDER_OF.indexOf(order.status as (typeof ORDER_OF)[number]);
    const newIdx = ORDER_OF.indexOf(newStatus as (typeof ORDER_OF)[number]);
    if (newIdx !== -1 && currentIdx !== -1 && newIdx < currentIdx) {
      // Geç gelen eski olay — normal, atla
      return {
        ok: true,
        status: order.status.toLowerCase(),
        skipped: 'stale_transition',
      };
    }
    if (opts.strict ?? true) {
      throw AppError.invalidStatusTransition(
        `DD-${orderNumber}: ${order.status} → ${newStatus} geçişi geçersiz`,
      );
    }
    return {
      ok: true,
      status: order.status.toLowerCase(),
      skipped: 'invalid_transition',
    };
  }

  if (newStatus === 'CANCELLED') {
    await cancelOrderInTransaction(tx, orderNumber, { allowedStatuses: VALID_PREDECESSORS.CANCELLED });
    logger.info(`Sipariş DD-${orderNumber} iptal edildi; bakiye ve sadakat geri alındı`);
    return { ok: true, status: 'cancelled' };
  }

  const updated = await tx.order.updateMany({
    where: { number: orderNumber, status: { in: VALID_PREDECESSORS[newStatus] } },
    data: { status: newStatus },
  });
  if (updated.count === 0) {
    // Yarışta durum değişti; tazeleyip aynı mantıkla tekrar değerlendirilebilir
    // ama pratikte bir sonraki olay düzeltir — atla.
    return { ok: true, status: newStatus.toLowerCase(), skipped: 'race' };
  }
  logger.info(`Sipariş DD-${orderNumber} durumu: ${order.status} → ${newStatus}`);
  await notifyOrderStatus(tx, order, newStatus);
  return { ok: true, status: newStatus.toLowerCase() };
}

export const MAX_ORDER_NUMBER = 2_147_483_647; // PostgreSQL Int / Prisma Int

export function parseOrderNumber(orderId: string): number {
  const match = /^DD-(\d+)$/.exec(orderId);
  const number = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(number) || number < 1 || number > MAX_ORDER_NUMBER) {
    throw AppError.notFound(`Geçersiz sipariş numarası: ${orderId}`);
  }
  return number;
}
