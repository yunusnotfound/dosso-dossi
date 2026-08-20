import { Router } from 'express';
import { z } from 'zod';
import { parseOrderNumber } from '../orders/order-status.service.js';
import { requireAdmin, scopeBranch } from '../../middleware/admin-auth.js';
import { validate } from '../../middleware/validate.js';
import { ordersWorkbook } from './exports.service.js';
import { fileStamp } from './xlsx.js';
import {
  cancelOrder,
  exportCsv,
  getOrderDetail,
  listOrders,
  retryForward,
  setStatus,
} from './orders.service.js';

export const adminOrdersRouter = Router();

const statusSchema = z.object({
  status: z.enum(['RECEIVED', 'PREPARING', 'READY', 'COMPLETED']),
});

/// İptal para hareketi doğurur: gerekçe zorunlu ve anlamlı uzunlukta.
const cancelSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});

adminOrdersRouter.get('/', requireAdmin(), async (req, res, next) => {
  try {
    res.json(
      await listOrders({
        status: asStatus(req.query.status),
        branchId: scopeBranch(req.admin, asString(req.query.branchId)),
        q: asString(req.query.q),
        from: asDate(req.query.from),
        to: asDate(req.query.to),
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 25,
      }),
    );
  } catch (err) {
    next(err);
  }
});

/// Markalı Excel raporu: Özet + Siparişler + Kalemler sayfaları.
adminOrdersRouter.get('/export.xlsx', requireAdmin(), async (req, res, next) => {
  try {
    const buffer = await ordersWorkbook({
      status: asStatus(req.query.status),
      branchId: scopeBranch(req.admin, asString(req.query.branchId)),
      q: asString(req.query.q),
      from: asDate(req.query.from),
      to: asDate(req.query.to),
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileStamp('dosso-dossi-siparisler', 'xlsx')}"`,
    );
    // Tarayıcı dosya adını okuyabilsin (CORS altında başlık gizli kalır)
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

adminOrdersRouter.get('/export.csv', requireAdmin(), async (req, res, next) => {
  try {
    const csv = await exportCsv({
      status: asStatus(req.query.status),
      branchId: scopeBranch(req.admin, asString(req.query.branchId)),
      q: asString(req.query.q),
      from: asDate(req.query.from),
      to: asDate(req.query.to),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileStamp('dosso-dossi-siparisler', 'csv')}"`,
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

adminOrdersRouter.get('/:id', requireAdmin(), async (req, res, next) => {
  try {
    res.json(
      await getOrderDetail(
        parseOrderNumber(String(req.params.id)),
        scopeBranch(req.admin),
      ),
    );
  } catch (err) {
    next(err);
  }
});

// Durum ilerletme ve iptal: izleyici yapamaz.
adminOrdersRouter.post(
  '/:id/status',
  requireAdmin('SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER'),
  validate(statusSchema),
  async (req, res, next) => {
    try {
      res.json(
        await setStatus(
          req,
          parseOrderNumber(String(req.params.id)),
          req.body.status,
          scopeBranch(req.admin),
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

adminOrdersRouter.post(
  '/:id/cancel',
  requireAdmin('SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER'),
  validate(cancelSchema),
  async (req, res, next) => {
    try {
      res.json(
        await cancelOrder(
          req,
          parseOrderNumber(String(req.params.id)),
          req.body.reason,
          scopeBranch(req.admin),
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

adminOrdersRouter.post(
  '/:id/retry-forward',
  requireAdmin('SUPER_ADMIN', 'MANAGER'),
  async (req, res, next) => {
    try {
      await retryForward(req, parseOrderNumber(String(req.params.id)));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function asDate(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
function asStatus(v: unknown) {
  const allowed = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const;
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as (typeof allowed)[number])
    : undefined;
}
