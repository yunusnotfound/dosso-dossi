import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import {
  confirmTopUpTx,
  markPaymentFailed,
} from '../wallet/payments/topup.service.js';
import { runPosEvent } from './pos-events.service.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';

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
      const intent = await prisma.paymentIntent.findUnique({ where: { id: req.body.paymentId }, select: { provider: true } });
      if (env.NODE_ENV === 'production' || env.PAYMENT_PROVIDER !== 'dev' || intent?.provider !== 'dev') throw AppError.forbidden();
      const result = await runPosEvent(
        {
          source: 'payment',
          eventType: 'payment_confirmation',
          externalId: req.body.paymentId,
          payload: req.body,
        },
        async (tx) =>
          req.body.status === 'succeeded'
            ? { ok: true, ...(await confirmTopUpTx(tx, req.body.paymentId)) }
            : markPaymentFailed(tx, req.body.paymentId),
      );
      res.json(result.response);
    } catch (err) {
      next(err);
    }
  },
);
