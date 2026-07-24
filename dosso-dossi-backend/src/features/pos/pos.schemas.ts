import { z } from 'zod';

export const chargeSchema = z.object({
  requestId: z.string().min(1).max(80),
  branchId: z.string().min(1),
  code: z.string().min(1).max(120),
  amount: z.number().positive().max(100_000),
  saleRef: z.string().max(80).optional(),
});

export const voidSchema = z.object({
  requestId: z.string().min(1).max(80),
  reason: z.string().max(200).optional(),
});

export type ChargeInput = z.infer<typeof chargeSchema>;
