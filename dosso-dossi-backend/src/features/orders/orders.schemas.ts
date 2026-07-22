import { z } from 'zod';

export const placeOrderSchema = z.object({
  branchId: z.string().min(1),
  pickupSlot: z.string().trim().min(1).max(40),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        size: z.string().max(40).default(''),
        milk: z.string().max(40).default(''),
        shot: z.string().max(40).default(''),
      }),
    )
    .min(1),
  promoCode: z.string().trim().max(40).optional(),
  useFreeDrink: z.boolean().default(false),
  payment: z.object({ method: z.literal('dosso_card') }),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
