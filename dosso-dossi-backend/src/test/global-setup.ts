import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './database.js';

export default function globalSetup(): void {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}
