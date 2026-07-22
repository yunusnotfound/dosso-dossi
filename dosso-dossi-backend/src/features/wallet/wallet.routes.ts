import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { topUpSchema } from './wallet.schemas.js';
import { createQrToken, getWallet, topUp } from './wallet.service.js';

export const walletRouter = Router();

walletRouter.get('/', async (req, res, next) => {
  try {
    res.json(await getWallet(req.userId));
  } catch (err) {
    next(err);
  }
});

walletRouter.post('/topup', validate(topUpSchema), async (req, res, next) => {
  try {
    res.json(await topUp(req.userId, req.body.amount));
  } catch (err) {
    next(err);
  }
});

walletRouter.post('/qr-token', async (req, res, next) => {
  try {
    res.json(await createQrToken(req.userId));
  } catch (err) {
    next(err);
  }
});
