import express from 'express';
import helmet from 'helmet';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { env } from './config/env.js';
import { getWebPrisma } from './lib/web-prisma.js';
import { createWebRouter } from './features/web/web.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';

/** Full web API, without mounting mobile/POS endpoints or starting background jobs. */
export function createWebApp(database: () => PrismaClient = getWebPrisma): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY.length) app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(requestLogger);
  app.use('/web', createWebRouter(database));
  app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint bulunamadı' } }); });
  app.use(errorHandler);
  return app;
}
