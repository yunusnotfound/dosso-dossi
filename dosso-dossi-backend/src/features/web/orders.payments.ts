import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError, ErrorCodes } from '../../lib/errors.js';
import { getPaymentAvailability, initializeSandboxPayment, retrieveSandboxPayment, IyzipayError, type SandboxPaymentInput } from './iyzico.service.js';
import { auditOrder, expireLockedOrder, lockCustomer, lockOrder, orderConflict, orderInclude, orderJson, orderTransaction, serializeOrder } from './orders.service.js';

const paymentUnavailable = () => new AppError(ErrorCodes.PAYMENT_NOT_PENDING, 503, 'iyzico sandbox bilgileri henüz tanımlanmadı. Siparişiniz ödeme bekliyor.');
const paymentUnknown = () => new AppError(ErrorCodes.PAYMENT_NOT_PENDING, 502, 'Ödeme sonucu doğrulanamadı. Yeni ödeme başlatmadan sipariş durumunu kontrol edin.');

export async function startOrderPayment(database: PrismaClient, customerId: string, orderId: string, version: number, ip: string) {
  if (!getPaymentAvailability().configured) throw paymentUnavailable();
  const claim = await orderTransaction(database, async (tx) => {
    await lockCustomer(tx, customerId);
    const order = await lockOrder(tx, orderId, customerId);
    if (order.version !== version) throw orderConflict();
    if (!serializeOrder(order).canPay) throw AppError.paymentNotPending();
    const current = order.attempts[0];
    if (current?.status === 'READY') {
      if (!current.paymentPageUrl || !current.expiresAt || current.expiresAt <= new Date()) throw AppError.paymentNotPending('Ödeme oturumunun süresi doldu. Sonucu kontrol edin veya siparişi iptal edin.');
      return { existing: true as const, order, attempt: current };
    }
    if (current && current.status !== 'FAILED') throw AppError.paymentNotPending();
    const attempt = await tx.webPaymentAttempt.create({ data: { orderId, conversationId: randomUUID() } });
    await tx.webOrder.update({ where: { id: orderId }, data: { paymentStatus: 'PENDING', version: { increment: 1 } } });
    await auditOrder(tx, orderId, 'PAYMENT_INITIALIZING', { paymentStatus: order.paymentStatus });
    return { existing: false as const, order, attempt };
  });
  if (claim.existing) return { order: serializeOrder(claim.order), payment: { ...getPaymentAvailability(), paymentPageUrl: claim.attempt.paymentPageUrl } };
  let initialized: Awaited<ReturnType<typeof initializeSandboxPayment>>;
  try {
    const customer = claim.order.customerSnapshot as { name: string; email: string };
    const address = claim.order.addressSnapshot as SandboxPaymentInput['address'];
    initialized = await initializeSandboxPayment({ orderId, orderNumber: claim.order.number, conversationId: claim.attempt.conversationId,
      totalMinor: claim.order.totalMinor, subtotalMinor: claim.order.subtotalMinor, shippingFeeMinor: claim.order.shippingFeeMinor,
      customer: { id: customerId, name: customer.name, email: customer.email }, address,
      lines: claim.order.items.map((line) => ({ id: line.id, nameTr: line.nameTr, quantity: line.quantity, lineTotalMinor: line.lineTotalMinor })),
      locale: claim.order.locale === 'en' ? 'en' : 'tr', ip,
    });
  } catch (error) {
    const knownFailure = error instanceof IyzipayError && !error.ambiguous;
    await orderTransaction(database, async (tx) => {
      const order = await lockOrder(tx, orderId);
      const attempt = await tx.webPaymentAttempt.findUniqueOrThrow({ where: { id: claim.attempt.id } });
      if (attempt.status !== 'INITIALIZING') return;
      await tx.webPaymentAttempt.update({ where: { id: attempt.id }, data: { status: knownFailure ? 'FAILED' : 'REVIEW', failureCode: error instanceof IyzipayError ? error.code : 'AMBIGUOUS' } });
      await tx.webOrder.update({ where: { id: orderId }, data: { paymentStatus: knownFailure ? 'FAILED' : 'REVIEW', version: { increment: 1 } } });
      await auditOrder(tx, orderId, knownFailure ? 'PAYMENT_INITIALIZE_FAILED' : 'PAYMENT_REVIEW', { paymentStatus: order.paymentStatus });
    });
    throw paymentUnknown();
  }
  return orderTransaction(database, async (tx) => {
    const order = await lockOrder(tx, orderId);
    // If the process crashes after provider initialization, the saved INITIALIZING
    // claim prevents another charge attempt until reconciliation or expiry.
    await tx.webPaymentAttempt.update({ where: { id: claim.attempt.id }, data: { token: initialized.token, paymentPageUrl: initialized.paymentPageUrl, expiresAt: initialized.expiresAt,
      status: order.status === 'OPEN' && order.paymentStatus !== 'REVIEW' ? 'READY' : 'REVIEW' } });
    await tx.webOrder.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    await auditOrder(tx, orderId, 'PAYMENT_READY', { paymentStatus: order.paymentStatus });
    const updated = await tx.webOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    return { order: serializeOrder(updated), payment: { ...getPaymentAvailability(), paymentPageUrl: serializeOrder(updated).canPay ? initialized.paymentPageUrl : null } };
  });
}

/** Callback bodies are hints only. Every state change uses authenticated retrieve. */
export async function reconcilePaymentToken(database: PrismaClient, token: string) {
  const attempt = await database.webPaymentAttempt.findUnique({ where: { token }, include: { order: true } });
  if (!attempt) throw AppError.notFound('Ödeme oturumu bulunamadı.');
  if (attempt.status === 'SUCCEEDED' && attempt.order.paymentStatus === 'PAID') return { id: attempt.order.id, locale: attempt.order.locale };
  let result: Awaited<ReturnType<typeof retrieveSandboxPayment>>;
  try {
    result = await retrieveSandboxPayment({ token, conversationId: attempt.conversationId, orderId: attempt.orderId, totalMinor: attempt.order.totalMinor, locale: attempt.order.locale === 'en' ? 'en' : 'tr' });
  } catch (error) {
    if (error instanceof IyzipayError && error.code === 'NOT_CONFIGURED') throw paymentUnavailable();
    await orderTransaction(database, async (tx) => {
      const order = await lockOrder(tx, attempt.orderId);
      if (order.paymentStatus === 'PAID' || order.attempts[0]?.id !== attempt.id) return;
      const latest = await tx.webPaymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      if (latest.status === 'SUCCEEDED') return;
      await tx.webPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REVIEW', failureCode: error instanceof IyzipayError ? error.code : 'INVALID_RESPONSE' } });
      await tx.webOrder.update({ where: { id: order.id }, data: { paymentStatus: 'REVIEW', version: { increment: 1 } } });
      await auditOrder(tx, order.id, 'PAYMENT_REVIEW', { paymentStatus: order.paymentStatus });
    });
    throw paymentUnknown();
  }
  await orderTransaction(database, async (tx) => {
    let order = await lockOrder(tx, attempt.orderId);
    const currentAttempt = await tx.webPaymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    if (currentAttempt.status === 'SUCCEEDED' && order.paymentStatus === 'PAID') return;
    if (await expireLockedOrder(tx, order)) order = await tx.webOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    const matches = result.conversationId === attempt.conversationId && result.basketId === order.id && result.currency === 'TRY'
      && result.priceMinor === order.totalMinor && result.paidPriceMinor === order.totalMinor;
    const otherPayment = result.paymentId ? await tx.webPaymentAttempt.findUnique({ where: { providerPaymentId: result.paymentId } }) : null;
    const verifiedDetails = matches ? orderJson({ currency: result.currency, priceMinor: result.priceMinor, paidPriceMinor: result.paidPriceMinor, fraudStatus: result.fraudStatus, itemTransactions: result.itemTransactions ?? [] }) : undefined;
    if (order.paymentStatus === 'PAID') {
      if (result.status === 'SUCCESS' && currentAttempt.status !== 'SUCCEEDED') {
        await tx.webPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REVIEW', failureCode: 'ADDITIONAL_PAYMENT', ...(result.paymentId && !otherPayment ? { providerPaymentId: result.paymentId } : {}), verifiedDetails } });
        await auditOrder(tx, order.id, 'ADDITIONAL_PAYMENT_REVIEW', { paymentStatus: order.paymentStatus });
      }
      return;
    }
    const review = !matches || (otherPayment && otherPayment.id !== attempt.id) || (result.status === 'SUCCESS' && (result.fraudStatus !== 1 || !result.paymentId || order.status !== 'OPEN' || order.stockReleasedAt));
    if (review) {
      await tx.webPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REVIEW', failureCode: 'RECONCILIATION_REQUIRED', verifiedDetails, ...(result.paymentId && !otherPayment ? { providerPaymentId: result.paymentId } : {}) } });
      await tx.webOrder.update({ where: { id: order.id }, data: { paymentStatus: 'REVIEW', version: { increment: 1 } } });
      await auditOrder(tx, order.id, 'PAYMENT_REVIEW', { paymentStatus: order.paymentStatus });
      return;
    }
    // Pending fraud review is not an unpaid retryable checkout.
    if (result.status === 'PENDING') {
      await tx.webPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REVIEW', failureCode: 'PROVIDER_PENDING', verifiedDetails } });
      await tx.webOrder.update({ where: { id: order.id }, data: { paymentStatus: 'REVIEW', version: { increment: 1 } } });
      await auditOrder(tx, order.id, 'PAYMENT_REVIEW', { paymentStatus: order.paymentStatus });
      return;
    }
    // A stale failed attempt cannot overwrite a newer ready/payment-review attempt.
    if (result.status === 'FAILURE' && order.attempts[0]?.id !== attempt.id) {
      await tx.webPaymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureCode: 'PROVIDER_REJECTED', verifiedDetails } });
      return;
    }
    const paid = result.status === 'SUCCESS';
    await tx.webPaymentAttempt.update({ where: { id: attempt.id }, data: { status: paid ? 'SUCCEEDED' : 'FAILED', providerPaymentId: result.paymentId || null, failureCode: paid ? null : 'PROVIDER_REJECTED', verifiedDetails } });
    await tx.webOrder.update({ where: { id: order.id }, data: { paymentStatus: paid ? 'PAID' : 'FAILED', ...(paid ? { paidAt: new Date() } : {}), version: { increment: 1 } } });
    await auditOrder(tx, order.id, paid ? 'PAYMENT_VERIFIED' : 'PAYMENT_FAILED', { paymentStatus: order.paymentStatus });
  });
  return { id: attempt.order.id, locale: attempt.order.locale };
}
export async function refreshOrderPayment(database: PrismaClient, customerId: string, orderId: string, version: number) {
  const order = await database.webOrder.findFirst({ where: { id: orderId, customerId }, include: orderInclude });
  if (!order) throw AppError.notFound('Sipariş bulunamadı.');
  if (order.version !== version) throw orderConflict();
  const attempt = order.attempts.find((item) => item.token && (item.status === 'READY' || item.status === 'REVIEW'));
  if (!attempt?.token) throw AppError.paymentNotPending();
  await reconcilePaymentToken(database, attempt.token);
  return serializeOrder(await database.webOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
}
