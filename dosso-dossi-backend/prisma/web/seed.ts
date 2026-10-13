import { PrismaClient } from '@dosso-dossi/web-prisma';
import { webCommandConfiguration } from '../../src/config/web.js';
import fs from 'node:fs';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

async function main(): Promise<void> {
  // Keep the guard here as well: direct `tsx prisma/web/seed.ts` must be safe.
  const config = webCommandConfiguration(process.env);
  const prisma = new PrismaClient({ datasourceUrl: config.WEB_DATABASE_URL });
  try {
    await prisma.webStoreSettings.upsert({ where: { id: 'store' }, create: { id: 'store' }, update: {} });
    console.info('Web mağaza ayarları hazır; mevcut değerler korunmuştur.');
  } finally { await prisma.$disconnect(); }
}

main().catch(() => { console.error('Web seed tamamlanamadı. Ayrı veritabanı ayarlarını ve migration durumunu kontrol edin.'); process.exitCode = 1; });
