import { Router } from 'express';
import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

export const menuRouter = Router();

menuRouter.get('/categories', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(categories.map((c) => ({ id: c.id, name: c.name })));
  } catch (err) {
    next(err);
  }
});

menuRouter.get('/products', async (req, res, next) => {
  try {
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    if (branchId && !(await prisma.branch.findUnique({ where: { id: branchId } }))) {
      throw AppError.notFound('Şube bulunamadı');
    }
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(branchId ? { branchAvailability: { none: { branchId, isAvailable: false } } } : {}),
      },
      include: { branchAvailability: { where: { branchId: branchId ?? '' } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    res.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        price: toMoney(p.branchAvailability[0]?.priceOverride ?? p.price),
        categoryId: p.categoryId,
        description: p.description,
        imageUrl: p.imageUrl,
        gridImageUrl: p.gridImageUrl,
        sizeMl: p.sizeMl,
        stampMultiplier: p.stampMultiplier,
        isNew: p.isNew,
        isFeatured: p.isFeatured,
        hasOptions: p.hasOptions,
      })),
    );
  } catch (err) {
    next(err);
  }
});

menuRouter.get('/options', async (_req, res, next) => {
  try {
    const options = await prisma.productOption.findMany({
      where: { isActive: true },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(options.map((option) => ({ ...option, priceDelta: toMoney(option.priceDelta) })));
  } catch (err) {
    next(err);
  }
});
