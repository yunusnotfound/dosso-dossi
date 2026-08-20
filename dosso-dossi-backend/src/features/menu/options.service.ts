import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/// Opsiyon fiyat farkları artık DB'de (ProductOption) — panelden düzenlenir.
/// Sipariş fiyatlaması her istekte DB'ye gitmesin diye kısa ömürlü önbellek:
/// panelden yapılan değişiklik en geç TTL kadar sonra fiyatlara yansır.
const TTL_MS = 30_000;

let cache: Map<string, number> | null = null;
let loadedAt = 0;

/// Kod içi son çare: tablo hiç doldurulmamışsa siparişler durmasın.
const FALLBACK: Record<string, number> = {
  'Yulaf sütü': 60,
  'Badem sütü': 60,
  'Çift shot': 40,
};

export async function loadOptionDeltas(): Promise<Map<string, number>> {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await prisma.productOption.findMany({ where: { isActive: true } });
  const map = new Map<string, number>(
    rows.map((r) => [r.name, Number(r.priceDelta)]),
  );
  if (map.size === 0) {
    for (const [k, v] of Object.entries(FALLBACK)) map.set(k, v);
  }
  cache = map;
  loadedAt = Date.now();
  return map;
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
