import { z } from 'zod';

// Validate transport data before it enters query caches, forms or token storage.
// Extra server fields are allowed; fields consumed by the panel are checked.
const dateTimeSchema = z.iso.datetime({ offset: true });

export const adminRoleSchema = z.union([z.literal('SUPER_ADMIN'), z.literal('MANAGER'), z.literal('BRANCH_MANAGER'), z.literal('VIEWER')]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const adminProfileSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  role: adminRoleSchema,
  branchId: z.union([z.string(), z.null()]),
  mustChangePassword: z.boolean(),
  tempPasswordExpiresAt: z.union([dateTimeSchema, z.null()])
});
export type AdminProfile = z.infer<typeof adminProfileSchema>;

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  refreshToken: z.string().min(1),
  admin: adminProfileSchema.and(z.object({
  name: z.string()
}))
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const dashboardSummarySchema = z.object({
  orderRevenue: z.number().finite(),
  qrRevenue: z.number().finite(),
  totalRevenue: z.number().finite(),
  orderCount: z.number().finite(),
  topUpTotal: z.number().finite(),
  newUsers: z.number().finite(),
  stampsEarned: z.number().finite(),
  freeDrinksGranted: z.number().finite(),
  pendingGifts: z.number().finite()
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const timeseriesPointSchema = z.object({
  date: z.iso.date(),
  revenue: z.number().finite(),
  orders: z.number().finite()
});
export type TimeseriesPoint = z.infer<typeof timeseriesPointSchema>;

export const branchStatSchema = z.object({
  branchId: z.string(),
  name: z.string(),
  isOpen: z.boolean(),
  revenue: z.number().finite(),
  orders: z.number().finite()
});
export type BranchStat = z.infer<typeof branchStatSchema>;

export const hourlyPointSchema = z.object({
  hour: z.number().finite(),
  orders: z.number().finite()
});
export type HourlyPoint = z.infer<typeof hourlyPointSchema>;

export const alertsSchema = z.object({
  unforwardedOrders: z.number().finite(),
  failedPosEvents: z.number().finite(),
  closedBranches: z.string().array(),
  pendingPayments: z.number().finite()
});
export type Alerts = z.infer<typeof alertsSchema>;

export const dashboardResponseSchema = z.object({
  summary: dashboardSummarySchema,
  timeseries: timeseriesPointSchema.array(),
  branches: branchStatSchema.array(),
  hourly: hourlyPointSchema.array(),
  alerts: alertsSchema
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const statusSchema = z.union([z.literal('RECEIVED'), z.literal('PREPARING'), z.literal('READY'), z.literal('COMPLETED'), z.literal('CANCELLED')]);
export type Status = z.infer<typeof statusSchema>;

export const orderRowSchema = z.object({
  id: z.string().min(1),
  number: z.number().finite(),
  status: statusSchema,
  branchName: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  itemCount: z.number().finite(),
  total: z.number().finite(),
  usedFreeDrink: z.boolean(),
  promoCode: z.union([z.string(), z.null()]),
  forwarded: z.boolean(),
  createdAt: dateTimeSchema
});
export type OrderRow = z.infer<typeof orderRowSchema>;

export const orderListSchema = z.object({
  page: z.number().finite(),
  pageSize: z.number().finite(),
  total: z.number().finite(),
  orders: orderRowSchema.array()
});
export type OrderList = z.infer<typeof orderListSchema>;

export const orderDetailSchema = z.object({
  id: z.string().min(1),
  status: statusSchema,
  pickupSlot: z.string(),
  branch: z.object({
  id: z.string().min(1),
  name: z.string()
}),
  customer: z.object({
  id: z.string().min(1),
  name: z.string(),
  phone: z.string()
}),
  subtotal: z.number().finite(),
  discount: z.number().finite(),
  freeDrinkDiscount: z.number().finite(),
  total: z.number().finite(),
  promoCode: z.union([z.string(), z.null()]),
  usedFreeDrink: z.boolean(),
  stampsEarned: z.number().finite(),
  forwardedAt: z.union([dateTimeSchema, z.null()]),
  createdAt: dateTimeSchema,
  items: z.object({
  id: z.string().min(1),
  productName: z.string(),
  unitPrice: z.number().finite(),
  quantity: z.number().finite(),
  size: z.string(),
  milk: z.string(),
  shot: z.string(),
  isFreeDrink: z.boolean()
}).array(),
  walletTransactions: z.object({
  id: z.string().min(1),
  type: z.string(),
  amount: z.number().finite(),
  balanceAfter: z.number().finite(),
  note: z.string(),
  createdAt: dateTimeSchema
}).array()
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const customerRowSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  isBlocked: z.boolean(),
  balance: z.number().finite(),
  stamps: z.number().finite(),
  target: z.number().finite(),
  freeDrinks: z.number().finite(),
  orderCount: z.number().finite(),
  lifetimeSpend: z.number().finite(),
  createdAt: dateTimeSchema
});
export type CustomerRow = z.infer<typeof customerRowSchema>;

export const customerListSchema = z.object({
  page: z.number().finite(),
  pageSize: z.number().finite(),
  total: z.number().finite(),
  customers: customerRowSchema.array()
});
export type CustomerList = z.infer<typeof customerListSchema>;

export const customerDetailSchema = customerRowSchema.pick({ id: true, name: true, phone: true, email: true, isBlocked: true, balance: true, orderCount: true, createdAt: true }).extend({
  activeSessions: z.number().finite(),
  loyalty: z.object({
  stamps: z.number().finite(),
  target: z.number().finite(),
  freeDrinks: z.number().finite()
}),
  transactions: z.object({
  id: z.string().min(1),
  type: z.string(),
  amount: z.number().finite(),
  balanceAfter: z.number().finite(),
  note: z.string(),
  createdAt: dateTimeSchema
}).array(),
  orders: z.object({
  id: z.string().min(1),
  status: z.string(),
  branchName: z.string(),
  total: z.number().finite(),
  createdAt: dateTimeSchema
}).array(),
  loyaltyEvents: z.object({
  id: z.string().min(1),
  type: z.string(),
  title: z.string(),
  createdAt: dateTimeSchema
}).array(),
  giftsSent: z.object({
  id: z.string().min(1),
  label: z.string(),
  status: z.string(),
  recipientPhone: z.string()
}).array(),
  giftsReceived: z.object({
  id: z.string().min(1),
  label: z.string(),
  status: z.string()
}).array(),
  qrCharges: z.object({
  id: z.string().min(1),
  amount: z.number().finite(),
  status: z.string(),
  createdAt: dateTimeSchema
}).array()
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

export const ledgerEntrySchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  amount: z.number().finite(),
  balanceAfter: z.number().finite(),
  note: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  createdAt: dateTimeSchema
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const ledgerSchema = z.object({
  page: z.number().finite(),
  pageSize: z.number().finite(),
  total: z.number().finite(),
  totalsByType: z.object({
  type: z.string(),
  count: z.number().finite(),
  amount: z.number().finite()
}).array(),
  entries: ledgerEntrySchema.array()
});
export type Ledger = z.infer<typeof ledgerSchema>;

export const paymentSchema = z.object({
  id: z.string().min(1),
  amount: z.number().finite(),
  status: z.string(),
  provider: z.string(),
  providerRef: z.union([z.string(), z.null()]),
  bonusDrinks: z.number().finite(),
  customerName: z.string(),
  customerPhone: z.string(),
  createdAt: dateTimeSchema,
  confirmedAt: z.union([dateTimeSchema, z.null()])
});
export type Payment = z.infer<typeof paymentSchema>;

export const chargeSchema = z.object({
  id: z.string().min(1),
  amount: z.number().finite(),
  status: z.string(),
  saleRef: z.union([z.string(), z.null()]),
  customerName: z.string(),
  customerPhone: z.string(),
  createdAt: dateTimeSchema
});
export type Charge = z.infer<typeof chargeSchema>;

export const reconRowSchema = z.object({
  date: z.iso.date(),
  ourCount: z.number().finite(),
  ourAmount: z.number().finite(),
  posMatched: z.number().finite(),
  missingSaleRef: z.number().finite()
});
export type ReconRow = z.infer<typeof reconRowSchema>;

export const adminRowSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  name: z.string(),
  role: adminRoleSchema,
  branchId: z.union([z.string(), z.null()]),
  branchName: z.union([z.string(), z.null()]),
  isActive: z.boolean(),
  lastLoginAt: z.union([dateTimeSchema, z.null()]),
  createdAt: dateTimeSchema
});
export type AdminRow = z.infer<typeof adminRowSchema>;

export const auditRowSchema = z.object({
  id: z.string().min(1),
  adminEmail: z.string(),
  adminName: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  reason: z.string(),
  ip: z.string(),
  createdAt: dateTimeSchema
});
export type AuditRow = z.infer<typeof auditRowSchema>;

export const auditListSchema = z.object({
  page: z.number().finite(),
  pageSize: z.number().finite(),
  total: z.number().finite(),
  logs: auditRowSchema.array()
});
export type AuditList = z.infer<typeof auditListSchema>;

export const posEventSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  eventType: z.string(),
  externalId: z.string(),
  status: z.union([z.literal('RECEIVED'), z.literal('PROCESSED'), z.literal('FAILED'), z.literal('SKIPPED')]),
  error: z.union([z.string(), z.null()]),
  payload: z.unknown(),
  response: z.unknown(),
  createdAt: dateTimeSchema,
  processedAt: z.union([dateTimeSchema, z.null()])
});
export type PosEvent = z.infer<typeof posEventSchema>;

export const eventListSchema = z.object({
  page: z.number().finite(),
  pageSize: z.number().finite(),
  total: z.number().finite(),
  events: posEventSchema.array()
});
export type EventList = z.infer<typeof eventListSchema>;

export const healthSchema = z.object({
  sources: z.object({
  source: z.string(),
  lastSeenAt: z.union([dateTimeSchema, z.null()]),
  total: z.number().finite(),
  failed: z.number().finite()
}).array(),
  outbox: z.object({
  id: z.string().min(1),
  number: z.number().finite(),
  branchName: z.string(),
  createdAt: dateTimeSchema,
  waitingMinutes: z.number().finite()
}).array()
});
export type Health = z.infer<typeof healthSchema>;

export const branchSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  hours: z.string(),
  isOpen: z.boolean(),
  prepMinutes: z.number().finite(),
  orderCount: z.number().finite()
});
export type Branch = z.infer<typeof branchSchema>;

export const availabilitySchema = z.object({
  productId: z.string(),
  name: z.string(),
  categoryName: z.string(),
  basePrice: z.number().finite(),
  isAvailable: z.boolean(),
  priceOverride: z.union([z.number().finite(), z.null()])
});
export type Availability = z.infer<typeof availabilitySchema>;

export const campaignSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  badge: z.string(),
  description: z.string(),
  style: z.union([z.literal('orange'), z.literal('dark')]),
  sortOrder: z.number().finite(),
  isActive: z.boolean()
});
export type Campaign = z.infer<typeof campaignSchema>;

export const promoSchema = z.object({
  code: z.string(),
  discountRate: z.number().finite(),
  isActive: z.boolean(),
  expiresAt: z.union([dateTimeSchema, z.null()]),
  usageCount: z.number().finite(),
  totalDiscount: z.number().finite()
});
export type Promo = z.infer<typeof promoSchema>;

export const storyActionSchema = z.union([z.literal('none'), z.literal('kahve-ictikce'), z.literal('yukle-kazan'), z.literal('online-magaza'), z.literal('siparis')]);
export type StoryAction = z.infer<typeof storyActionSchema>;

export const campaignStorySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  action: storyActionSchema,
  actionLabel: z.string(),
  sortOrder: z.number().finite(),
  isActive: z.boolean(),
  startsAt: z.union([dateTimeSchema, z.null()]),
  endsAt: z.union([dateTimeSchema, z.null()]),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema
});
export type CampaignStory = z.infer<typeof campaignStorySchema>;

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  sortOrder: z.number().finite(),
  productCount: z.number().finite()
});
export type Category = z.infer<typeof categorySchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  price: z.number().finite(),
  categoryId: z.string(),
  categoryName: z.string(),
  description: z.string(),
  imageUrl: z.union([z.string(), z.null()]),
  gridImageUrl: z.union([z.string(), z.null()]),
  sizeMl: z.number().finite(),
  stampMultiplier: z.number().finite(),
  isNew: z.boolean(),
  isFeatured: z.boolean(),
  hasOptions: z.boolean(),
  isActive: z.boolean()
});
export type Product = z.infer<typeof productSchema>;

export const productListSchema = z.object({
  page: z.number().finite(),
  pageSize: z.number().finite(),
  total: z.number().finite(),
  products: productSchema.array()
});
export type ProductList = z.infer<typeof productListSchema>;

export const optionSchema = z.object({
  id: z.string().min(1),
  group: z.string(),
  name: z.string(),
  priceDelta: z.union([z.string(), z.number().finite()]),
  sortOrder: z.number().finite(),
  isActive: z.boolean()
});
export type Option = z.infer<typeof optionSchema>;

export const refreshResponseSchema = z.object({ token: z.string().min(1), refreshToken: z.string().min(1) });
export const tempPasswordSchema = z.object({ tempPassword: z.string().min(1) });
export const bulkPriceResultSchema = z.object({ updated: z.number().int().nonnegative() });
export const storyImageSchema = z.object({ imageUrl: z.string().min(1) });
export const settingsSchema = z.object({
  'loyalty.stampTarget': z.number().int().min(1).max(100),
  'loyalty.topUpBonusThreshold': z.number().positive(),
  'loyalty.topUpBonusDrinks': z.number().int().nonnegative(),
  'loyalty.topUpBonusFirstOnly': z.boolean(),
});
// Callers that ignore a mutation result still require a JSON object.
export const mutationResultSchema = z.record(z.string(), z.unknown());
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export const accountRequestStatusSchema = z.enum(['OPEN', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED']);
export const accountRequestSchema = z.object({
  id: z.string().min(1), kind: z.enum(['CLOSURE', 'DATA_EXPORT']), status: accountRequestStatusSchema,
  note: z.string(), response: z.string(), createdAt: dateTimeSchema, updatedAt: dateTimeSchema,
  user: z.object({ id: z.string().min(1), name: z.string(), phone: z.string(), email: z.string() }),
  balance: z.number().finite(),
});
export const accountRequestListSchema = z.object({
  page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(),
  entries: accountRequestSchema.array(),
});
export type AccountRequest = z.infer<typeof accountRequestSchema>;
export type AccountRequestStatus = z.infer<typeof accountRequestStatusSchema>;

export const accountRequestUpdateSchema = accountRequestSchema.omit({ user: true, balance: true });
export const balanceUpdateSchema = z.object({ balance: z.number().finite() });
export const loyaltyUpdateSchema = z.object({ stamps: z.number().int().nonnegative(), freeDrinks: z.number().int().nonnegative() });
export const revokedSessionsSchema = z.object({ revoked: z.number().int().nonnegative() });
export const blockUpdateSchema = z.object({ isBlocked: z.boolean() });
export const orderStatusResultSchema = z.object({ status: statusSchema, skipped: z.string().optional() });
export const orderCancelResultSchema = z.object({ refunded: z.number().finite(), stampsReverted: z.number().int(), freeDrinkRestored: z.boolean(), rewardsRevoked: z.number().int() });
export const chargeVoidResultSchema = z.object({ ok: z.literal(true), chargeId: z.string().min(1), refunded: z.number().finite() });
