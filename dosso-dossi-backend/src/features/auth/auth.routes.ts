import { Router } from 'express';
import { z } from 'zod';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { otpSendSchema, otpVerifySchema } from './auth.schemas.js';
import { requestOtp, verifyOtp } from './auth.service.js';
import { revokeRefreshToken, rotateRefreshToken } from './refresh.service.js';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const logoutSchema = z.object({ refreshToken: z.string().optional() });

// Oturumsuz uçlar IP+telefon anahtarıyla sınırlanır (kaba kuvvet önlemi)
const verifyLimiter = makeRateLimiter({
  windowMs: 60_000,
  max: 10,
  keyFn: (req) => `${req.ip}:${(req.body as { phone?: string })?.phone ?? ''}`,
});
const refreshLimiter = makeRateLimiter({
  windowMs: 60_000,
  max: 20,
  keyFn: (req) => req.ip ?? 'anon',
});

export const authRouter = Router();

authRouter.post('/otp/send', validate(otpSendSchema), async (req, res, next) => {
  try {
    await requestOtp(req.body.phone);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/otp/verify', verifyLimiter, validate(otpVerifySchema), async (req, res, next) => {
  try {
    res.json(await verifyOtp(req.body.phone, req.body.code));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', refreshLimiter, validate(refreshSchema), async (req, res, next) => {
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
