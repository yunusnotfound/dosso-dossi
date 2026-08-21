import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../../lib/errors.js';
import { dec, toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { invalidateOptionCache } from '../menu/options.service.js';
import { audit } from './audit.js';

// ── Kategoriler ─────────────────────────────────────────────────────

export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
  }));
}

export async function upsertCategory(
  req: Request,
  input: { id: string; name: string; sortOrder: number },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findUnique({ where: { id: input.id } });
    const after = await tx.category.upsert({
      where: { id: input.id },
      update: { name: input.name, sortOrder: input.sortOrder },
      create: input,
    });
    await audit(tx, req, {
      action: before ? 'category.update' : 'category.create',
      entity: 'Category',
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

/// Ürünü olan kategori silinemez: menüde sahipsiz ürün kalmasın.
export async function deleteCategory(req: Request, id: string) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.product.count({ where: { categoryId: id } });
    if (count > 0) {
      throw AppError.invalidStatusTransition(
        `Kategoride ${count} ürün var; önce ürünleri taşıyın`,
      );
    }
    const before = await tx.category.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Kategori bulunamadı');
    await tx.category.delete({ where: { id } });
    await audit(tx, req, {
      action: 'category.delete',
      entity: 'Category',
      entityId: id,
      before,
    });
  });
}

/// Sürükle-bırak sıralama: tüm sıra tek transaction'da yazılır.
export async function reorderCategories(req: Request, ids: string[]) {
  await prisma.$transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.category.update({ where: { id }, data: { sortOrder: index } });
    }
    await audit(tx, req, {
      action: 'category.reorder',
      entity: 'Category',
      entityId: '*',
      after: { order: ids },
    });
  });
}

// ── Ürünler ─────────────────────────────────────────────────────────

export interface ProductFilters {
  categoryId?: string;
  q?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listProducts(f: ProductFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, f.pageSize ?? 50));
  const where: Prisma.ProductWhereInput = {
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.isActive === undefined ? {} : { isActive: f.isActive }),
    ...(f.q ? { name: { contains: f.q, mode: 'insensitive' as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { name: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    page,
    pageSize,
    total,
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: toMoney(p.price),
      categoryId: p.categoryId,
      categoryName: p.category.name,
      description: p.description,
      imageUrl: p.imageUrl,
      sizeMl: p.sizeMl,
      stampMultiplier: p.stampMultiplier,
      isNew: p.isNew,
      isFeatured: p.isFeatured,
      hasOptions: p.hasOptions,
      isActive: p.isActive,
    })),
  };
}

export interface ProductInput {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  description?: string;
  imageUrl?: string | null;
  gridImageUrl?: string | null;
  sizeMl?: number;
  stampMultiplier?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  hasOptions?: boolean;
  isActive?: boolean;
}

export async function upsertProduct(req: Request, input: ProductInput) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) throw AppError.notFound('Kategori bulunamadı');

    const before = await tx.product.findUnique({ where: { id: input.id } });
    const data = {
      name: input.name,
      price: dec(input.price),
      categoryId: input.categoryId,
      description: input.description ?? '',
      imageUrl: input.imageUrl ?? null,
      gridImageUrl: input.gridImageUrl,
      sizeMl: input.sizeMl ?? 0,
      stampMultiplier: input.stampMultiplier ?? 0,
      isNew: input.isNew ?? false,
      isFeatured: input.isFeatured ?? false,
      hasOptions: input.hasOptions ?? false,
      isActive: input.isActive ?? true,
    };
    const after = await tx.product.upsert({
      where: { id: input.id },
      update: data,
      create: { id: input.id, ...data },
    });
    await audit(tx, req, {
      action: before ? 'product.update' : 'product.create',
      entity: 'Product',
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

/// Ürün silmek yerine pasifleştirilir: geçmiş siparişlerin kalem
/// referansları (productId) kırılmasın.
export async function setProductActive(
  req: Request,
  id: string,
  isActive: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Ürün bulunamadı');
    const after = await tx.product.update({ where: { id }, data: { isActive } });
    await audit(tx, req, {
      action: isActive ? 'product.activate' : 'product.deactivate',
      entity: 'Product',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return after;
  });
}

export interface BulkPriceInput {
  categoryId?: string;
  /// Yüzde zam (10 ⇒ %10) veya sabit tutar (₺). Biri verilir.
  percent?: number;
  amount?: number;
  /// Sonucu en yakın bu katına yuvarla (5 ⇒ 185 → 185, 187 → 185/190).
  roundTo?: number;
  reason: string;
}

/// Toplu fiyat güncelleme. Önizleme değil, uygulama: tek transaction ve
/// tek audit kaydında etkilenen tüm ürünlerin öncesi/sonrası saklanır.
export async function bulkPrice(req: Request, input: BulkPriceInput) {
  if (input.percent === undefined && input.amount === undefined) {
    throw AppError.notFound('percent veya amount verilmeli');
  }
  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: input.categoryId ? { categoryId: input.categoryId } : {},
    });
    const changes: { id: string; from: number; to: number }[] = [];

    for (const p of products) {
      const current = Number(p.price);
      let next =
        input.percent !== undefined
          ? current * (1 + input.percent / 100)
          : current + (input.amount ?? 0);
      if (input.roundTo && input.roundTo > 0) {
        next = Math.round(next / input.roundTo) * input.roundTo;
      }
      next = Math.max(0, Number(next.toFixed(2)));
      if (next === current) continue;
      await tx.product.update({ where: { id: p.id }, data: { price: dec(next) } });
      changes.push({ id: p.id, from: current, to: next });
    }

    await audit(tx, req, {
      action: 'product.bulkPrice',
      entity: 'Product',
      entityId: input.categoryId ?? '*',
      after: { changes, percent: input.percent, amount: input.amount },
      reason: input.reason,
    });
    return { updated: changes.length, changes };
  });
}

// ── Şube × ürün müsaitlik matrisi ───────────────────────────────────

/// Satır yoksa ürün o şubede müsait sayılır (şema kuralı); matris bunu
/// açıkça true olarak döndürür ki panel üç durumlu olmasın.
export async function availabilityMatrix(branchId: string) {
  const [products, rows] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
      include: { category: { select: { name: true } } },
    }),
    prisma.branchProduct.findMany({ where: { branchId } }),
  ]);
  const byId = new Map(rows.map((r) => [r.productId, r]));

  return products.map((p) => {
    const row = byId.get(p.id);
    return {
      productId: p.id,
      name: p.name,
      categoryName: p.category.name,
      basePrice: toMoney(p.price),
      isAvailable: row?.isAvailable ?? true,
      priceOverride: row?.priceOverride ? toMoney(row.priceOverride) : null,
    };
  });
}

export async function setAvailability(
  req: Request,
  branchId: string,
  productId: string,
  input: { isAvailable: boolean; priceOverride?: number | null },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.branchProduct.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
    const data = {
      isAvailable: input.isAvailable,
      priceOverride:
        input.priceOverride === null || input.priceOverride === undefined
          ? null
          : dec(input.priceOverride),
    };
    const after = await tx.branchProduct.upsert({
      where: { branchId_productId: { branchId, productId } },
      update: data,
      create: { branchId, productId, ...data },
    });
    await audit(tx, req, {
      action: 'branchProduct.set',
      entity: 'BranchProduct',
      entityId: `${branchId}:${productId}`,
      before,
      after,
    });
    return after;
  });
}

// ── Opsiyonlar ──────────────────────────────────────────────────────

export async function saveOption(
  req: Request,
  input: {
    id?: string;
    group: string;
    name: string;
    priceDelta: number;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  const saved = await prisma.$transaction(async (tx) => {
    const before = input.id
      ? await tx.productOption.findUnique({ where: { id: input.id } })
      : null;
    const data = {
      group: input.group,
      name: input.name,
      priceDelta: dec(input.priceDelta),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    };
    const after = input.id
      ? await tx.productOption.update({ where: { id: input.id }, data })
      : await tx.productOption.create({ data });
    await audit(tx, req, {
      action: before ? 'option.update' : 'option.create',
      entity: 'ProductOption',
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
  // Fiyatlama önbelleği hemen tazelensin
  invalidateOptionCache();
  return saved;
}
