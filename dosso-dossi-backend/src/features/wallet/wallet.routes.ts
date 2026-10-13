import { Router } from 'express';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { topUpSchema } from './wallet.schemas.js';
import { createQrToken, getWallet } from './wallet.service.js';
import { getPaymentConfiguration, getPendingTopUp, getTopUpResult, startTopUp } from './payments/topup.service.js';

const topUpLimiter = makeRateLimiter({ windowMs: 60_000, max: 10 });
const qrLimiter = makeRateLimiter({ windowMs: 60_000, max: 30 });
const statusLimiter = makeRateLimiter({ windowMs: 60_000, max: 30 });

export const walletRouter = Router();
walletRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

walletRouter.get('/payment-config', (_req, res) => res.json(getPaymentConfiguration()));

walletRouter.get('/payments/pending', statusLimiter, async (req, res, next) => {
  try { res.json(await getPendingTopUp(req.userId)); } catch (error) { next(error); }
});

walletRouter.get('/', async (req, res, next) => {
  try {
    res.json(await getWallet(req.userId));
  } catch (err) {
    next(err);
  }
});

walletRouter.post('/topup', topUpLimiter, validate(topUpSchema), async (req, res, next) => {
  try {
    res.json(await startTopUp(req.userId, req.body.amount, req.body.idempotencyKey, req.body.savedCardId, {
      buyer: req.body.buyer,
      buyerIp: req.ip ?? req.socket.remoteAddress,
      session: { tokenVersion: req.userTokenVersion, familyId: req.userSessionFamily },
    }));
  } catch (err) {
    next(err);
  }
});

walletRouter.get('/payments/:paymentId', statusLimiter, async (req, res, next) => {
  try {
    res.json(await getTopUpResult(req.userId, String(req.params.paymentId)));
  } catch (err) {
    next(err);
  }
});

walletRouter.post('/qr-token', qrLimiter, async (req, res, next) => {
  try {
    res.json(await createQrToken(req.userId, { tokenVersion: req.userTokenVersion, familyId: req.userSessionFamily }));
  } catch (err) {
    next(err);
  }
});
