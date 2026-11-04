import { z } from 'zod';

const version = z.number().int().min(1).max(2147483647);
export const orderCreateInput = z.object({
  cartVersion: z.number().int().min(0).max(2147483647),
  quoteHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: z.uuid(),
  locale: z.enum(['tr', 'en']).default('tr'),
}).strict();
export const orderVersionInput = z.object({ version }).strict();
const safeText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[\x00-\x1f\x7f]/.test(value), 'Kontrol karakteri kullanılamaz.');
export const orderAdminInput = z.object({
  version, action: z.enum(['PREPARE', 'SHIP', 'DELIVER', 'CANCEL']),
  carrier: safeText(80).optional(), trackingNumber: safeText(100).optional(), note: safeText(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === 'SHIP' && (!value.carrier || !value.trackingNumber)) ctx.addIssue({ code: 'custom', message: 'Kargo firması ve takip numarası gerekli.' });
  if (value.action !== 'SHIP' && (value.carrier || value.trackingNumber)) ctx.addIssue({ code: 'custom', message: 'Kargo bilgileri yalnız gönderim sırasında değiştirilebilir.' });
});
export const orderListInput = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['OPEN', 'CANCELLED', 'EXPIRED', 'COMPLETED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REVIEW']).optional(),
  fulfillmentStatus: z.enum(['UNFULFILLED', 'PREPARING', 'SHIPPED', 'DELIVERED']).optional(),
  q: safeText(100).optional(),
}).strict();
export type OrderCreateInput = z.infer<typeof orderCreateInput>;
export type OrderAdminInput = z.infer<typeof orderAdminInput>;
export type OrderListInput = z.infer<typeof orderListInput>;
const returnText = z.string().trim().min(10).max(2000).refine((value) => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value), 'Kontrol karakteri kullanılamaz.');
export const orderReturnInput = z.object({ version, reason: returnText }).strict();
export const orderReturnReviewInput = z.object({ version, status: z.enum(['IN_REVIEW', 'ACCEPTED', 'REJECTED', 'RECEIVED', 'CLOSED']), resolutionNote: safeText(2000).min(5) }).strict();
