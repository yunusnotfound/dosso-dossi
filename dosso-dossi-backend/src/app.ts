import express from 'express';
import { AppError, ErrorCodes } from './lib/errors.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './features/auth/auth.routes.js';
import { branchesRouter } from './features/branches/branches.routes.js';
import { campaignsRouter } from './features/campaigns/campaigns.routes.js';
import { giftsRouter } from './features/gifts/gifts.routes.js';
import { loyaltyRouter } from './features/loyalty/loyalty.routes.js';
import { meRouter } from './features/me/me.routes.js';
import { menuRouter } from './features/menu/menu.routes.js';
import { ordersRouter } from './features/orders/orders.routes.js';
import { walletRouter } from './features/wallet/wallet.routes.js';
import { kerzzWebhooksRouter } from './features/webhooks/kerzz.routes.js';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Herkese açık
  app.use('/auth', authRouter);
  app.use('/menu', menuRouter);
  app.use('/branches', branchesRouter);
  app.use('/campaigns', campaignsRouter); // validate-code kendi içinde auth'lu
  app.use('/webhooks/kerzz', kerzzWebhooksRouter);

  // Oturum gerektirir
  app.use('/me/wallet', requireAuth, walletRouter);
  app.use('/me/loyalty', requireAuth, loyaltyRouter);
  app.use('/me', requireAuth, meRouter);
  app.use('/orders', requireAuth, ordersRouter);
  app.use('/gifts', requireAuth, giftsRouter);

  app.use((_req, _res, next) => {
    next(new AppError(ErrorCodes.NOT_FOUND, 404, 'Endpoint bulunamadı'));
  });
  app.use(errorHandler);
  return app;
}
