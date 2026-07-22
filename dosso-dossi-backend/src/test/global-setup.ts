import { execSync } from 'node:child_process';

export const TEST_DATABASE_URL =
  'postgresql://dosso:dosso@localhost:5433/dosso_dossi_test';

/// Test DB şemasını hazırlar. db push veritabanını yoksa oluşturur;
/// order_number_seq migration SQL'inde olduğu için burada ayrıca kurulur.
export default function globalSetup(): void {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
