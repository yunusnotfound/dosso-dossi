import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const loyaltyRouter = Router();

loyaltyRouter.get('/', async (req, res, next) => {
  try {
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { userId: req.userId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    res.json({
      stamps: account.stamps,
      target: account.target,
      freeDrinks: account.freeDrinks,
      history: account.events.map((e) => ({
        title: e.title,
        date: e.createdAt.toISOString(),
        used: e.used,
      })),
    });
  } catch (err) {
    next(err);
  }
});
