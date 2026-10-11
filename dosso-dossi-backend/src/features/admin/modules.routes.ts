import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { moneyInput } from '../../lib/money.js';
import { requireAdmin, scopeBranch } from '../../middleware/admin-auth.js';
import { validate } from '../../middleware/validate.js';
import { listOptions } from '../menu/options.service.js';
import {
  settingSchema,
  allSettings,
  setSetting,
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
const GLOBAL_READ = ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] as const;
const WRITE_WITH_BRANCH = ['SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER'] as const;

const queryText = z.string().max(300).transform((value) => value || undefined).optional();
const queryDate = z.string().max(64)
  .transform((value) => value ? new Date(value) : undefined)
  .refine((value) => value === undefined || !Number.isNaN(value.getTime()), {
    message: 'Geçerli bir tarih verilmeli',
  }).optional();
// Strings only: arrays, scientific notation, decimals and non-finite values
// must not reach Prisma's skip/take or unbounded reconciliation loops.
const queryInteger = (fallback: number, maximum: number) => z.string()
  .regex(/^\d+$/, 'Pozitif bir tam sayı verilmeli')
  .transform(Number).pipe(z.number().int().min(1).max(maximum))
  .optional().default(fallback);
const paginationSchema = (defaultSize = 50, maximumSize = 200) => z.object({
  page: queryInteger(1, 100_000),
  pageSize: queryInteger(defaultSize, maximumSize),
});
const dateRangeSchema = z.object({ from: queryDate, to: queryDate });

type ModuleRequest<Body = unknown> = Request<Record<string, string>, unknown, Body>;

/// Route gövdelerini tek yerde sarmalar: try/catch tekrarını kaldırır.
function h<Body = unknown>(
  fn: (req: ModuleRequest<Body>) => Promise<unknown>,
): RequestHandler<Record<string, string>, unknown, Body> {
  return async (req, res, next) => {
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
const productActiveSchema = z.object({ isActive: z.boolean() });
const reorderSchema = z.object({ ids: z.array(z.string()).min(1).max(200) });
const productSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  price: moneyInput.min(0).max(100000),
  categoryId: z.string().min(1),
  description: z.string().max(500).default(''),
  imageUrl: z.string().max(500).nullable().default(null),
  gridImageUrl: z.string().max(500).nullable().optional(),
  sizeMl: z.number().int().min(0).max(5000).default(0),
  stampMultiplier: z.number().int().min(0).max(10).default(0),
  isNew: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  hasOptions: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
const bulkPriceSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    categoryId: z.string().optional(),
    percent: z.number().min(-90).max(200).optional(),
    amount: moneyInput.min(-10000).max(10000).optional(),
    roundTo: moneyInput.min(0).max(100).default(0),
    reason: z.string().trim().min(5).max(300),
  })
  .refine((v) => v.percent !== undefined || v.amount !== undefined, {
    message: 'percent veya amount verilmeli',
  });
const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  priceOverride: moneyInput.min(0).max(100000).nullable().optional(),
});
const optionSchema = z.object({
  id: z.string().optional(),
  group: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  priceDelta: moneyInput.min(-1000).max(1000),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

const productQuerySchema = paginationSchema().extend({
  categoryId: queryText,
  q: queryText,
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});

modulesRouter.get('/menu/categories', requireAdmin(), h(() => listCategories()));
modulesRouter.post(
  '/menu/categories',
  requireAdmin(...WRITE),
  validate(categorySchema),
  h<z.infer<typeof categorySchema>>((req) => upsertCategory(req, req.body)),
);
modulesRouter.post(
  '/menu/categories/reorder',
  requireAdmin(...WRITE),
  validate(reorderSchema),
  h<z.infer<typeof reorderSchema>>(async (req) => {
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
  h((req) => listProducts(productQuerySchema.parse(req.query))),
);
modulesRouter.post(
  '/menu/products',
  requireAdmin(...WRITE),
  validate(productSchema),
  h<z.infer<typeof productSchema>>((req) => upsertProduct(req, req.body)),
);
modulesRouter.post(
  '/menu/products/:id/active',
  requireAdmin(...WRITE),
  validate(productActiveSchema),
  h<z.infer<typeof productActiveSchema>>((req) => setProductActive(req, String(req.params.id), req.body.isActive)),
);
modulesRouter.post(
  '/menu/bulk-price',
  requireAdmin(...WRITE),
  validate(bulkPriceSchema),
  h<z.infer<typeof bulkPriceSchema>>((req) => bulkPrice(req, req.body)),
);

modulesRouter.get('/menu/options', requireAdmin(), h(() => listOptions()));
modulesRouter.post(
  '/menu/options',
  requireAdmin(...WRITE),
  validate(optionSchema),
  h<z.infer<typeof optionSchema>>((req) => saveOption(req, req.body)),
);

// ── A4 Şubeler ──────────────────────────────────────────────────────

const branchOpenSchema = z.object({ isOpen: z.boolean() });
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
  h<z.infer<typeof branchSchema>>((req) => upsertBranch(req, req.body)),
);
modulesRouter.post(
  '/branches/:id/open',
  requireAdmin(...WRITE_WITH_BRANCH),
  validate(branchOpenSchema),
  h<z.infer<typeof branchOpenSchema>>((req) => {
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
  h<z.infer<typeof availabilitySchema>>((req) => {
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
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
modulesRouter.get('/campaigns', requireAdmin(), h(() => listCampaigns()));
modulesRouter.post(
  '/campaigns',
  requireAdmin(...WRITE),
  validate(campaignSchema),
  h<z.infer<typeof campaignSchema>>((req) => upsertCampaign(req, req.body)),
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
  h<z.infer<typeof promoSchema>>((req) => upsertPromo(req, req.body)),
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
  h<z.infer<typeof settingSchema>>(async (req) => {
    await setSetting(req, req.body.key, req.body.value);
    return allSettings();
  }),
);

// ── A6 Müşteriler ───────────────────────────────────────────────────

const reasonSchema = z.object({ reason: z.string().trim().min(5).max(300) });
const blockSchema = reasonSchema.extend({ isBlocked: z.boolean() });
const balanceSchema = reasonSchema.extend({
  idempotencyKey: z.string().uuid(),
  amount: moneyInput.refine((v) => v !== 0, 'Tutar sıfır olamaz'),
});
const loyaltySchema = reasonSchema.extend({
  stamps: z.number().int().min(0).max(100).optional(),
  freeDrinks: z.number().int().min(0).max(100).optional(),
});

const customerQuerySchema = paginationSchema(25, 100).extend({
  q: queryText,
  sort: z.enum(['ltv', 'recent']).default('recent'),
});

modulesRouter.get(
  '/customers',
  requireAdmin(...GLOBAL_READ),
  h((req) => listCustomers(customerQuerySchema.parse(req.query))),
);
modulesRouter.get('/customers/gifts/pending', requireAdmin(...GLOBAL_READ), h(() => pendingGifts()));
modulesRouter.get(
  '/customers/:id',
  requireAdmin(...GLOBAL_READ),
  h((req) => customerDetail(String(req.params.id))),
);
modulesRouter.post(
  '/customers/:id/balance',
  requireAdmin(...WRITE),
  validate(balanceSchema),
  h<z.infer<typeof balanceSchema>>((req) => adjustBalance(req, String(req.params.id), req.body.amount, req.body.reason, req.body.idempotencyKey)),
);
modulesRouter.post(
  '/customers/:id/loyalty',
  requireAdmin(...WRITE),
  validate(loyaltySchema),
  h<z.infer<typeof loyaltySchema>>((req) =>
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
  h<z.infer<typeof reasonSchema>>((req) => revokeSessions(req, String(req.params.id), req.body.reason)),
);
modulesRouter.post(
  '/customers/:id/block',
  requireAdmin(...WRITE),
  validate(blockSchema),
  h<z.infer<typeof blockSchema>>((req) =>
    setBlocked(req, String(req.params.id), req.body.isBlocked, req.body.reason),
  ),
);

// ── A7 Finans ───────────────────────────────────────────────────────

const TX_TYPES = [
  'TOPUP',
  'ADJUSTMENT',
  'ORDER_PAYMENT',
  'GIFT_SENT',
  'GIFT_RECEIVED',
  'QR_PAYMENT',
  'REFUND',
] as const;
const ledgerQuerySchema = dateRangeSchema.extend({
  q: queryText,
  type: z.enum(TX_TYPES).optional(),
});
const pagedLedgerQuerySchema = ledgerQuerySchema.extend(paginationSchema().shape);
const paymentsQuerySchema = dateRangeSchema.extend({
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED']).optional(),
});
const reconciliationQuerySchema = z.object({ days: queryInteger(7, 366) });

modulesRouter.get(
  '/finance/ledger',
  requireAdmin(...GLOBAL_READ),
  h((req) => ledger(pagedLedgerQuerySchema.parse(req.query))),
);
modulesRouter.get('/finance/ledger.csv', requireAdmin(...GLOBAL_READ), async (req, res, next) => {
  try {
    const csv = await ledgerCsv(ledgerQuerySchema.parse(req.query));
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
modulesRouter.get('/finance/ledger.xlsx', requireAdmin(...GLOBAL_READ), async (req, res, next) => {
  try {
    const buffer = await ledgerWorkbook(ledgerQuerySchema.parse(req.query));
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
  requireAdmin(...GLOBAL_READ),
  h((req) => payments(paymentsQuerySchema.parse(req.query))),
);
modulesRouter.get(
  '/finance/charges',
  requireAdmin(...GLOBAL_READ),
  h((req) => charges(dateRangeSchema.parse(req.query))),
);
modulesRouter.post(
  '/finance/charges/:id/void',
  requireAdmin(...WRITE),
  validate(reasonSchema),
  h<z.infer<typeof reasonSchema>>((req) => voidChargeFromPanel(req, String(req.params.id), req.body.reason)),
);
modulesRouter.get(
  '/finance/reconciliation',
  requireAdmin(...GLOBAL_READ),
  h((req) => reconciliation(reconciliationQuerySchema.parse(req.query).days)),
);

// ── A8 POS izleme ───────────────────────────────────────────────────

const eventQuerySchema = paginationSchema().extend({
  source: queryText,
  eventType: queryText,
  status: z.enum(['RECEIVED', 'PROCESSED', 'FAILED']).optional(),
});

modulesRouter.get(
  '/pos/events',
  requireAdmin(...GLOBAL_READ),
  h((req) => listEvents(eventQuerySchema.parse(req.query))),
);
modulesRouter.get('/pos/health', requireAdmin(...GLOBAL_READ), h(() => health()));
modulesRouter.post(
  '/pos/events/:id/requeue',
  requireAdmin(...WRITE),
  validate(reasonSchema),
  h<z.infer<typeof reasonSchema>>((req) => requeue(req, String(req.params.id), req.body.reason)),
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
  h<z.infer<typeof adminCreateSchema>>((req) => createAdmin(req, req.body)),
);
modulesRouter.patch(
  '/admins/:id',
  requireAdmin('SUPER_ADMIN'),
  validate(adminUpdateSchema),
  h<z.infer<typeof adminUpdateSchema>>((req) => updateAdmin(req, String(req.params.id), req.body)),
);
modulesRouter.post(
  '/admins/:id/reset-password',
  requireAdmin('SUPER_ADMIN'),
  h((req) => resetPassword(req, String(req.params.id))),
);

const auditQuerySchema = paginationSchema().extend({
  adminId: queryText,
  entity: queryText,
  entityId: queryText,
  action: queryText,
});

modulesRouter.get(
  '/audit',
  requireAdmin('SUPER_ADMIN', 'MANAGER'),
  h((req) => listAudit(auditQuerySchema.parse(req.query))),
);
