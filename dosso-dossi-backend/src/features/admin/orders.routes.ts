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

const optionalText = z.string().trim().max(300).transform((value) => value || undefined).optional();
const queryDate = z.string().max(64)
  .transform((value) => value ? new Date(value) : undefined)
  .refine((value) => value === undefined || !Number.isNaN(value.getTime()), 'Geçerli bir tarih verilmeli')
  .optional();
const queryInteger = (fallback: number, maximum: number) => z.string()
  .regex(/^\d+$/, 'Pozitif bir tam sayı verilmeli')
  .transform(Number).pipe(z.number().int().min(1).max(maximum))
  .optional().default(fallback);
const orderFilterSchema = z.object({
  activeOnly: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  status: z.enum(['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).optional(),
  branchId: optionalText,
  q: optionalText,
  from: queryDate,
  to: queryDate,
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz', path: ['to'],
});
const orderListSchema = orderFilterSchema.safeExtend({
  page: queryInteger(1, 100_000),
  pageSize: queryInteger(25, 100),
});

adminOrdersRouter.get('/', requireAdmin(), async (req, res, next) => {
  try {
    const query = orderListSchema.parse(req.query);
    res.json(
      await listOrders({
        ...query,
        branchId: scopeBranch(req.admin, query.branchId),
      }),
    );
  } catch (err) {
    next(err);
  }
});

/// Markalı Excel raporu: Özet + Siparişler + Kalemler sayfaları.
adminOrdersRouter.get('/export.xlsx', requireAdmin(), async (req, res, next) => {
  try {
    const query = orderFilterSchema.parse(req.query);
    const buffer = await ordersWorkbook({
      ...query,
      branchId: scopeBranch(req.admin, query.branchId),
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
    const query = orderFilterSchema.parse(req.query);
    const csv = await exportCsv({
      ...query,
      branchId: scopeBranch(req.admin, query.branchId),
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
