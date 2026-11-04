import type { PrismaClient, WebOrderReturnStatus } from '@dosso-dossi/web-prisma';
import { AppError } from '../../lib/errors.js';
import { auditOrder, lockCustomer, lockOrder, orderConflict, orderInclude, orderTransaction, serializeOrder } from './orders.service.js';

export function validReturnTransition(from: WebOrderReturnStatus, to: WebOrderReturnStatus): boolean {
  const transitions: Record<WebOrderReturnStatus, WebOrderReturnStatus[]> = {
    REQUESTED: ['IN_REVIEW', 'REJECTED'], IN_REVIEW: ['ACCEPTED', 'REJECTED'], ACCEPTED: ['RECEIVED'], RECEIVED: ['CLOSED'], REJECTED: [], CLOSED: [],
  };
  return transitions[from].includes(to);
}
export async function requestOrderReturn(database: PrismaClient, customerId: string, id: string, input: { version: number; reason: string }) {
  return orderTransaction(database, async (tx) => {
    await lockCustomer(tx, customerId);
    const order = await lockOrder(tx, id, customerId);
    // A retried submit returns its own existing request, never a second record.
    if (order.returnRequest?.reason === input.reason) return serializeOrder(order);
    if (order.version !== input.version) throw orderConflict();
    if (!serializeOrder(order).canRequestReturn) throw AppError.invalidStatusTransition('İade talebi için ödemesi doğrulanmış bir sipariş gerekli.');
    await tx.webOrderReturn.create({ data: { orderId: id, reason: input.reason } });
    await tx.webOrder.update({ where: { id }, data: { version: { increment: 1 } } });
    await auditOrder(tx, id, 'RETURN_REQUESTED', null);
    return serializeOrder(await tx.webOrder.findUniqueOrThrow({ where: { id }, include: orderInclude }));
  });
}
export async function reviewOrderReturn(database: PrismaClient, id: string, input: { version: number; status: WebOrderReturnStatus; resolutionNote: string }, adminId: string) {
  return orderTransaction(database, async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.version !== input.version) throw orderConflict();
    const request = order.returnRequest;
    if (!request || !validReturnTransition(request.status, input.status)) throw AppError.invalidStatusTransition('İade talebi için geçersiz işlem sırası.');
    if (order.paymentStatus !== 'PAID') throw AppError.invalidStatusTransition('Sipariş ödemesi doğrulanmamış.');
    await tx.webOrderReturn.update({ where: { id: request.id }, data: { status: input.status, resolutionNote: input.resolutionNote } });
    // Deliberately no payment/refund/stock mutation. A provider refund is a separate integration.
    await tx.webOrder.update({ where: { id }, data: { version: { increment: 1 } } });
    await auditOrder(tx, id, 'RETURN_UPDATED', { returnStatus: request.status }, input.resolutionNote, adminId);
    return serializeOrder(await tx.webOrder.findUniqueOrThrow({ where: { id }, include: orderInclude }), true);
  });
}
