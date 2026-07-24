import { Router } from 'express';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { placeOrderSchema } from './orders.schemas.js';
import { getOrder, listOrders, placeOrder } from './orders.service.js';

const orderLimiter = makeRateLimiter({ windowMs: 60_000, max: 10 });

export const ordersRouter = Router();

ordersRouter.post('/', orderLimiter, validate(placeOrderSchema), async (req, res, next) => {
  try {
    res.status(201).json(await placeOrder(req.userId, req.body));
  } catch (err) {
    next(err);
  }
});

ordersRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listOrders(req.userId));
  } catch (err) {
    next(err);
  }
});

// Canlı sipariş takibi: uygulama hazır olana kadar bu ucu yoklar
ordersRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await getOrder(req.userId, req.params.id as string));
  } catch (err) {
    next(err);
  }
});
