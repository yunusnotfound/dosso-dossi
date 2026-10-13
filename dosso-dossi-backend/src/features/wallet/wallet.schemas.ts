import { z } from 'zod';
import { moneyInput } from '../../lib/money.js';

export const topUpSchema = z.object({
  amount: moneyInput.positive().max(100_000),
  idempotencyKey: z.string().uuid().optional(),
  savedCardId: z.string().optional(),
  buyer: z.object({
    name: z.string().trim().min(1).max(80),
    surname: z.string().trim().min(1).max(80),
    email: z.email().max(254),
    identityNumber: z.string().regex(/^\d{11}$/, '11 haneli kimlik numarası gerekli'),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(1).max(80),
    country: z.string().trim().min(1).max(80),
    zipCode: z.string().trim().max(16).optional(),
  }).optional(),
});
