import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { requireAdmin } from '../../middleware/admin-auth.js';
import { createRequestSchema, exportQuery, requestListQuery, updateRequestSchema } from './account-requests.schemas.js';
import { adminAccountRequests, cancelAccountRequest, createAccountRequest, listAccountRequests, updateAccountRequest } from './account-requests.service.js';
import { exportUserData } from './data-export.service.js';

export const accountRequestsRouter = Router();
export const dataExportRouter = Router();
export const adminAccountRequestsRouter = Router();
const requestLimiter = makeRateLimiter({ windowMs: 60_000, max: 15 });

accountRequestsRouter.get('/', async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await listAccountRequests(req.userId)); }
  catch (err) { next(err); }
});
accountRequestsRouter.post('/', requestLimiter, validate(createRequestSchema), async (req, res, next) => {
  try { res.status(201).json(await createAccountRequest(req.userId, req.body)); }
  catch (err) { next(err); }
});
accountRequestsRouter.post('/:id/cancel', requestLimiter, async (req, res, next) => {
  try { res.json(await cancelAccountRequest(req.userId, String(req.params.id))); }
  catch (err) { next(err); }
});

dataExportRouter.get('/', async (req, res, next) => {
  try {
    const query = exportQuery.parse(req.query);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await exportUserData(req.userId, query.section, query.page));
  } catch (err) { next(err); }
});

adminAccountRequestsRouter.get('/', requireAdmin('SUPER_ADMIN', 'MANAGER', 'VIEWER'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await adminAccountRequests(requestListQuery.parse(req.query))); }
  catch (err) { next(err); }
});
adminAccountRequestsRouter.patch('/:id', requireAdmin('SUPER_ADMIN', 'MANAGER'), validate(updateRequestSchema), async (req, res, next) => {
  try { res.json(await updateAccountRequest(req, String(req.params.id), req.body)); }
  catch (err) { next(err); }
});
