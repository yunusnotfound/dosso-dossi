import { getWebPrisma, disconnectWebPrisma } from '../src/lib/web-prisma.js';
import { dispatchOrderMessages } from '../src/features/web/order-messages.js';

// Defaults to a PII-free queue summary. Dispatch needs BOTH the flag and explicit environment opt-in.
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--dispatch')) throw new Error('Usage: tsx scripts/web-order-emails.ts [--dispatch]');
  const database = getWebPrisma();
  if (!args.includes('--dispatch')) {
    const counts = await database.webOrderMessage.groupBy({ by: ['status'], _count: { _all: true } });
    console.log(JSON.stringify({ deliveryEnabled: process.env.WEB_ORDER_EMAIL_ENABLED === 'true', counts }));
  } else {
    if (process.env.WEB_ORDER_EMAIL_ENABLED !== 'true') throw new Error('Order mail is disabled. Configure and explicitly enable WEB_ORDER_EMAIL_ENABLED before dispatch.');
    console.log(JSON.stringify(await dispatchOrderMessages(database)));
  }
} catch {
  console.error('Order email worker could not run. Check web DB readiness and explicit delivery configuration. No credentials are printed.');
  process.exitCode = 1;
} finally { await disconnectWebPrisma(); }
