import { Router } from 'express';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { sendGiftSchema } from './gifts.schemas.js';
import { listGifts, sendGift } from './gifts.service.js';

const giftLimiter = makeRateLimiter({ windowMs: 60_000, max: 10 });

export const giftsRouter = Router();

giftsRouter.post('/', giftLimiter, validate(sendGiftSchema), async (req, res, next) => {
  try {
    res.status(201).json(await sendGift(req.userId, req.body));
  } catch (err) {
    next(err);
  }
});

giftsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listGifts(req.userId));
  } catch (err) {
    next(err);
  }
});
