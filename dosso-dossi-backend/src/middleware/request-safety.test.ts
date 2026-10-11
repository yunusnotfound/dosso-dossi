import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock('../lib/logger.js', () => ({ logger: logs }));

import { AppError } from '../lib/errors.js';
import { errorHandler } from './error-handler.js';
import { requestLogger } from './request-logger.js';

// This harness exercises the real middleware without importing the app,
// Prisma, authentication, payment providers, or any customer fixtures.
function app() {
  const server = express();
  server.use(requestLogger);
  server.use(express.json({ limit: '100kb' }));
  const router = express.Router();
  router.post('/customers/:phone', (_req, res) => res.json({ ok: true }));
  router.get('/failure', (_req, _res, next) => {
    const failure = new Error('Bearer private-secret; phone=5551112233');
    failure.name = 'private-secret';
    failure.stack = 'name@example.com request-body-private';
    next(failure);
  });
  server.use('/admin', router);
  server.use((_req, _res, next) => next(AppError.notFound()));
  server.use(errorHandler);
  return server;
}

function expectNoPrivateData() {
  const serialized = JSON.stringify([logs.info.mock.calls, logs.error.mock.calls]);
  for (const privateValue of ['5551112233', 'private-secret', 'name@example.com', 'request-body-private']) {
    expect(serialized).not.toContain(privateValue);
  }
}

describe('request parser and privacy-safe logging', () => {
  beforeEach(() => { logs.info.mockClear(); logs.error.mockClear(); });

  it('malformed JSON is a non-retryable 400, with no body echo in logs or response', async () => {
    const response = await request(app())
      .post('/admin/customers/5551112233?token=private-secret')
      .set('Content-Type', 'application/json')
      .send('{"email":"name@example.com",');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('name@example.com');
    expect(logs.error).not.toHaveBeenCalled();
    expect(logs.info.mock.calls[0]?.[1]).toMatchObject({ route: 'unmatched', status: 400 });
    expectNoPrivateData();
  });

  it('oversized JSON is 413 rather than an ambiguous server failure', async () => {
    const response = await request(app())
      .post('/admin/customers/5551112233')
      .send({ value: 'request-body-private'.repeat(8000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(logs.error).not.toHaveBeenCalled();
    expectNoPrivateData();
  });

  it('successful request logs only route templates, never path IDs, queries or credentials', async () => {
    const response = await request(app())
      .post('/admin/customers/5551112233?email=name@example.com&token=private-secret')
      .set('Authorization', 'Bearer private-secret')
      .set('Cookie', 'session=private-secret')
      .send({ email: 'name@example.com', note: 'request-body-private' });
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9]{8}$/);
    expect(logs.info.mock.calls[0]?.[1]).toMatchObject({
      requestId: response.headers['x-request-id'], method: 'POST',
      route: '/customers/:phone', status: 200,
    });
    expectNoPrivateData();
  });

  it('unknown routes do not leak the unmatched URL', async () => {
    const response = await request(app()).get('/5551112233/private-secret?email=name@example.com');
    expect(response.status).toBe(404);
    expect(logs.info.mock.calls[0]?.[1]).toMatchObject({ route: 'unmatched', status: 404 });
    expectNoPrivateData();
  });

  it('unexpected errors never log arbitrary names, messages or stack text', async () => {
    const response = await request(app()).get('/admin/failure?token=private-secret');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL');
    expect(logs.error).toHaveBeenCalledOnce();
    expect(logs.error.mock.calls[0]?.[1]).toMatchObject({
      requestId: response.headers['x-request-id'], errorType: 'UnknownError',
    });
    expectNoPrivateData();
  });
});
