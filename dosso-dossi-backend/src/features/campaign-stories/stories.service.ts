import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { audit } from '../admin/audit.js';
import { builtInStoryActions, storySchema, type StoryInput } from './stories.schema.js';

const storyOrder = [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] as const;

export async function publicStories(now = new Date()) {
  const activeCampaigns = await prisma.campaign.findMany({
    where: { id: { in: [...builtInStoryActions] }, isActive: true },
    select: { id: true },
  });
  return prisma.campaignStory.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        { OR: [
          { action: { notIn: [...builtInStoryActions] } },
          { action: { in: activeCampaigns.map((campaign) => campaign.id) } },
        ] },
      ],
    },
    orderBy: [...storyOrder],
  });
}

export async function adminStories() {
  return prisma.campaignStory.findMany({ orderBy: [...storyOrder] });
}

export async function saveStory(req: Request, raw: StoryInput) {
  // Validate in the service too so callers cannot bypass the publishing contract.
  const input = storySchema.parse(raw);
  const { id, startsAt, endsAt, ...fields } = input;
  const data = {
    ...fields,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
  };
  return prisma.$transaction(async (tx) => {
    if (id) await tx.$queryRaw`SELECT id FROM "CampaignStory" WHERE id = ${id} FOR UPDATE`;
    const before = id ? await tx.campaignStory.findUnique({ where: { id } }) : null;
    if (id && !before) throw AppError.notFound('Hikâye bulunamadı');
    if (builtInStoryActions.some((action) => action === input.action)) {
      const campaign = await tx.campaign.findUnique({ where: { id: input.action }, select: { id: true } });
      if (!campaign) throw AppError.notFound('Bağlı kampanya bulunamadı');
    }
    const after = id
      ? await tx.campaignStory.update({ where: { id }, data })
      : await tx.campaignStory.create({ data });
    await audit(tx, req, {
      entity: 'CampaignStory', entityId: after.id,
      action: before ? 'story.update' : 'story.create', before, after,
    });
    return after;
  });
}

export async function deleteStory(req: Request, id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CampaignStory" WHERE id = ${id} FOR UPDATE`;
    const before = await tx.campaignStory.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Hikâye bulunamadı');
    await tx.campaignStory.delete({ where: { id } });
    await audit(tx, req, { entity: 'CampaignStory', entityId: id, action: 'story.delete', before });
  });
}
