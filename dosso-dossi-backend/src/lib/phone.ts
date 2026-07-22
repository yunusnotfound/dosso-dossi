import { AppError, ErrorCodes } from './errors.js';

/// Türk cep numarasını "5XXXXXXXXX" biçimine indirger.
/// Hediye eşleştirmesi ve auth aynı biçime bağlıdır — tek kaynak burası.
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('90')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^5\d{9}$/.test(digits)) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      400,
      'Geçerli bir cep telefonu numarası girin',
    );
  }
  return digits;
}
