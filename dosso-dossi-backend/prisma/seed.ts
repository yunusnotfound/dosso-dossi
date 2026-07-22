/// İdempotent seed: menü, şubeler, kampanyalar, promosyon kodları.
/// Kullanıcı seed'lenmez — OTP doğrulamasında oluşur.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-data');

function load<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8')) as T;
}

interface MenuData {
  categories: Array<{ id: string; name: string; sortOrder: number }>;
  products: Array<{
    id: string;
    name: string;
    price: number;
    categoryId: string;
    description: string;
    imageUrl: string | null;
    sizeMl: number;
    stampMultiplier: number;
    isNew: boolean;
    isFeatured: boolean;
    hasOptions: boolean;
  }>;
}

async function main() {
  const menu = load<MenuData>('menu.json');
  for (const c of menu.categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: c, create: c });
  }
  for (const p of menu.products) {
    await prisma.product.upsert({ where: { id: p.id }, update: p, create: p });
  }

  const branches = load<Array<Record<string, unknown>>>('branches.json');
  for (const b of branches) {
    await prisma.branch.upsert({
      where: { id: b.id as string },
      update: b as never,
      create: b as never,
    });
  }

  const campaigns = load<Array<Record<string, unknown>>>('campaigns.json');
  for (const c of campaigns) {
    await prisma.campaign.upsert({
      where: { id: c.id as string },
      update: c as never,
      create: c as never,
    });
  }

  const promos = load<Array<{ code: string; discountRate: number }>>('promo-codes.json');
  for (const p of promos) {
    await prisma.promoCode.upsert({ where: { code: p.code }, update: p, create: p });
  }

  const counts = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    branches: await prisma.branch.count(),
    campaigns: await prisma.campaign.count(),
    promoCodes: await prisma.promoCode.count(),
  };
  console.log('Seed tamam:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
