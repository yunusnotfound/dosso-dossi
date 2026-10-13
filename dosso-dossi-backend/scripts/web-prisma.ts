import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { webCommandConfiguration } from '../src/config/web.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

try {
  const config = webCommandConfiguration(process.env);
  const action = process.argv[2];
  const extra = process.argv.slice(3);
  // Arbitrary --schema/--url arguments must not bypass isolation. Local roles do not
  // have CREATEDB; reviewed migrations are applied without migrate dev/shadow DBs.
  if (extra.length) throw new Error('Web Prisma komutları ek seçenek kabul etmez.');
  let args: string[];
  if (action === 'deploy') args = ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/web/schema.prisma'];
  else if (action === 'seed') args = ['--import', 'tsx', 'prisma/web/seed.ts'];
  else throw new Error('Desteklenmeyen web Prisma komutu.');
  const result = spawnSync(process.execPath, args, {
    env: { ...process.env, WEB_DATABASE_URL: config.WEB_DATABASE_URL }, stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
} catch (error) {
  // Guard messages contain only variable names, never connection strings or credentials.
  console.error(error instanceof Error ? error.message : 'Web veritabanı komutu başarısız.');
  process.exitCode = 1;
}
