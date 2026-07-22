import { z } from 'zod';

export const topUpSchema = z.object({
  amount: z.number().positive().max(100_000),
  savedCardId: z.string().optional(),
});
