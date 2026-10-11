import { z } from 'zod';
import { moneyInput } from '../../lib/money.js';

export const topUpSchema = z.object({
  amount: moneyInput.positive().max(100_000),
  idempotencyKey: z.string().uuid().optional(),
  savedCardId: z.string().optional(),
});
