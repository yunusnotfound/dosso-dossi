import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { notificationPrefsSchema, updateMeSchema } from './me.schemas.js';
import { accountRequestsRouter, dataExportRouter } from '../account-requests/account-requests.routes.js';
import { notificationsRouter } from '../notifications/notifications.routes.js';

export const meRouter = Router();

meRouter.use('/account-requests', accountRequestsRouter);
meRouter.use('/data-export', dataExportRouter);
meRouter.use('/notifications', notificationsRouter);

meRouter.patch('/', validate(updateMeSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: req.body,
    });
    res.json({ phone: user.phone, name: user.name, email: user.email });
  } catch (err) {
    next(err);
  }
});

meRouter.get('/notification-prefs', async (req, res, next) => {
  try {
    const prefs = await prisma.notificationPrefs.findUniqueOrThrow({
      where: { userId: req.userId },
    });
    res.json({
      campaigns: prefs.campaigns,
      orderStatus: prefs.orderStatus,
      sms: prefs.sms,
    });
  } catch (err) {
    next(err);
  }
});

meRouter.put(
  '/notification-prefs',
  validate(notificationPrefsSchema),
  async (req, res, next) => {
    try {
      const prefs = await prisma.notificationPrefs.update({
        where: { userId: req.userId },
        data: req.body,
      });
      res.json({
        campaigns: prefs.campaigns,
        orderStatus: prefs.orderStatus,
        sms: prefs.sms,
      });
    } catch (err) {
      next(err);
    }
  },
);
