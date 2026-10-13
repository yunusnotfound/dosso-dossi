import express, { Router } from 'express';
import path from 'node:path';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError } from '../../lib/errors.js';
import { hashSession, loginRateLimit, requireWebAdmin, sessionToken, webAdminLogin } from './admin-auth.js';
import { loginInput, mediaInput, productInput } from './catalog.schemas.js';
import { productInclude, saveProduct, serializeProduct } from './catalog.service.js';
import { defaultWebMediaRoot, saveWebMedia } from './media.js';

export function createCatalogRouter(database: () => PrismaClient, mediaRoot = defaultWebMediaRoot()): Router {
  const router = Router();
  const loginLimiter = loginRateLimit();
  router.get('/catalog', async (_req, res) => {
    const products = await database().webProduct.findMany({ where: { status: 'PUBLISHED', variants: { some: { active: true } } }, include: productInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    res.json({ products: products.map((item) => serializeProduct(item, true)) });
  });
  router.get('/media/:filename', async (req, res, next) => {
    const filename = req.params.filename;
    if (typeof filename !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(filename)) throw AppError.notFound();
    if (!await database().webMedia.findUnique({ where: { filename }, select: { id: true } })) throw AppError.notFound();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('image/webp').sendFile(path.join(mediaRoot, filename), (error) => { if (error) next(AppError.notFound('Görsel bulunamadı.')); });
  });
  router.post('/admin/auth/login', loginLimiter.aggregate, express.json({ limit: '4kb' }), async (req, res) => {
    const input = loginInput.parse(req.body);
    const finishAttempt = loginLimiter.beginAccount(input.email);
    try {
      const result = await webAdminLogin(database(), input.email, input.password);
      finishAttempt('success');
      res.json(result);
    } catch (error) {
      finishAttempt(error instanceof AppError && error.status === 401 ? 'failure' : 'unavailable');
      throw error;
    }
  });
  router.use('/admin', requireWebAdmin(database));
  router.get('/admin/auth/session', (_req, res) => { res.json({ admin: res.locals.webAdmin }); });
  router.post('/admin/auth/logout', async (req, res) => {
    await database().webAdminSession.deleteMany({ where: { tokenHash: hashSession(sessionToken(req)) } });
    res.status(204).end();
  });
  router.post('/admin/media', express.json({ limit: '7mb' }), async (req, res) => {
    const input = mediaInput.parse(req.body);
    res.status(201).json({ media: await saveWebMedia(database(), input.filename, Buffer.from(input.data, 'base64'), input.mimeType, mediaRoot) });
  });
  router.get('/admin/products', async (_req, res) => {
    const products = await database().webProduct.findMany({ include: productInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    res.json({ products: products.map((item) => serializeProduct(item)) });
  });
  router.get('/admin/products/:id', async (req, res) => {
    const product = await database().webProduct.findUnique({ where: { id: String(req.params.id) }, include: productInclude });
    if (!product) throw AppError.notFound('Ürün bulunamadı.');
    res.json({ product: serializeProduct(product) });
  });
  router.post('/admin/products', express.json({ limit: '250kb' }), async (req, res) => {
    const input = productInput.parse(req.body);
    res.status(201).json({ product: await saveProduct(database(), input, res.locals.webAdmin.id) });
  });
  router.put('/admin/products/:id', express.json({ limit: '250kb' }), async (req, res) => {
    const input = productInput.parse(req.body);
    res.json({ product: await saveProduct(database(), input, res.locals.webAdmin.id, String(req.params.id)) });
  });
  router.get('/admin/products/:id/history', async (req, res) => {
    const productId = String(req.params.id);
    const [audits, adjustments] = await Promise.all([
      database().webCatalogAudit.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, action: true, createdAt: true, admin: { select: { name: true } } } }),
      database().webStockAdjustment.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, sku: true, previous: true, current: true, reason: true, createdAt: true, admin: { select: { name: true } } } }),
    ]);
    res.json({ audits, adjustments });
  });
  return router;
}
