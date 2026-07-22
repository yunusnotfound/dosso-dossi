import { Router } from 'express';
import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';

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

menuRouter.get('/products', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    res.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        price: toMoney(p.price),
        categoryId: p.categoryId,
        description: p.description,
        imageUrl: p.imageUrl,
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
