import { createWebApp } from './web-app.js';
import { env } from './config/env.js';
import { disconnectWebPrisma, getWebPrisma } from './lib/web-prisma.js';
import { logger } from './lib/logger.js';

if (!env.WEB_ENABLED) throw new Error('Web API için WEB_ENABLED=true gerekli.');
const port = Number(process.env.WEB_PORT ?? '3000');
const host = process.env.WEB_HOST?.trim() || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WEB_PORT geçerli değil.');
if (!['true', 'false'].includes(process.env.WEB_ORDER_MAINTENANCE ?? 'false')) throw new Error('WEB_ORDER_MAINTENANCE true veya false olmalı.');

// Explicit opt-in; never starts mobile POS/payment sweeps or email dispatchers.
let stopMaintenance = () => {};
if (process.env.WEB_ORDER_MAINTENANCE === 'true') {
  const { startOrderMaintenance } = await import('./features/web/orders.service.js');
  stopMaintenance = startOrderMaintenance(getWebPrisma);
}
const server = createWebApp().listen(port, host, () => {
  logger.info('Web API dinliyor', { host, port, orderMaintenance: process.env.WEB_ORDER_MAINTENANCE === 'true' });
});
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopMaintenance();
  logger.info('Web API kapatılıyor', { signal });
  const force = setTimeout(() => { logger.error('Web API kapanış süresi aşıldı'); process.exit(1); }, 10_000);
  force.unref();
  server.close(async () => {
    try { await disconnectWebPrisma(); clearTimeout(force); process.exit(0); }
    catch { logger.error('Web DB bağlantısı kapatılamadı'); process.exit(1); }
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
