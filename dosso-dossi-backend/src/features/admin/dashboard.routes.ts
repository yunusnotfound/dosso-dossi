import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, scopeBranch } from '../../middleware/admin-auth.js';
import {
  alerts,
  branchStats,
  hourly,
  summary,
  timeseries,
} from './dashboard.service.js';

export const dashboardRouter = Router();

// Dashboard salt okuma: VIEWER dahil her rol görebilir.
dashboardRouter.use(requireAdmin());

const dashboardQuery = z.object({
  branchId: z.string().trim().max(300).transform((value) => value || undefined).optional(),
  days: z.string().regex(/^\d+$/, 'Gün sayısı tam sayı olmalı').transform(Number)
    .pipe(z.number().int().min(7).max(90)).optional().default(30),
});

/// Tek çağrıda tüm dashboard: panel açılışta 5 istek atmasın.
dashboardRouter.get('/', async (req, res, next) => {
  try {
    const query = dashboardQuery.parse(req.query);
    const branch = scopeBranch(req.admin, query.branchId);
    const days = query.days;
    const [kpi, series, branches, load, warn] = await Promise.all([
      summary(branch),
      timeseries(days, branch),
      branchStats(branch),
      hourly(branch),
      alerts(branch),
    ]);
    res.json({ summary: kpi, timeseries: series, branches, hourly: load, alerts: warn });
  } catch (err) {
    next(err);
  }
});
