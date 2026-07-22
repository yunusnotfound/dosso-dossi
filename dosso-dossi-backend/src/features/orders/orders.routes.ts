import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { placeOrderSchema } from './orders.schemas.js';
import { listOrders, placeOrder } from './orders.service.js';

export const ordersRouter = Router();

ordersRouter.post('/', validate(placeOrderSchema), async (req, res, next) => {
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
