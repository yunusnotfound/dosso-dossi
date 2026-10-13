import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startForwardSweep } from './features/orders/pos-client.js';
import { startPaymentSweep } from './features/wallet/payments/topup.service.js';

const app = createApp();
const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`Dosso Dossi API dinliyor: http://${env.HOST}:${env.PORT}`);
});

startForwardSweep();
const stopPaymentSweep = startPaymentSweep();

/// Kapanışta yeni istek alınmaz, süren istekler bitirilir, DB bağlantıları
/// kapatılır. 10 sn içinde bitmezse zorla çıkılır (deploy sırasında
/// para hareketi olan bir isteğin yarıda kesilmemesi için).
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopPaymentSweep();
  logger.info(`${signal} alındı, sunucu kapatılıyor...`);
  const force = setTimeout(() => {
    logger.error('Kapanış 10 sn içinde bitmedi, zorla çıkılıyor');
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Kapanış tamamlandı');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
