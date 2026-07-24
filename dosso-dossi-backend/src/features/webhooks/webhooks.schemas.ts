import { z } from 'zod';

export const saleSchema = z.object({
  saleId: z.string().min(1).max(80),
  branchId: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
  customer: z
    .object({
      chargeId: z.string().optional(),
      qrCode: z.string().optional(),
    })
    .default({}),
  // Adaptör Kerzz PLU'larını bizim ürün slug'larımıza çevirip gönderir;
  // bilinmeyen productId satırı damga kazandırmaz (hata değildir).
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        name: z.string().optional(),
        quantity: z.number().int().min(1).max(100),
        unitPrice: z.number().optional(),
      }),
    )
    .min(1),
  total: z.number().optional(),
});

export const orderStatusSchema = z.object({
  eventId: z.string().min(1).max(80),
  orderId: z.string().regex(/^DD-\d+$/),
  status: z.enum(['preparing', 'ready', 'completed', 'cancelled']),
  occurredAt: z.string().datetime().optional(),
});

export type SaleInput = z.infer<typeof saleSchema>;
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
