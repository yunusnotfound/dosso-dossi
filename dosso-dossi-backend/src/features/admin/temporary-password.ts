import { AppError, ErrorCodes } from '../../lib/errors.js';

export const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;
export function assertTemporaryPasswordActive(admin: { mustChangePassword: boolean; tempPasswordExpiresAt: Date | null }): void {
  if (admin.mustChangePassword && (!admin.tempPasswordExpiresAt || admin.tempPasswordExpiresAt <= new Date())) {
    throw new AppError(ErrorCodes.TEMP_PASSWORD_EXPIRED, 401, 'Geçici şifrenin süresi doldu. Yöneticinizden yeni şifre isteyin.');
  }
}
