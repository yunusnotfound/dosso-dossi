import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { sendGiftSchema } from './gifts.schemas.js';
import { listGifts, sendGift } from './gifts.service.js';

export const giftsRouter = Router();

giftsRouter.post('/', validate(sendGiftSchema), async (req, res, next) => {
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
