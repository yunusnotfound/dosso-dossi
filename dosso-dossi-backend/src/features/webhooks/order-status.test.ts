import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { buildSignatureHeader } from '../../middleware/pos-auth.js';
import { login } from '../../test/helpers.js';

const app = createApp();
const PHONE = '05551112233';

function statusEvent(
  orderId: string,
  status: string,
  eventId = `ev-${status}`,
) {
  const raw = JSON.stringify({ eventId, orderId, status });
  return request(app)
    .post('/webhooks/kerzz/order-status')
    .set('Content-Type', 'application/json')
    .set('X-Dosso-Signature', buildSignatureHeader(env.POS_WEBHOOK_SECRET, raw))
    .send(raw);
}

/// Sipariş verip DD numarasını döner.
async function placeTestOrder() {
  const token = await login(app, PHONE);
  const auth = ['Authorization', `Bearer ${token}`] as const;
  await request(app).post('/me/wallet/topup').set(...auth).send({ amount: 500 });
  const order = await request(app)
    .post('/orders')
    .set(...auth)
    .send({
      branchId: 'beylikduzu-vadi-loca',
      pickupSlot: '12:30',
      items: [{ productId: 'caffe-latte', quantity: 1 }],
      payment: { method: 'dosso_card' },
    });
  return { token, orderId: order.body.id as string };
}

describe('sipariş durumu döngüsü', () => {
  it('RECEIVED → PREPARING → READY ilerler; GET /orders/:id yeni durumu döner', async () => {
    const { token, orderId } = await placeTestOrder();

    expect((await statusEvent(orderId, 'preparing')).body.status).toBe('preparing');
    expect((await statusEvent(orderId, 'ready')).body.status).toBe('ready');

    const res = await request(app)
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('aynı eventId tekrar gelirse saklanan yanıt döner', async () => {
    const { orderId } = await placeTestOrder();
    const first = await statusEvent(orderId, 'preparing', 'ev-x');
    const replay = await statusEvent(orderId, 'preparing', 'ev-x');
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
  });

  it('geç gelen eski durum sessizce atlanır (READY sonrası PREPARING)', async () => {
    const { orderId } = await placeTestOrder();
    await statusEvent(orderId, 'ready');
    const stale = await statusEvent(orderId, 'preparing', 'ev-gec');
    expect(stale.status).toBe(200);
    expect(stale.body.skipped).toBe('stale_transition');
  });

  it('geçersiz ileri sıçrama 409 INVALID_STATUS_TRANSITION döner', async () => {
    const { orderId } = await placeTestOrder();
    // RECEIVED → COMPLETED tabloda yok (READY şart)
    const res = await statusEvent(orderId, 'completed');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('bilinmeyen sipariş 404 döner', async () => {
    await placeTestOrder();
    const res = await statusEvent('DD-99999', 'preparing');
    expect(res.status).toBe(404);
  });

  it('GET /orders/:id başkasının siparişine 404 döner', async () => {
    const { orderId } = await placeTestOrder();
    const otherToken = await login(app, '05559998877');
    const res = await request(app)
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
