import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { env } from '../config/env.js';
import { errorHandler } from './error-handler.js';
import { buildSignatureHeader, posAuth, signPayload } from './pos-auth.js';

function buildTestApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.post('/guvenli', posAuth('POS_WEBHOOK_SECRET'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('posAuth (HMAC imza)', () => {
  const app = buildTestApp();
  const body = JSON.stringify({ requestId: 'r1', amount: 100 });

  it('geçerli imza kabul edilir', async () => {
    const res = await request(app)
      .post('/guvenli')
      .set('Content-Type', 'application/json')
      .set('X-Dosso-Signature', buildSignatureHeader(env.POS_WEBHOOK_SECRET, body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('imzasız istek 401 INVALID_SIGNATURE döner', async () => {
    const res = await request(app)
      .post('/guvenli')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('yanlış sırla atılan imza reddedilir', async () => {
    const res = await request(app)
      .post('/guvenli')
      .set('Content-Type', 'application/json')
      .set('X-Dosso-Signature', buildSignatureHeader('yanlis-sir-1234567890', body))
      .send(body);
    expect(res.status).toBe(401);
  });

  it('gövdesi değiştirilmiş istek reddedilir', async () => {
    const header = buildSignatureHeader(env.POS_WEBHOOK_SECRET, body);
    const tampered = JSON.stringify({ requestId: 'r1', amount: 999999 });
    const res = await request(app)
      .post('/guvenli')
      .set('Content-Type', 'application/json')
      .set('X-Dosso-Signature', header)
      .send(tampered);
    expect(res.status).toBe(401);
  });

  it('5 dakikadan eski zaman damgası reddedilir (replay koruması)', async () => {
    const stale = Math.floor(Date.now() / 1000) - 600;
    const sig = signPayload(env.POS_WEBHOOK_SECRET, stale, body);
    const res = await request(app)
      .post('/guvenli')
      .set('Content-Type', 'application/json')
      .set('X-Dosso-Signature', `t=${stale},v1=${sig}`)
      .send(body);
    expect(res.status).toBe(401);
  });
});
