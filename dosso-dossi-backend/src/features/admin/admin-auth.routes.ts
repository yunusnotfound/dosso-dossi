import { Router } from 'express';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { requireAdmin } from '../../middleware/admin-auth.js';
import { validate } from '../../middleware/validate.js';
import {
  adminLoginSchema,
  changePasswordSchema,
  refreshSchema,
} from './admin-auth.schemas.js';
import { changePassword, login, logout, rotate } from './admin-auth.service.js';

export const adminAuthRouter = Router();

/// Panel girişi kaba kuvvete açık tek uç: IP başına dar pencere.
const loginLimiter = makeRateLimiter({
  windowMs: 5 * 60_000,
  max: 10,
  keyFn: (req) => `admin-login:${req.ip ?? 'anon'}`,
});

adminAuthRouter.post(
  '/login',
  loginLimiter,
  validate(adminLoginSchema),
  async (req, res, next) => {
    try {
      res.json(
        await login(req.body.email, req.body.password, req.body.deviceInfo ?? ''),
      );
    } catch (err) {
      next(err);
    }
  },
);

adminAuthRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    res.json(await rotate(req.body.refreshToken));
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.post('/logout', validate(refreshSchema), async (req, res, next) => {
  try {
    await logout(req.body.refreshToken);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/// Oturumdaki yöneticinin kendisi — panel açılışta bunu çağırır.
adminAuthRouter.get('/me', requireAdmin(), (req, res) => {
  res.json(req.admin);
});

adminAuthRouter.post(
  '/password',
  requireAdmin(),
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      await changePassword(
        req.admin.id,
        req.body.currentPassword,
        req.body.newPassword,
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
