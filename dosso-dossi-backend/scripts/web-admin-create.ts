import fs from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import { z } from 'zod';
import { webCommandConfiguration } from '../src/config/web.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
async function main(): Promise<void> {
  const config = webCommandConfiguration(process.env);
  if (process.argv.length > 2) throw new Error('Kimlik bilgilerini komut argümanına yazmayın. WEB_ADMIN_* ortam değişkenlerini kullanın.');
  const input = z.object({
    email: z.email().max(254).transform((v) => v.toLowerCase()), name: z.string().trim().min(1).max(120),
    password: z.string().min(14).max(200), role: z.enum(['ADMIN', 'EDITOR']).default('ADMIN'),
  }).parse({ email: process.env.WEB_ADMIN_EMAIL, name: process.env.WEB_ADMIN_NAME, password: process.env.WEB_ADMIN_PASSWORD, role: process.env.WEB_ADMIN_ROLE });
  const database = new PrismaClient({ datasourceUrl: config.WEB_DATABASE_URL });
  try {
    if (await database.webAdmin.findUnique({ where: { email: input.email } })) throw new Error('Bu web yöneticisi zaten mevcut; parolası değiştirilmedi.');
    await database.webAdmin.create({ data: { email: input.email, name: input.name, role: input.role, passwordHash: await hash(input.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }) } });
    console.info('Web yönetici hesabı ayrı web veritabanında oluşturuldu.');
  } finally { await database.$disconnect(); }
}
main().catch(() => { console.error('Web yönetici oluşturulamadı. Ayrı web DB migration durumunu, benzersiz e-postayı ve WEB_ADMIN_EMAIL / NAME / PASSWORD (en az 14 karakter) / ROLE alanlarını kontrol edin. Kimlik bilgileri mevcut hesabın üzerine yazılmaz.'); process.exitCode = 1; });
