import { Router } from 'express';
import { z } from 'zod';
import { listNotifications, markNotificationRead } from './notifications.service.js';

export const notificationsRouter = Router();
const querySchema = z.object({ page: z.coerce.number().int().min(1).max(1_000_000).default(1) });

notificationsRouter.get('/', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await listNotifications(req.userId, querySchema.parse(req.query).page));
  } catch (err) { next(err); }
});

notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try { res.json(await markNotificationRead(req.userId, String(req.params.id))); }
  catch (err) { next(err); }
});
