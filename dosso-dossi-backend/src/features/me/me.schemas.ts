import { z } from 'zod';

export const updateMeSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.union([z.string().trim().email(), z.literal('')]).optional(),
});

export const notificationPrefsSchema = z.object({
  campaigns: z.boolean(),
  orderStatus: z.boolean(),
  sms: z.boolean(),
});
