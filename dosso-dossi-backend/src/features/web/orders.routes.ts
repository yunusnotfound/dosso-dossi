import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError } from '../../lib/errors.js';
import { requireWebAdmin } from './admin-auth.js';
import { requireWebCustomer } from './customer-auth.js';
import { getPaymentAvailability } from './iyzico.service.js';
import { orderAdminInput, orderCreateInput, orderListInput, orderVersionInput } from './orders.schemas.js';
import { cancelOrder, createOrder, expireOrders, listOrders, manageOrder, readOrder, readOrderQuote } from './orders.service.js';
import { reconcilePaymentToken, refreshOrderPayment, startOrderPayment } from './orders.payments.js';

const boundedJson: RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { next(); return; }
  if (!req.is('application/json')) { res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'JSON içerik türü gerekli.' } }); return; }
  express.json({ limit: '4kb' })(req, res, next);
};
function mutationLimit(): RequestHandler {
  const entries = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    if (!['POST', 'PATCH'].includes(req.method)) { next(); return; }
    const now = Date.now();
    for (const [key, value] of entries) if (value.until <= now) entries.delete(key);
    const key = res.locals.webCustomer?.id ?? res.locals.webAdmin?.id ?? req.ip ?? 'unknown';
    if (!entries.has(key) && entries.size >= 10000) { next(AppError.rateLimited()); return; }
    const entry = entries.get(key) ?? { count: 0, until: now + 60000 };
    entries.set(key, entry); entry.count++;
    if (entry.count > 30) { res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.until - now) / 1000)))); next(AppError.rateLimited()); return; }
    next();
  };
}
function callbackDestination(id: string, locale: string) {
  const source = process.env.WEB_PUBLIC_URL?.trim() || (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:4000' : '');
  let origin: URL;
  try { origin = new URL(source); } catch { throw new Error('Web public origin is unavailable.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local && process.env.NODE_ENV !== 'production'))) throw new Error('Web public origin is invalid.');
  return new URL(`${locale === 'en' ? '/en' : ''}/hesabim/siparislerim/${encodeURIComponent(id)}`, origin.origin).toString();
}
export function createWebOrdersRouter(database: () => PrismaClient): Router {
  const router = Router();
  router.use(['/orders', '/admin/orders', '/payments/iyzico/callback'], (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  router.post('/payments/iyzico/callback', mutationLimit(), (req, res, next) => {
    if (!req.is('application/x-www-form-urlencoded')) { res.status(415).end(); return; }
    express.urlencoded({ extended: false, limit: '2kb', parameterLimit: 4 })(req, res, next);
  }, async (req, res) => {
    const { token } = z.object({ token: z.string().min(8).max(256).regex(/^[A-Za-z0-9_-]+$/) }).strict().parse(req.body);
    const result = await reconcilePaymentToken(database(), token);
    res.redirect(303, callbackDestination(result.id, result.locale));
  });
  router.use('/orders', requireWebCustomer(database), mutationLimit(), boundedJson, async (_req, _res, next) => { await expireOrders(database(), 10); next(); });
  router.get('/orders/quote', async (_req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, quote: await readOrderQuote(database(), customerId) });
  });
  router.get('/orders', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, ...await listOrders(database(), orderListInput.parse(req.query), customerId), payment: getPaymentAvailability() });
  });
  router.post('/orders', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    const result = await createOrder(database(), customerId, orderCreateInput.parse(req.body));
    res.status(result.created ? 201 : 200).json({ customerId, order: result.order });
  });
  router.get('/orders/:id', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, order: await readOrder(database(), String(req.params.id), customerId), payment: getPaymentAvailability() });
  });
  router.post('/orders/:id/cancel', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, order: await cancelOrder(database(), String(req.params.id), orderVersionInput.parse(req.body).version, customerId) });
  });
  router.post('/orders/:id/payment', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, ...await startOrderPayment(database(), customerId, String(req.params.id), orderVersionInput.parse(req.body).version, req.ip || '127.0.0.1') });
  });
  router.post('/orders/:id/payment/refresh', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, order: await refreshOrderPayment(database(), customerId, String(req.params.id), orderVersionInput.parse(req.body).version) });
  });
  router.use('/admin/orders', requireWebAdmin(database), (_req, res, next) => { if (res.locals.webAdmin.role !== 'ADMIN') { next(AppError.forbidden()); return; } next(); }, mutationLimit(), boundedJson,
    async (_req, _res, next) => { await expireOrders(database(), 10); next(); });
  router.get('/admin/orders', async (req, res) => { res.json({ ...await listOrders(database(), orderListInput.parse(req.query)), payment: getPaymentAvailability() }); });
  router.get('/admin/orders/:id', async (req, res) => { res.json({ order: await readOrder(database(), String(req.params.id)), payment: getPaymentAvailability() }); });
  router.patch('/admin/orders/:id', async (req, res) => { res.json({ order: await manageOrder(database(), String(req.params.id), orderAdminInput.parse(req.body), res.locals.webAdmin.id) }); });
  return router;
}
