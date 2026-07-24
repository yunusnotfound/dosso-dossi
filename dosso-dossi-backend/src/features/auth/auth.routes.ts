import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { otpSendSchema, otpVerifySchema } from './auth.schemas.js';
import { requestOtp, verifyOtp } from './auth.service.js';
import { revokeRefreshToken, rotateRefreshToken } from './refresh.service.js';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const logoutSchema = z.object({ refreshToken: z.string().optional() });

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

authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    res.json(await rotateRefreshToken(req.body.refreshToken));
  } catch (err) {
    next(err);
  }
});

// Çıkış her zaman başarılıdır; token yoksa/bilinmiyorsa sessizce geçer
authRouter.post('/logout', validate(logoutSchema), async (req, res, next) => {
  try {
    if (req.body.refreshToken) {
      await revokeRefreshToken(req.body.refreshToken);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
