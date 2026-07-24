import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import {
  confirmTopUp,
  markPaymentFailed,
} from '../wallet/payments/topup.service.js';
import { runPosEvent } from './pos-events.service.js';

const confirmationSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(['succeeded', 'failed']),
});

/// Ödeme sağlayıcısının sonuç bildirimi (sunucu↔sunucu).
/// app.ts'te posAuth('PAYMENT_WEBHOOK_SECRET') ile korunur.
export const paymentWebhooksRouter = Router();

paymentWebhooksRouter.post(
  '/confirmation',
  validate(confirmationSchema),
  async (req, res, next) => {
    try {
      const result = await runPosEvent(
        {
          source: 'payment',
          eventType: 'payment_confirmation',
          externalId: req.body.paymentId,
          payload: req.body,
        },
        async () =>
          req.body.status === 'succeeded'
            ? { ok: true, ...(await confirmTopUp(req.body.paymentId)) }
            : markPaymentFailed(req.body.paymentId),
      );
      res.json(result.response);
    } catch (err) {
      next(err);
    }
  },
);
