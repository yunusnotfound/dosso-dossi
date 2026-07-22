import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const branchesRouter = Router();

branchesRouter.get('/', async (_req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
    res.json(
      branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        city: b.city,
        phone: b.phone,
        lat: Number(b.lat),
        lng: Number(b.lng),
        hours: b.hours,
        isOpen: b.isOpen,
        prepMinutes: b.prepMinutes,
      })),
    );
  } catch (err) {
    next(err);
  }
});
