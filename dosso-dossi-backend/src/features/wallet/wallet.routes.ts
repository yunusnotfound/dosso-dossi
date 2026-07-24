import { Router } from 'express';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { topUpSchema } from './wallet.schemas.js';
import { createQrToken, getWallet } from './wallet.service.js';
import { startTopUp } from './payments/topup.service.js';

const topUpLimiter = makeRateLimiter({ windowMs: 60_000, max: 10 });
const qrLimiter = makeRateLimiter({ windowMs: 60_000, max: 30 });

export const walletRouter = Router();

walletRouter.get('/', async (req, res, next) => {
  try {
    res.json(await getWallet(req.userId));
  } catch (err) {
    next(err);
  }
});

walletRouter.post('/topup', topUpLimiter, validate(topUpSchema), async (req, res, next) => {
  try {
    res.json(await startTopUp(req.userId, req.body.amount));
  } catch (err) {
    next(err);
  }
});

walletRouter.post('/qr-token', qrLimiter, async (req, res, next) => {
  try {
    res.json(await createQrToken(req.userId));
  } catch (err) {
    next(err);
  }
});
