import { z } from 'zod';

export const createRequestSchema = z.object({
  kind: z.enum(['CLOSURE', 'DATA_EXPORT']), note: z.string().trim().max(1000).default(''),
}).strict();
export const updateRequestSchema = z.object({
  status: z.enum(['IN_REVIEW', 'COMPLETED', 'REJECTED']),
  response: z.string().trim().min(3).max(2000),
}).strict();
export const requestListQuery = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
});
export const exportQuery = z.object({
  section: z.enum(['profile', 'orders', 'wallet', 'gifts', 'loyalty', 'requests']).default('profile'),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
});
