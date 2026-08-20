import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, scopeBranch } from '../../middleware/admin-auth.js';
import { validate } from '../../middleware/validate.js';
import { listOptions } from '../menu/options.service.js';
import {
  SETTING_DEFAULTS,
  allSettings,
  setSetting,
  type SettingKey,
} from '../settings/settings.service.js';
import {
  createAdmin,
  listAdmins,
  listAudit,
  resetPassword,
  updateAdmin,
} from './admins.service.js';
import { branchDetail, listBranches, setOpen, upsertBranch } from './branches.service.js';
import {
  deleteCampaign,
  deletePromo,
  listCampaigns,
  listPromos,
  upsertCampaign,
  upsertPromo,
} from './campaigns.service.js';
import {
  adjustBalance,
  adjustLoyalty,
  customerDetail,
  listCustomers,
  pendingGifts,
  revokeSessions,
  setBlocked,
} from './customers.service.js';
import {
  charges,
  ledger,
  ledgerCsv,
  payments,
  reconciliation,
  voidChargeFromPanel,
} from './finance.service.js';
import {
  availabilityMatrix,
  bulkPrice,
  deleteCategory,
  listCategories,
  listProducts,
  reorderCategories,
  saveOption,
  setAvailability,
  setProductActive,
  upsertCategory,
  upsertProduct,
} from './menu.service.js';
import { health, listEvents, requeue } from './pos-monitor.service.js';
import { ledgerWorkbook } from './exports.service.js';
import { fileStamp } from './xlsx.js';

export const modulesRouter = Router();

// Yazma yetkisi olan roller — izleyici her yerde salt okuma.
const WRITE = ['SUPER_ADMIN', 'MANAGER'] as const;
const WRITE_WITH_BRANCH = ['SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER'] as const;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;
const date = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const num = (v: unknown, fallback: number): number => Number(v) || fallback;

/// Route gövdelerini tek yerde sarmalar: try/catch tekrarını kaldırır.
function h<T>(fn: (req: Parameters<Router['get']> extends never ? never : any) => Promise<T>) {
  return async (req: any, res: any, next: any) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      next(err);
    }
  };
}

// ── A3 Menü ─────────────────────────────────────────────────────────

const categorySchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
const reorderSchema = z.object({ ids: z.array(z.string()).min(1).max(200) });
const productSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  price: z.number().min(0).max(100000),
  categoryId: z.string().min(1),
  description: z.string().max(500).default(''),
  imageUrl: z.string().max(500).nullable().default(null),
  sizeMl: z.number().int().min(0).max(5000).default(0),
  stampMultiplier: z.number().int().min(0).max(10).default(0),
  isNew: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  hasOptions: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
const bulkPriceSchema = z
  .object({
    categoryId: z.string().optional(),
    percent: z.number().min(-90).max(200).optional(),
    amount: z.number().min(-10000).max(10000).optional(),
    roundTo: z.number().min(0).max(100).default(0),
    reason: z.string().trim().min(5).max(300),
  })
  .refine((v) => v.percent !== undefined || v.amount !== undefined, {
    message: 'percent veya amount verilmeli',
  });
const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  priceOverride: z.number().min(0).max(100000).nullable().default(null),
});
const optionSchema = z.object({
  id: z.string().optional(),
  group: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  priceDelta: z.number().min(-1000).max(1000),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

modulesRouter.get('/menu/categories', requireAdmin(), h(() => listCategories()));
modulesRouter.post(
  '/menu/categories',
  requireAdmin(...WRITE),
  validate(categorySchema),
  h((req) => upsertCategory(req, req.body)),
);
modulesRouter.post(
  '/menu/categories/reorder',
  requireAdmin(...WRITE),
  validate(reorderSchema),
  h(async (req) => {
    await reorderCategories(req, req.body.ids);
    return { ok: true };
  }),
);
modulesRouter.delete(
  '/menu/categories/:id',
  requireAdmin(...WRITE),
  h(async (req) => {
    await deleteCategory(req, String(req.params.id));
    return { ok: true };
  }),
);

modulesRouter.get(
  '/menu/products',
  requireAdmin(),
  h((req) =>
    listProducts({
      categoryId: str(req.query.categoryId),
      q: str(req.query.q),
      isActive:
        req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      page: num(req.query.page, 1),
      pageSize: num(req.query.pageSize, 50),
    }),
  ),
);
modulesRouter.post(
  '/menu/products',
  requireAdmin(...WRITE),
  validate(productSchema),
  h((req) => upsertProduct(req, req.body)),
);
modulesRouter.post(
  '/menu/products/:id/active',
  requireAdmin(...WRITE),
  validate(z.object({ isActive: z.boolean() })),
  h((req) => setProductActive(req, String(req.params.id), req.body.isActive)),
);
modulesRouter.post(
  '/menu/bulk-price',
  requireAdmin(...WRITE),
  validate(bulkPriceSchema),
  h((req) => bulkPrice(req, req.body)),
);

modulesRouter.get('/menu/options', requireAdmin(), h(() => listOptions()));
modulesRouter.post(
  '/menu/options',
  requireAdmin(...WRITE),
  validate(optionSchema),
  h((req) => saveOption(req, req.body)),
);

// ── A4 Şubeler ──────────────────────────────────────────────────────

const branchSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  hours: z.string().trim().min(1).max(60),
  isOpen: z.boolean().default(true),
  prepMinutes: z.number().int().min(0).max(120).default(7),
});

modulesRouter.get(
  '/branches',
  requireAdmin(),
  h((req) => listBranches(scopeBranch(req.admin))),
);
modulesRouter.get(
  '/branches/:id',
  requireAdmin(),
  h((req) => {
    scopeBranch(req.admin, String(req.params.id));
    return branchDetail(String(req.params.id));
  }),
);
modulesRouter.post(
  '/branches',
  requireAdmin(...WRITE),
  validate(branchSchema),
  h((req) => upsertBranch(req, req.body)),
);
modulesRouter.post(
  '/branches/:id/open',
  requireAdmin(...WRITE_WITH_BRANCH),
  validate(z.object({ isOpen: z.boolean() })),
  h((req) => {
    scopeBranch(req.admin, String(req.params.id));
    return setOpen(req, String(req.params.id), req.body.isOpen);
  }),
);
modulesRouter.get(
  '/branches/:id/availability',
  requireAdmin(),
  h((req) => {
    scopeBranch(req.admin, String(req.params.id));
    return availabilityMatrix(String(req.params.id));
  }),
);
modulesRouter.post(
  '/branches/:id/availability/:productId',
  requireAdmin(...WRITE_WITH_BRANCH),
  validate(availabilitySchema),
  h((req) => {
    scopeBranch(req.admin, String(req.params.id));
    return setAvailability(
      req,
      String(req.params.id),
      String(req.params.productId),
      req.body,
    );
  }),
);

// ── A5 Kampanya / promosyon / ayarlar ───────────────────────────────

const campaignSchema = z.object({
  id: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120),
  badge: z.string().trim().max(20).default(''),
  description: z.string().trim().max(400).default(''),
  style: z.enum(['orange', 'dark']),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});
const promoSchema = z.object({
  code: z.string().trim().min(2).max(40),
  discountRate: z.number().gt(0).lt(1),
  isActive: z.boolean().default(true),
  expiresAt: z.string().nullable().default(null),
});
const settingSchema = z.object({
  key: z.enum(Object.keys(SETTING_DEFAULTS) as [SettingKey, ...SettingKey[]]),
  value: z.union([z.number(), z.boolean(), z.string()]),
});

modulesRouter.get('/campaigns', requireAdmin(), h(() => listCampaigns()));
modulesRouter.post(
  '/campaigns',
  requireAdmin(...WRITE),
  validate(campaignSchema),
  h((req) => upsertCampaign(req, req.body)),
);
modulesRouter.delete(
  '/campaigns/:id',
  requireAdmin(...WRITE),
  h(async (req) => {
    await deleteCampaign(req, String(req.params.id));
    return { ok: true };
  }),
);

modulesRouter.get('/promos', requireAdmin(), h(() => listPromos()));
modulesRouter.post(
  '/promos',
  requireAdmin(...WRITE),
  validate(promoSchema),
  h((req) => upsertPromo(req, req.body)),
);
modulesRouter.delete(
  '/promos/:code',
  requireAdmin(...WRITE),
  h(async (req) => {
    await deletePromo(req, String(req.params.code).toUpperCase());
    return { ok: true };
  }),
);

modulesRouter.get('/settings', requireAdmin(), h(() => allSettings()));
modulesRouter.post(
  '/settings',
  // Sadakat/para kuralı: yalnız süper yönetici
  requireAdmin('SUPER_ADMIN'),
  validate(settingSchema),
  h(async (req) => {
    await setSetting(req, req.body.key, req.body.value);
    return allSettings();
  }),
);

// ── A6 Müşteriler ───────────────────────────────────────────────────

const reasonSchema = z.object({ reason: z.string().trim().min(5).max(300) });
const balanceSchema = reasonSchema.extend({
  amount: z.number().refine((v) => v !== 0, 'Tutar sıfır olamaz'),
});
const loyaltySchema = reasonSchema.extend({
  stamps: z.number().int().min(0).max(100).optional(),
  freeDrinks: z.number().int().min(0).max(100).optional(),
});

modulesRouter.get(
  '/customers',
  requireAdmin(),
  h((req) =>
    listCustomers({
      q: str(req.query.q),
      page: num(req.query.page, 1),
      pageSize: num(req.query.pageSize, 25),
      sort: req.query.sort === 'ltv' ? 'ltv' : 'recent',
    }),
  ),
);
modulesRouter.get('/customers/gifts/pending', requireAdmin(), h(() => pendingGifts()));
modulesRouter.get(
  '/customers/:id',
  requireAdmin(),
  h((req) => customerDetail(String(req.params.id))),
);
modulesRouter.post(
  '/customers/:id/balance',
  requireAdmin(...WRITE),
  validate(balanceSchema),
  h((req) => adjustBalance(req, String(req.params.id), req.body.amount, req.body.reason)),
);
modulesRouter.post(
  '/customers/:id/loyalty',
  requireAdmin(...WRITE),
  validate(loyaltySchema),
  h((req) =>
    adjustLoyalty(
      req,
      String(req.params.id),
      { stamps: req.body.stamps, freeDrinks: req.body.freeDrinks },
      req.body.reason,
    ),
  ),
);
modulesRouter.post(
  '/customers/:id/revoke-sessions',
  requireAdmin(...WRITE),
  validate(reasonSchema),
  h((req) => revokeSessions(req, String(req.params.id), req.body.reason)),
);
modulesRouter.post(
  '/customers/:id/block',
  requireAdmin(...WRITE),
  validate(reasonSchema.extend({ isBlocked: z.boolean() })),
  h((req) =>
    setBlocked(req, String(req.params.id), req.body.isBlocked, req.body.reason),
  ),
);

// ── A7 Finans ───────────────────────────────────────────────────────

const TX_TYPES = [
  'TOPUP',
  'ORDER_PAYMENT',
  'GIFT_SENT',
  'GIFT_RECEIVED',
  'QR_PAYMENT',
  'REFUND',
] as const;
const txType = (v: unknown) =>
  typeof v === 'string' && (TX_TYPES as readonly string[]).includes(v)
    ? (v as (typeof TX_TYPES)[number])
    : undefined;

modulesRouter.get(
  '/finance/ledger',
  requireAdmin(),
  h((req) =>
    ledger({
      type: txType(req.query.type),
      from: date(req.query.from),
      to: date(req.query.to),
      page: num(req.query.page, 1),
      pageSize: num(req.query.pageSize, 50),
    }),
  ),
);
modulesRouter.get('/finance/ledger.csv', requireAdmin(), async (req, res, next) => {
  try {
    const csv = await ledgerCsv({
      type: txType(req.query.type),
      from: date(req.query.from),
      to: date(req.query.to),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileStamp('dosso-dossi-cuzdan-defteri', 'csv')}"`,
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/// Markalı Excel defteri: Özet + Tüm hareketler + işlem tipi başına sayfa.
modulesRouter.get('/finance/ledger.xlsx', requireAdmin(), async (req, res, next) => {
  try {
    const buffer = await ledgerWorkbook({
      type: txType(req.query.type),
      from: date(req.query.from),
      to: date(req.query.to),
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileStamp('dosso-dossi-cuzdan-defteri', 'xlsx')}"`,
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
modulesRouter.get(
  '/finance/payments',
  requireAdmin(),
  h((req) =>
    payments({
      status: str(req.query.status) as never,
      from: date(req.query.from),
      to: date(req.query.to),
    }),
  ),
);
modulesRouter.get(
  '/finance/charges',
  requireAdmin(),
  h((req) => charges({ from: date(req.query.from), to: date(req.query.to) })),
);
modulesRouter.post(
  '/finance/charges/:id/void',
  requireAdmin(...WRITE),
  validate(reasonSchema),
  h((req) => voidChargeFromPanel(req, String(req.params.id), req.body.reason)),
);
modulesRouter.get(
  '/finance/reconciliation',
  requireAdmin(),
  h((req) => reconciliation(num(req.query.days, 7))),
);

// ── A8 POS izleme ───────────────────────────────────────────────────

modulesRouter.get(
  '/pos/events',
  requireAdmin(),
  h((req) =>
    listEvents({
      source: str(req.query.source),
      eventType: str(req.query.eventType),
      status: str(req.query.status) as never,
      page: num(req.query.page, 1),
      pageSize: num(req.query.pageSize, 50),
    }),
  ),
);
modulesRouter.get('/pos/health', requireAdmin(), h(() => health()));
modulesRouter.post(
  '/pos/events/:id/requeue',
  requireAdmin(...WRITE),
  validate(reasonSchema),
  h((req) => requeue(req, String(req.params.id), req.body.reason)),
);

// ── A9 Yönetim ──────────────────────────────────────────────────────

const adminCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(120).default(''),
  role: z.enum(['SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER', 'VIEWER']),
  branchId: z.string().nullable().default(null),
});
const adminUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: z.enum(['SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER', 'VIEWER']).optional(),
  branchId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

modulesRouter.get('/admins', requireAdmin('SUPER_ADMIN'), h(() => listAdmins()));
modulesRouter.post(
  '/admins',
  requireAdmin('SUPER_ADMIN'),
  validate(adminCreateSchema),
  h((req) => createAdmin(req, req.body)),
);
modulesRouter.patch(
  '/admins/:id',
  requireAdmin('SUPER_ADMIN'),
  validate(adminUpdateSchema),
  h((req) => updateAdmin(req, String(req.params.id), req.body)),
);
modulesRouter.post(
  '/admins/:id/reset-password',
  requireAdmin('SUPER_ADMIN'),
  h((req) => resetPassword(req, String(req.params.id))),
);

modulesRouter.get(
  '/audit',
  requireAdmin('SUPER_ADMIN', 'MANAGER'),
  h((req) =>
    listAudit({
      adminId: str(req.query.adminId),
      entity: str(req.query.entity),
      entityId: str(req.query.entityId),
      action: str(req.query.action),
      page: num(req.query.page, 1),
      pageSize: num(req.query.pageSize, 50),
    }),
  ),
);
