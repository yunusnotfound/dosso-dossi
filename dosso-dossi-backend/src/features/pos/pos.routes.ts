import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { runPosEvent } from '../webhooks/pos-events.service.js';
import { chargeSchema, voidSchema } from './pos.schemas.js';
import { chargeQrCode, voidCharge } from './pos.service.js';

/// POS köprüsünün senkron komutları (webhook değil): kasa cevabı bekler.
/// app.ts'te posAuth('POS_WEBHOOK_SECRET') ile korunur.
export const posRouter = Router();

posRouter.post('/charge', validate(chargeSchema), async (req, res, next) => {
  try {
    const result = await runPosEvent(
      {
        source: 'kerzz',
        eventType: 'charge',
        externalId: req.body.requestId,
        payload: req.body,
      },
      () => chargeQrCode(req.body),
    );
    res.json(result.response);
  } catch (err) {
    next(err);
  }
});

posRouter.post(
  '/charge/:chargeId/void',
  validate(voidSchema),
  async (req, res, next) => {
    try {
      const result = await runPosEvent(
        {
          source: 'kerzz',
          eventType: 'charge_void',
          externalId: req.body.requestId,
          payload: { ...req.body, chargeId: req.params.chargeId },
        },
        () => voidCharge(req.params.chargeId as string),
      );
      res.json(result.response);
    } catch (err) {
      next(err);
    }
  },
);
