import { z } from 'zod';

export const otpSendSchema = z.object({
  phone: z.string().min(10).max(20),
});

export const otpVerifySchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().regex(/^\d{6}$/, '6 haneli kod girin'),
});
