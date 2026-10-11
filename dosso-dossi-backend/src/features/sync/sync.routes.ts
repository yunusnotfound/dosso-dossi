import { Router } from 'express';
import { getSyncRevisions } from './sync.service.js';
import { requireAuth } from '../../middleware/auth.js';

export const syncRouter = Router();

syncRouter.get('/revisions', (req, res, next) => {
  // Guests get public domains only. Never accept a user id from the query.
  if (req.headers.authorization) return requireAuth(req, res, next);
  next();
}, async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.json(await getSyncRevisions(req.userId));
  } catch (error) {
    next(error);
  }
});
