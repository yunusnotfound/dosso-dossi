import { Router } from 'express';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { sendGiftSchema } from './gifts.schemas.js';
import { claimPendingGifts, listGifts, listGiftPage, sendGift } from './gifts.service.js';
import { parseHistoryPage } from '../../lib/history-page.js';

const giftLimiter = makeRateLimiter({ windowMs: 60_000, max: 10 });

export const giftsRouter = Router();

giftsRouter.post('/claim', async (req, res, next) => {
  try {
    res.json(await claimPendingGifts(req.userId));
  } catch (err) {
    next(err);
  }
});

giftsRouter.post('/', giftLimiter, validate(sendGiftSchema), async (req, res, next) => {
  try {
    res.status(201).json(await sendGift(req.userId, req.body));
  } catch (err) {
    next(err);
  }
});

giftsRouter.get('/', async (req, res, next) => {
  try {
    const page = parseHistoryPage(req.query);
    res.json(req.query.paginated === 'true' || req.query.cursor !== undefined
      ? await listGiftPage(req.userId, page)
      : await listGifts(req.userId));
  } catch (err) {
    next(err);
  }
});
