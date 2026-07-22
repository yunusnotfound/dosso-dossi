import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { otpSendSchema, otpVerifySchema } from './auth.schemas.js';
import { requestOtp, verifyOtp } from './auth.service.js';

export const authRouter = Router();

authRouter.post('/otp/send', validate(otpSendSchema), async (req, res, next) => {
  try {
    await requestOtp(req.body.phone);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/otp/verify', validate(otpVerifySchema), async (req, res, next) => {
  try {
    res.json(await verifyOtp(req.body.phone, req.body.code));
  } catch (err) {
    next(err);
  }
});
