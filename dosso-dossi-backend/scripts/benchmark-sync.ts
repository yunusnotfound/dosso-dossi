/**
 * Isolated sync benchmark; never uses DATABASE_URL as an implicit target.
 * First create an empty disposable dosso_sync_perf*_test database and apply
 * migrations to it. Example (credentials intentionally omitted):
 * TEST_DATABASE_URL=postgresql://USER:PASS@127.0.0.1:PORT/dosso_sync_perf_test \
 *   npx tsx scripts/benchmark-sync.ts /tmp/sync-performance.json
 * Only its own synthetic AdminUser/AuditLog rows are added; no data is deleted.
 */
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import type { Server } from 'node:http';

const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl) throw new Error('Explicit TEST_DATABASE_URL is required');
const target = new URL(rawUrl);
const database = target.pathname.slice(1);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^dosso_sync_perf(?:_[a-z0-9]+)?_test$/.test(database)) {
  throw new Error('Only a local disposable dosso_sync_perf*_test database is allowed');
}
Object.assign(process.env, {
  DATABASE_URL: rawUrl,
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  JWT_SECRET: 'sync-benchmark-customer-secret',
  ADMIN_JWT_SECRET: 'sync-benchmark-admin-secret',
  POS_WEBHOOK_SECRET: 'sync-benchmark-pos-secret',
  PAYMENT_WEBHOOK_SECRET: 'sync-benchmark-payment-secret',
  OTP_DEV_MODE: 'false',
  POS_DEV_AUTOADVANCE: 'false',
});

const { Prisma } = await import('@prisma/client');
const { prisma } = await import('../src/lib/prisma.js');
const { createApp } = await import('../src/app.js');
const output = path.resolve(process.argv[2] ?? '/tmp/sync-performance.json');
const adminId = 'sync-benchmark-admin';
const entities = ['Product', 'Category', 'ProductOption', 'BranchProduct', 'Branch', 'Campaign', 'PromoCode', 'Setting', 'LoyaltyAccount', 'Wallet', 'PosCharge', 'Order'];
const rowCount = 10_000;
let server: Server | undefined;

const rounded = (value: number) => Number(value.toFixed(3));
function distribution(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const quantile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1]!;
  return {
    count: samples.length, unit: 'milliseconds',
    min: rounded(sorted[0]!), p50: rounded(quantile(0.5)), p95: rounded(quantile(0.95)),
    max: rounded(sorted.at(-1)!), mean: rounded(samples.reduce((a, b) => a + b, 0) / samples.length),
    samples: samples.map(rounded),
  };
}

try {
  const [foreignAdmins, foreignAudit, users] = await Promise.all([
    prisma.adminUser.count({ where: { id: { not: adminId } } }),
    prisma.auditLog.count({ where: { NOT: { id: { startsWith: 'sync-benchmark-row-' } } } }),
    prisma.user.count(),
  ]);
  if (foreignAdmins || foreignAudit || users) throw new Error('Database contains non-benchmark data; refusing to seed');
  await prisma.adminUser.upsert({
    where: { id: adminId }, update: {},
    create: { id: adminId, email: 'sync-benchmark@example.invalid', passwordHash: 'disabled-synthetic-account', isActive: false, role: 'VIEWER' },
  });
  for (let start = 0; start < rowCount; start += 1000) {
    await prisma.auditLog.createMany({
      skipDuplicates: true,
      data: Array.from({ length: 1000 }, (_, offset) => {
        const i = start + offset;
        const entity = entities[i % entities.length]!;
        return {
          id: `sync-benchmark-row-${String(i).padStart(6, '0')}`, adminId,
          entity, entityId: `fixture-${i % 200}`, action: entity === 'Order' ? 'order.cancel' : `${entity.toLowerCase()}.update`,
          reason: 'Synthetic sync performance fixture', before: { value: i }, after: { value: i + 1 },
          createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)),
        };
      }),
    });
  }
  if (await prisma.auditLog.count() !== rowCount) throw new Error('Unexpected audit fixture count');
  await prisma.$executeRaw`ANALYZE "AuditLog"`;
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Benchmark HTTP listener failed');
  const endpoint = `http://127.0.0.1:${address.port}/sync/revisions`;
  let expected: string | undefined;
  async function requestRevision() {
    const started = performance.now();
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Sync returned HTTP ${response.status}`);
    const payload = JSON.stringify(await response.json());
    if (expected === undefined) expected = payload;
    if (payload !== expected) throw new Error('Read-only benchmark changed its revisions');
    return performance.now() - started;
  }
  for (let i = 0; i < 5; i++) await requestRevision();
  const sequential: number[] = [];
  for (let i = 0; i < 100; i++) sequential.push(await requestRevision());
  const concurrentStarted = performance.now();
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => requestRevision()));
  const concurrentWallMs = performance.now() - concurrentStarted;
  const plan = await prisma.$queryRaw(Prisma.sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT "entity", "action", COUNT(*), MAX("id") FROM "AuditLog"
    WHERE "entity" IN (${Prisma.join(entities)})
    GROUP BY "entity", "action" ORDER BY "entity" ASC, "action" ASC
  `);
  const pgVersion = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
  const result = {
    capturedAt: new Date().toISOString(), database, postgresEndpoint: `${target.hostname}:${target.port}`,
    environment: { node: process.version, platform: process.platform, architecture: process.arch, postgres: pgVersion[0]!.version },
    fixture: { synthetic: true, auditRows: rowCount, adminRows: 1, domains: entities, warmupRequests: 5 },
    method: 'Actual createApp HTTP GET /sync/revisions on a private ephemeral localhost port; real PostgreSQL in a disposable database; 100 sequential requests and one 10-request concurrent batch.',
    sequential: distribution(sequential), concurrent10: { ...distribution(concurrent), batchWallMs: rounded(concurrentWallMs) },
    queryPlan: plan,
    interpretation: 'This is a small local fixture measurement, not a production capacity or 1000-client SLA claim. HTTP JSON parsing and loopback overhead are included. Ten concurrent requests may include pool expansion; other tasks share the host/container CPU. No extrapolated requests/sec capacity is asserted.',
  };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ output, auditRows: rowCount,
    sequential: { p50: result.sequential.p50, p95: result.sequential.p95, max: result.sequential.max },
    concurrent10: { p50: result.concurrent10.p50, p95: result.concurrent10.p95, max: result.concurrent10.max, batchWallMs: result.concurrent10.batchWallMs },
  }, null, 2));
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
