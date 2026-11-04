import type { Prisma, PrismaClient, WebOrderMessage } from '@dosso-dossi/web-prisma';
import { z } from 'zod';
import { getCustomerMailConfiguration } from './customer-mail.js';

const payloadInput = z.object({
  number: z.string().max(80), name: z.string().max(120), orderId: z.string().max(80),
  carrier: z.string().max(80).nullable(), trackingNumber: z.string().max(100).nullable(),
  returnStatus: z.string().max(30).nullable(), sandbox: z.literal(true),
}).strict();
const events = new Set(['CREATED', 'PAYMENT_VERIFIED', 'PREPARE', 'SHIP', 'DELIVER', 'CANCELLED', 'EXPIRED', 'RETURN_REQUESTED', 'RETURN_UPDATED']);
/** Called inside the same transaction as the order change. Delivery never blocks checkout. */
export async function queueOrderMessage(tx: Prisma.TransactionClient, orderId: string, kind: string) {
  if (!events.has(kind)) return;
  const order = await tx.webOrder.findUniqueOrThrow({ where: { id: orderId }, include: { returnRequest: true } });
  const customer = z.object({ email: z.string().email().max(254), name: z.string().max(120) }).safeParse(order.customerSnapshot);
  if (!customer.success) throw new Error('Order customer snapshot is invalid.');
  await tx.webOrderMessage.createMany({ data: [{
    orderId, kind, dedupeKey: `${orderId}:${kind}:${order.version}`, recipient: customer.data.email, locale: order.locale,
    payload: { number: order.number, name: customer.data.name, orderId, carrier: order.carrier, trackingNumber: order.trackingNumber,
      returnStatus: order.returnRequest?.status ?? null, sandbox: true },
  }], skipDuplicates: true });
}
const copy: Record<string, [string, string]> = {
  CREATED: ['Test siparişiniz alındı', 'Your test order has been received'], PAYMENT_VERIFIED: ['Test ödemeniz doğrulandı', 'Your test payment has been verified'],
  PREPARE: ['Test siparişiniz hazırlanıyor', 'Your test order is being prepared'], SHIP: ['Test siparişinizin gönderim bilgileri güncellendi', 'Your test order shipping details have been updated'],
  DELIVER: ['Test siparişiniz teslim edildi olarak işaretlendi', 'Your test order has been marked as delivered'], CANCELLED: ['Test siparişiniz iptal edildi', 'Your test order has been cancelled'],
  EXPIRED: ['Test siparişinizin ödeme süresi doldu', 'The payment window for your test order expired'], RETURN_REQUESTED: ['İade talebiniz alındı', 'Your return request has been received'],
  RETURN_UPDATED: ['İade talebiniz güncellendi', 'Your return request has been updated'],
};
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function orderMessageContent(message: Pick<WebOrderMessage, 'kind' | 'payload' | 'locale'>, origin: string) {
  const payload = payloadInput.parse(message.payload);
  const titles = copy[message.kind];
  if (!titles) throw new Error('Unsupported order message.');
  const en = message.locale === 'en';
  const title = titles[en ? 1 : 0];
  const url = new URL(`${en ? '/en' : ''}/hesabim/siparislerim/${encodeURIComponent(payload.orderId)}`, origin).toString();
  const disclaimer = en ? 'This is a sandbox test order. No real payment, delivery or refund is performed.' : 'Bu bir sandbox test siparişidir. Gerçek ödeme, teslimat veya para iadesi yapılmaz.';
  const shipping = message.kind === 'SHIP' && payload.carrier && payload.trackingNumber ? `${payload.carrier} · ${payload.trackingNumber}` : '';
  const text = [title, `${payload.name} · ${payload.number}`, shipping, disclaimer, url].filter(Boolean).join('\n\n');
  return { subject: `Dosso Dossi · ${title}`, text, html: `<main><h1>${escape(title)}</h1><p>${escape(payload.name)} · ${escape(payload.number)}</p>${shipping ? `<p>${escape(shipping)}</p>` : ''}<p>${escape(disclaimer)}</p><p><a href="${escape(url)}">${en ? 'View order' : 'Siparişimi görüntüle'}</a></p></main>` };
}
async function deliver(message: WebOrderMessage) {
  const config = getCustomerMailConfiguration();
  // Transactional order mail has its own explicit opt-in; customer authentication mail is independent.
  if (config.delivery !== 'resend') throw new Error('Order email provider is not configured.');
  const content = orderMessageContent(message, config.publicUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `web-order-${message.id}` },
    body: JSON.stringify({ from: config.from, to: [message.recipient], ...content }), signal: AbortSignal.timeout(5000), redirect: 'error',
  });
  if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw new Error('Order email delivery not accepted.'); }
  await response.body?.cancel().catch(() => undefined);
}
/** Explicit worker only; no timers, no import-time sends. Disabled means no database reads or writes. */
export async function dispatchOrderMessages(database: PrismaClient, options: { enabled?: boolean; send?: (message: WebOrderMessage) => Promise<void>; now?: () => Date; limit?: number } = {}) {
  if (!(options.enabled ?? process.env.WEB_ORDER_EMAIL_ENABLED === 'true')) return { sent: 0, failed: 0 };
  if (!options.send && getCustomerMailConfiguration().delivery !== 'resend') throw new Error('Order email requires a configured delivery provider.');
  const now = options.now ?? (() => new Date());
  const send = options.send ?? deliver;
  const limit = Math.min(25, Math.max(1, options.limit ?? 10));
  let sent = 0, failed = 0;
  for (let index = 0; index < limit; index++) {
    const time = now();
    const message = await database.$transaction(async (tx) => {
      const candidate = await tx.webOrderMessage.findFirst({ where: { availableAt: { lte: time }, OR: [{ status: 'PENDING' }, { status: 'SENDING', lockedAt: { lte: new Date(time.getTime() - 600000) } }] }, orderBy: [{ availableAt: 'asc' }, { id: 'asc' }] });
      if (!candidate) return null;
      const claimed = await tx.webOrderMessage.updateMany({ where: { id: candidate.id, status: candidate.status, lockedAt: candidate.lockedAt, attempts: candidate.attempts }, data: { status: 'SENDING', lockedAt: time, firstAttemptAt: candidate.firstAttemptAt ?? time, attempts: { increment: 1 } } });
      return claimed.count ? tx.webOrderMessage.findUniqueOrThrow({ where: { id: candidate.id } }) : null;
    });
    if (!message) break;
    // Stop uncertain deliveries after six hours instead of silently replaying old provider keys.
    if (message.attempts > 5 || (message.firstAttemptAt && time.getTime() - message.firstAttemptAt.getTime() >= 21600000)) {
      await database.webOrderMessage.updateMany({ where: { id: message.id, status: 'SENDING', lockedAt: time }, data: { status: 'FAILED', lockedAt: null, lastError: 'DELIVERY_REVIEW_REQUIRED' } });
      failed++; continue;
    }
    try {
      await send(message);
      await database.webOrderMessage.updateMany({ where: { id: message.id, status: 'SENDING', lockedAt: time }, data: { status: 'SENT', sentAt: now(), lockedAt: null, lastError: null } });
      sent++;
    } catch {
      await database.webOrderMessage.updateMany({ where: { id: message.id, status: 'SENDING', lockedAt: time }, data: { status: message.attempts >= 5 ? 'FAILED' : 'PENDING', availableAt: new Date(time.getTime() + Math.min(1800000, 60000 * 2 ** message.attempts)), lockedAt: null, lastError: 'DELIVERY_NOT_CONFIRMED' } });
      failed++;
    }
  }
  return { sent, failed };
}
