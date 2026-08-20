import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  deviceInfo: z.string().trim().max(200).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(400),
});

/// Panel şifre kuralı: uzunluk asıl güvenlik, karmaşıklık dayatmıyoruz.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});
