import { Router } from 'express';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { createCatalogRouter } from './catalog.routes.js';
import { createCustomerAuthRouter } from './customer-auth.routes.js';
import { createCommerceRouter } from './commerce.routes.js';
import { createWebOrdersRouter } from './orders.routes.js';

type WebDatabase = Pick<PrismaClient, 'webStoreSettings'>;

/** All reads stay inside the web client; no user input chooses a database. */
export function createWebRouter(database: () => WebDatabase): Router {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  router.get('/health', async (_req, res) => {
    try {
      // Readiness includes migrations and the initial store record, not only TCP access.
      const store = await database().webStoreSettings.findUnique({ where: { id: 'store' }, select: { id: true } });
      res.status(store ? 200 : 503).json({ ok: Boolean(store), service: 'web' });
    } catch {
      res.status(503).json({ ok: false, service: 'web' });
    }
  });

  router.get('/config', async (_req, res) => {
    try {
      const store = await database().webStoreSettings.findUnique({
        where: { id: 'store' },
        select: { name: true, defaultLocale: true, locales: true, currency: true, shippingCountry: true },
      });
      if (store) { res.json({ store }); return; }
    } catch { /* Do not send Prisma errors or connection details to public callers. */ }
    res.status(503).json({ error: { code: 'WEB_UNAVAILABLE', message: 'Web mağazası şu anda hazır değil.' } });
  });
  router.use(createCustomerAuthRouter(database as () => PrismaClient));
  router.use(createCommerceRouter(database as () => PrismaClient));
  router.use(createWebOrdersRouter(database as () => PrismaClient));
  router.use(createCatalogRouter(database as () => PrismaClient));
  return router;
}
