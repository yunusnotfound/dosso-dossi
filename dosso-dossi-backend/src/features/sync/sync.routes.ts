import { Router } from 'express';
import { getSyncRevisions } from './sync.service.js';

export const syncRouter = Router();

syncRouter.get('/revisions', async (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.json(await getSyncRevisions());
  } catch (error) {
    next(error);
  }
});
