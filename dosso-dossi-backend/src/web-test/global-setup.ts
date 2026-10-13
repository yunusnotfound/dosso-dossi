import { spawnSync } from 'node:child_process';
import { webTestDatabaseUrl } from '../config/web.js';

export default function setup(): void {
  const target = webTestDatabaseUrl(process.env);
  const result = spawnSync(process.execPath, [
    'node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/web/schema.prisma',
  ], { env: { ...process.env, WEB_DATABASE_URL: target }, stdio: 'pipe' });
  if (result.status !== 0) throw new Error('Web test migration başarısız. Yerel web test PostgreSQL bağlantısını kontrol edin.');
}
