import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { advanceOrderStatus, parseOrderNumber } from '../orders/order-status.service.js';
import { processSale } from './kerzz-sale.service.js';
import { runPosEvent } from './pos-events.service.js';
import { orderStatusSchema, saleSchema } from './webhooks.schemas.js';

/// Kerzz POS köprüsünden gelen olaylar (sunucu↔sunucu).
/// app.ts'te posAuth('POS_WEBHOOK_SECRET') ile korunur; gerçek Kerzz
/// formatı netleşince yalnızca adaptör katmanı bu şemalara çevirir.
export const kerzzWebhooksRouter = Router();

kerzzWebhooksRouter.post('/sale', validate(saleSchema), async (req, res, next) => {
  try {
    const result = await runPosEvent(
      {
        source: 'kerzz',
        eventType: 'sale',
        externalId: req.body.saleId,
        payload: req.body,
      },
      () => processSale(req.body),
    );
    res.json(result.response);
  } catch (err) {
    next(err);
  }
});

kerzzWebhooksRouter.post(
  '/order-status',
  validate(orderStatusSchema),
  async (req, res, next) => {
    try {
      const result = await runPosEvent(
        {
          source: 'kerzz',
          eventType: 'order_status',
          externalId: req.body.eventId,
          payload: req.body,
        },
        () =>
          advanceOrderStatus(
            parseOrderNumber(req.body.orderId),
            req.body.status.toUpperCase(),
          ),
      );
      res.json(result.response);
    } catch (err) {
      next(err);
    }
  },
);
