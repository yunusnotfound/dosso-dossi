import { randomBytes, createHash } from 'node:crypto';
import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError } from '../../lib/errors.js';
import { requireWebAdmin } from './admin-auth.js';
import { normalizeTurkishPhone } from './commerce.schemas.js';

const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine((value) => !/[\x00-\x08\x0b-\x1f\x7f]/.test(value), 'Kontrol karakteri kullanılamaz.');
export const franchiseInput = z.object({
  name: text(2, 120), email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().max(32).transform(normalizeTurkishPhone).pipe(z.string().regex(/^\+90[2-5]\d{9}$/)),
  city: text(2, 80), space: z.enum(['READY', 'SEARCHING', 'UNDECIDED']), experience: z.enum(['FIRST', 'EXPERIENCED']),
  message: text(10, 3000), privacyAcknowledged: z.literal(true), website: text(0, 200).default(''),
}).strict();
export const franchiseUpdateInput = z.object({ version: z.number().int().min(1), status: z.enum(['NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED']), note: text(0, 2000).default('') }).strict();
const listInput = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), status: z.enum(['NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED']).optional() }).strict();
const json: RequestHandler = (req, res, next) => {
  if (!['POST', 'PATCH'].includes(req.method)) { next(); return; }
  if (!req.is('application/json')) { res.sendStatus(415); return; }
  express.json({ limit: '16kb' })(req, res, next);
};
/** Bounded process-local protection; put a shared edge limit in front of multi-instance deployment. */
function rateLimit() {
  const entries = new Map<string, { count: number; until: number }>();
  return (key: string, limit: number) => {
    const now = Date.now();
    for (const [id, entry] of entries) if (entry.until <= now) entries.delete(id);
    const digest = createHash('sha256').update(key).digest('hex');
    if (!entries.has(digest) && entries.size >= 10000) throw AppError.rateLimited();
    const entry = entries.get(digest) ?? { count: 0, until: now + 3600000 };
    entries.set(digest, entry);
    if (++entry.count > limit) throw AppError.rateLimited();
  };
}
export function createFranchiseRouter(database: () => PrismaClient): Router {
  const router = Router();
  const limit = rateLimit();
  router.post('/franchise-inquiries', (req, _res, next) => { limit(`ip:${req.ip ?? 'unknown'}`, 120); next(); }, json, async (req, res) => {
    const input = franchiseInput.parse(req.body);
    limit(`email:${input.email}`, 3);
    const receipt = `DD-FR-${randomBytes(8).toString('hex').toUpperCase()}`;
    // Bots receive the same receipt shape; no personal data or spam is persisted.
    if (!input.website) {
      const { privacyAcknowledged: _ack, website: _website, ...fields } = input;
      await database().webFranchiseInquiry.create({ data: { ...fields, receipt, privacyAcknowledgedAt: new Date() } });
    }
    res.status(201).json({ receipt });
  });
  router.use('/admin/franchise-inquiries', requireWebAdmin(database), (_req, res, next) => {
    if (res.locals.webAdmin.role !== 'ADMIN') { next(AppError.forbidden()); return; } next();
  }, json);
  router.get('/admin/franchise-inquiries', async (req, res) => {
    const { page, status } = listInput.parse(req.query);
    const where = { status };
    const [inquiries, total] = await Promise.all([
      database().webFranchiseInquiry.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, skip: (page - 1) * 20 }),
      database().webFranchiseInquiry.count({ where }),
    ]);
    res.json({ inquiries, page, total, pageSize: 20 });
  });
  router.patch('/admin/franchise-inquiries/:id', async (req, res) => {
    const input = franchiseUpdateInput.parse(req.body);
    const id = String(req.params.id);
    const updated = await database().webFranchiseInquiry.updateMany({ where: { id, version: input.version }, data: { status: input.status, note: input.note, version: { increment: 1 } } });
    if (!updated.count) throw AppError.idempotencyConflict('Başvuru güncellendi. Listeyi yenileyin.');
    res.json({ inquiry: await database().webFranchiseInquiry.findUniqueOrThrow({ where: { id } }) });
  });
  return router;
}
