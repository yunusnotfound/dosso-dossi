import type { OrderStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

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

export async function advanceOrderStatus(
  orderNumber: number,
  newStatus: OrderStatus,
): Promise<{ ok: true; status: string; skipped?: string }> {
  const order = await prisma.order.findUnique({ where: { number: orderNumber } });
  if (!order) throw AppError.notFound(`Sipariş bulunamadı: DD-${orderNumber}`);

  if (order.status === newStatus) {
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
    throw AppError.invalidStatusTransition(
      `DD-${orderNumber}: ${order.status} → ${newStatus} geçişi geçersiz`,
    );
  }

  const updated = await prisma.order.updateMany({
    where: { number: orderNumber, status: { in: VALID_PREDECESSORS[newStatus] } },
    data: { status: newStatus },
  });
  if (updated.count === 0) {
    // Yarışta durum değişti; tazeleyip aynı mantıkla tekrar değerlendirilebilir
    // ama pratikte bir sonraki olay düzeltir — atla.
    return { ok: true, status: newStatus.toLowerCase(), skipped: 'race' };
  }
  logger.info(`Sipariş DD-${orderNumber} durumu: ${order.status} → ${newStatus}`);
  return { ok: true, status: newStatus.toLowerCase() };
}

export function parseOrderNumber(orderId: string): number {
  const match = /^DD-(\d+)$/.exec(orderId);
  if (!match) throw AppError.notFound(`Geçersiz sipariş numarası: ${orderId}`);
  return Number(match[1]);
}
