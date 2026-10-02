import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

/// Opsiyon fiyat farkları artık DB'de (ProductOption) — panelden düzenlenir.
/// Sipariş fiyatlaması her istekte DB'ye gitmesin diye kısa ömürlü önbellek:
/// panelden yapılan değişiklik en geç TTL kadar sonra fiyatlara yansır.
const TTL_MS = 30_000;

let cache: Map<string, number> | null = null;
let loadedAt = 0;

export async function loadOptionDeltas(): Promise<Map<string, number>> {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await prisma.productOption.findMany({ where: { isActive: true } });
  const map = new Map<string, number>(
    rows.map((r) => [r.name, Number(r.priceDelta)]),
  );
  cache = map;
  loadedAt = Date.now();
  return map;
}

/** Checkout reads current options, rather than accepting unknown names as free extras. */
export async function loadOrderOptions(tx: Prisma.TransactionClient) {
  const rows = await tx.productOption.findMany({ where: { isActive: true } });
  const options = new Map(rows.map((row) => [`${row.group}:${row.name}`, Number(row.priceDelta)]));
  return (group: 'milk' | 'shot', name: string): number => {
    if (!name || (group === 'milk' && name === 'Normal süt') || (group === 'shot' && name === 'Tek shot')) return 0;
    const delta = options.get(`${group}:${name}`);
    if (delta === undefined) {
      throw new AppError('VALIDATION_ERROR', 400, 'Seçilen ürün seçeneği artık mevcut değil');
    }
    return delta;
  };
}

/// Panelden değişiklik sonrası önbelleği hemen düşür.
export function invalidateOptionCache(): void {
  cache = null;
}

export async function listOptions() {
  return prisma.productOption.findMany({
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function upsertOption(
  tx: Prisma.TransactionClient,
  input: {
    id?: string;
    group: string;
    name: string;
    priceDelta: number;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  invalidateOptionCache();
  if (input.id) {
    return tx.productOption.update({
      where: { id: input.id },
      data: {
        group: input.group,
        name: input.name,
        priceDelta: input.priceDelta,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
  }
  return tx.productOption.create({
    data: {
      group: input.group,
      name: input.name,
      priceDelta: input.priceDelta,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}
