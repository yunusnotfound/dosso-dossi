import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const campaignsRouter = Router();

campaignsRouter.get('/', async (_req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(
      campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        badge: c.badge,
        description: c.description,
        style: c.style,
      })),
    );
  } catch (err) {
    next(err);
  }
});

const validateCodeSchema = z.object({ code: z.string().trim().min(1) });

campaignsRouter.post(
  '/validate-code',
  requireAuth,
  validate(validateCodeSchema),
  async (req, res, next) => {
    try {
      const promo = await prisma.promoCode.findUnique({
        where: { code: (req.body.code as string).toUpperCase() },
      });
      const valid =
        !!promo && promo.isActive && (!promo.expiresAt || promo.expiresAt > new Date());
      res.json({
        valid,
        discountRate: valid ? Number(promo.discountRate) : 0,
      });
    } catch (err) {
      next(err);
    }
  },
);
