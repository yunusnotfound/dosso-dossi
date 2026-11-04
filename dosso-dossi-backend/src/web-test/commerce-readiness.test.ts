import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient, WebOrderMessage } from '@dosso-dossi/web-prisma';
import { franchiseInput, createFranchiseRouter } from '../features/web/franchise.routes.js';
import { productDetailsInput, productInput } from '../features/web/catalog.schemas.js';
import { customerProfileInput } from '../features/web/customer-auth.schemas.js';
import { validReturnTransition } from '../features/web/order-returns.js';
import { dispatchOrderMessages, orderMessageContent } from '../features/web/order-messages.js';
import { errorHandler } from '../middleware/error-handler.js';

const inquiry = { name: 'Test Person', email: 'test@example.test', phone: '0532 123 45 67', city: 'İstanbul', space: 'SEARCHING', experience: 'FIRST', message: 'Bir şube açmak için bilgi almak istiyorum.', privacyAcknowledged: true };
function franchiseFixture() {
  const create = vi.fn().mockResolvedValue({ id: 'private' });
  const database = { webFranchiseInquiry: { create }, webAdminSession: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
  const app = express(); app.use('/web', createFranchiseRouter(() => database)); app.use(errorHandler);
  return { app, create };
}
describe('franchise intake boundaries', () => {
  it('requires explicit privacy acknowledgement and validates a real Turkish contact number', () => {
    expect(franchiseInput.parse(inquiry).phone).toBe('+905321234567');
    expect(franchiseInput.safeParse({ ...inquiry, privacyAcknowledged: false }).success).toBe(false);
    expect(franchiseInput.safeParse({ ...inquiry, phone: '1234' }).success).toBe(false);
    expect(franchiseInput.safeParse({ ...inquiry, status: 'CLOSED' }).success).toBe(false);
  });
  it('persists validated submissions but returns only an opaque receipt', async () => {
    const { app, create } = franchiseFixture();
    const result = await request(app).post('/web/franchise-inquiries').send(inquiry);
    expect(result.status).toBe(201); expect(result.body).toEqual({ receipt: expect.stringMatching(/^DD-FR-[0-9A-F]{16}$/) });
    expect(create.mock.calls[0]?.[0].data).toMatchObject({ email: inquiry.email, privacyAcknowledgedAt: expect.any(Date) });
    expect(JSON.stringify(result.body)).not.toContain(inquiry.email);
  });
  it('does not persist honeypot submissions or accept a privileged field', async () => {
    const { app, create } = franchiseFixture();
    expect((await request(app).post('/web/franchise-inquiries').send({ ...inquiry, website: 'bot' })).status).toBe(201);
    expect(create).not.toHaveBeenCalled();
    expect((await request(app).post('/web/franchise-inquiries').send({ ...inquiry, note: 'override' })).status).toBe(400);
  });
  it('bounds repeated requests without creating additional records', async () => {
    const { app, create } = franchiseFixture();
    for (let i = 0; i < 3; i++) expect((await request(app).post('/web/franchise-inquiries').send(inquiry)).status).toBe(201);
    expect((await request(app).post('/web/franchise-inquiries').send(inquiry)).status).toBe(429);
    expect(create).toHaveBeenCalledTimes(3);
  });
  it('refuses anonymous admin reads and oversized payloads', async () => {
    const { app } = franchiseFixture();
    expect((await request(app).get('/web/admin/franchise-inquiries')).status).toBe(401);
    expect((await request(app).post('/web/franchise-inquiries').send({ ...inquiry, message: 'x'.repeat(17000) })).status).toBe(413);
  });
});
describe('bounded factual product details and profile edits', () => {
  it('accepts unknown details as empty but refuses invented field types and duplicate criteria', () => {
    expect(productDetailsInput.parse({})).toEqual({});
    expect(productDetailsInput.safeParse({ brewGuideTr: '18 g kahve\n300 ml su', careEn: 'Wash by hand.\nDry the lid.' }).success).toBe(true);
    expect(productDetailsInput.safeParse({ brewingMethods: ['FILTER', 'FILTER'] }).success).toBe(false);
    expect(productDetailsInput.safeParse({ roast: 'MAGICAL', caffeineFree: true }).success).toBe(false);
    expect(productDetailsInput.safeParse({ careTr: 'x'.repeat(2001) }).success).toBe(false);
  });
  it('does not mix coffee criteria into a thermos', () => {
    const base = { slug: 'thermos', type: 'THERMOS', status: 'DRAFT', nameTr: 'Termos', nameEn: '', descriptionTr: '', descriptionEn: '', sortOrder: 0, images: [], variants: [], grindOptions: [] };
    expect(productInput.safeParse({ ...base, details: { roast: 'DARK' } }).success).toBe(false);
    expect(productInput.safeParse({ ...base, details: { careTr: 'Elde yıkayın.' } }).success).toBe(true);
  });
  it('does not accept account ownership, email, password or verification changes through profile edits', () => {
    for (const extra of [{ email: 'other@example.test' }, { id: 'other' }, { emailVerifiedAt: new Date() }, { password: 'x'.repeat(20) }])
      expect(customerProfileInput.safeParse({ name: 'Customer', locale: 'tr', ...extra }).success).toBe(false);
    expect(customerProfileInput.parse({ name: '  Customer Name  ', locale: 'en' }).name).toBe('Customer Name');
  });
});
describe('operational returns never imply a money refund', () => {
  it('permits review then receipt while rejecting skipped and reopened final states', () => {
    expect(validReturnTransition('REQUESTED', 'IN_REVIEW')).toBe(true);
    expect(validReturnTransition('IN_REVIEW', 'ACCEPTED')).toBe(true);
    expect(validReturnTransition('ACCEPTED', 'RECEIVED')).toBe(true);
    expect(validReturnTransition('RECEIVED', 'CLOSED')).toBe(true);
    expect(validReturnTransition('REQUESTED', 'CLOSED')).toBe(false);
    expect(validReturnTransition('CLOSED', 'REQUESTED')).toBe(false);
    expect(validReturnTransition('REJECTED', 'ACCEPTED')).toBe(false);
  });
});
const message = (): WebOrderMessage => ({ id: 'mail1', orderId: 'order1', dedupeKey: 'order1:SHIP:2', recipient: 'customer@example.test', locale: 'tr', kind: 'SHIP', status: 'SENDING', attempts: 1, availableAt: new Date(0), firstAttemptAt: new Date('2026-10-28T12:00:00Z'), lockedAt: new Date('2026-10-28T12:00:00Z'), sentAt: null, lastError: null, createdAt: new Date(0), payload: { number: 'DD-TEST', name: '<script>unsafe</script>', orderId: 'order1', carrier: 'Carrier', trackingNumber: '123', returnStatus: null, sandbox: true } });
function outboxFixture(row: WebOrderMessage) {
  let next = true;
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = { webOrderMessage: { findFirst: vi.fn(async () => { if (!next) return null; next = false; return row; }), updateMany, findUniqueOrThrow: vi.fn().mockResolvedValue(row) } };
  const database = { $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)), webOrderMessage: { updateMany } } as unknown as PrismaClient;
  return { database, updateMany };
}
describe('transactional mail outbox safety', () => {
  it('does nothing when disabled including no database call or send', async () => {
    const send = vi.fn(); const database = {} as PrismaClient;
    expect(await dispatchOrderMessages(database, { enabled: false, send })).toEqual({ sent: 0, failed: 0 }); expect(send).not.toHaveBeenCalled();
  });
  it('escapes user fields and clearly identifies sandbox mail', () => {
    const content = orderMessageContent(message(), 'https://shop.example.test');
    expect(content.html).not.toContain('<script>'); expect(content.html).toContain('&lt;script&gt;');
    expect(content.text).toContain('Gerçek ödeme, teslimat veya para iadesi yapılmaz.');
    expect(content.text).toContain('https://shop.example.test/hesabim/siparislerim/order1');
  });
  it('records successful provider acceptance once and clears its processing lease', async () => {
    const { database, updateMany } = outboxFixture(message()); const send = vi.fn().mockResolvedValue(undefined);
    expect(await dispatchOrderMessages(database, { enabled: true, send, now: () => new Date('2026-10-28T12:00:00Z') })).toEqual({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: 'SENT', lockedAt: null, lastError: null });
  });
  it('marks success only after provider acceptance, keeping failed work retryable', async () => {
    const { database, updateMany } = outboxFixture(message());
    const send = vi.fn().mockRejectedValue(new Error('secret provider response'));
    expect(await dispatchOrderMessages(database, { enabled: true, send, now: () => new Date('2026-10-28T12:00:00Z') })).toEqual({ sent: 0, failed: 1 });
    expect(updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: 'PENDING', lastError: 'DELIVERY_NOT_CONFIRMED', lockedAt: null });
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain('secret provider');
  });
  it('stops old uncertain delivery attempts before contacting a provider', async () => {
    const { database, updateMany } = outboxFixture(message()); const send = vi.fn();
    expect(await dispatchOrderMessages(database, { enabled: true, send, now: () => new Date('2026-10-28T19:00:00Z') })).toEqual({ sent: 0, failed: 1 });
    expect(send).not.toHaveBeenCalled(); expect(updateMany.mock.calls.at(-1)?.[0].data.status).toBe('FAILED');
  });
});
