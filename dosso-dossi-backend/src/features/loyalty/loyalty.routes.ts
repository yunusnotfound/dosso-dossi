import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { historyBoundary, historyPageResult, parseHistoryPage } from '../../lib/history-page.js';

export const loyaltyRouter = Router();

loyaltyRouter.get('/', async (req, res, next) => {
  try {
    const page = parseHistoryPage({ limit: '50', ...req.query });
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { userId: req.userId },
      include: { events: {
        where: historyBoundary(page),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      } },
    });
    const history = historyPageResult(account.events, page, (e) => ({
      id: e.id,
      title: e.title,
      date: e.createdAt.toISOString(),
      used: e.used,
    }));
    res.json({
      stamps: account.stamps,
      target: account.target,
      freeDrinks: account.freeDrinks,
      history: history.items,
      nextCursor: history.nextCursor,
    });
  } catch (err) {
    next(err);
  }
});
