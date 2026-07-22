import { Prisma } from '@prisma/client';

// Prisma.Decimal JSON'da string'e dönüşür; yanıt sınırında daima sayıya çevir.
export function toMoney(value: Prisma.Decimal | number): number {
  return Number(new Prisma.Decimal(value).toFixed(2));
}

export function dec(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
