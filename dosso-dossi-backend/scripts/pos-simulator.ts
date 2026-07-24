/// Kerzz POS köprüsü simülatörü — gerçek POS olmadan tüm döngüyü sürer.
/// Kullanım (backend klasöründen, sunucu açıkken):
///   npm run pos:sim -- charge --code DDPAY-xxx --amount 185.5
///   npm run pos:sim -- void --charge-id <id>
///   npm run pos:sim -- sale --charge-id <id> --items "caffe-latte:2,cheesecake:1"
///   npm run pos:sim -- order-status --order DD-1043 --status ready
///   npm run pos:sim -- pay-confirm --payment-id <intentId> --status succeeded
/// Aynı --request-id/--sale-id ile tekrar çağırıp idempotency'yi canlı görebilirsiniz.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { parseArgs } from 'node:util';

if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}
const { buildSignatureHeader } = await import('../src/middleware/pos-auth.js');

const BASE = process.env['POS_SIM_BASE_URL'] ?? 'http://localhost:3000';
const POS_SECRET = process.env['POS_WEBHOOK_SECRET'] ?? 'dev-pos-secret-degistir';
const PAY_SECRET =
  process.env['PAYMENT_WEBHOOK_SECRET'] ?? 'dev-payment-secret-degistir';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    code: { type: 'string' },
    amount: { type: 'string' },
    branch: { type: 'string', default: 'beylikduzu-vadi-loca' },
    'charge-id': { type: 'string' },
    'qr-code': { type: 'string' },
    items: { type: 'string' },
    'sale-id': { type: 'string' },
    order: { type: 'string' },
    status: { type: 'string' },
    'payment-id': { type: 'string' },
    'request-id': { type: 'string' },
  },
});

async function send(path: string, body: Record<string, unknown>, secret: string) {
  const raw = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dosso-Signature': buildSignatureHeader(secret, raw),
    },
    body: raw,
  });
  console.log(`→ POST ${path}`);
  console.log(`  ${raw}`);
  console.log(`← ${res.status}`);
  console.log(`  ${JSON.stringify(await res.json(), null, 2).replace(/\n/g, '\n  ')}`);
}

function need(name: keyof typeof values): string {
  const v = values[name];
  if (!v) {
    console.error(`--${name} gerekli`);
    process.exit(1);
  }
  return v;
}

const command = positionals[0];
const requestId = values['request-id'] ?? `sim-${randomUUID().slice(0, 8)}`;

switch (command) {
  case 'charge':
    await send(
      '/pos/charge',
      {
        requestId,
        branchId: values.branch,
        code: need('code'),
        amount: Number(need('amount')),
      },
      POS_SECRET,
    );
    break;

  case 'void':
    await send(
      `/pos/charge/${need('charge-id')}/void`,
      { requestId },
      POS_SECRET,
    );
    break;

  case 'sale': {
    // "caffe-latte:2,mug-konik:1" → items dizisi
    const items = need('items')
      .split(',')
      .map((part) => {
        const [productId, qty] = part.trim().split(':');
        return { productId: productId!, quantity: Number(qty ?? 1) };
      });
    await send(
      '/webhooks/kerzz/sale',
      {
        saleId: values['sale-id'] ?? `sim-sale-${randomUUID().slice(0, 8)}`,
        branchId: values.branch,
        customer: {
          chargeId: values['charge-id'],
          qrCode: values['qr-code'],
        },
        items,
      },
      POS_SECRET,
    );
    break;
  }

  case 'order-status':
    await send(
      '/webhooks/kerzz/order-status',
      {
        eventId: requestId,
        orderId: need('order'),
        status: need('status'),
      },
      POS_SECRET,
    );
    break;

  case 'pay-confirm':
    await send(
      '/webhooks/payment/confirmation',
      {
        paymentId: need('payment-id'),
        status: values.status ?? 'succeeded',
      },
      PAY_SECRET,
    );
    break;

  default:
    console.log(
      'Komutlar: charge | void | sale | order-status | pay-confirm\n' +
        'Örnek: npm run pos:sim -- charge --code DDPAY-xxx --amount 185.5',
    );
    process.exit(1);
}
