import { Router } from 'express';
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

/// Tek çağrıda tüm dashboard: panel açılışta 5 istek atmasın.
dashboardRouter.get('/', async (req, res, next) => {
  try {
    const branch = scopeBranch(req.admin, asString(req.query.branchId));
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
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

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
