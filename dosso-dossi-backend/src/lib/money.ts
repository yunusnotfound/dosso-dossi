import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from './errors.js';

export const moneyInput = z.number().finite().refine(
  (value) => new Prisma.Decimal(value).decimalPlaces() <= 2,
  'Tutar en fazla iki ondalık basamak içerebilir',
);

// Prisma.Decimal JSON'da string'e dönüşür; yanıt sınırında daima sayıya çevir.
export function toMoney(value: Prisma.Decimal | number): number {
  return Number(new Prisma.Decimal(value).toFixed(2));
}

export function dec(value: number | string): Prisma.Decimal {
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.decimalPlaces() > 2) {
    throw new AppError('VALIDATION_ERROR', 400, 'Tutar en fazla iki ondalık basamak içerebilir');
  }
  return amount;
}
