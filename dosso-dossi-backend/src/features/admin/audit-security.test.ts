import { createHash, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from './admin-auth.service.js';
import { revokeSessions } from './customers.service.js';
import { createQrToken } from '../wallet/wallet.service.js';
import { chargeQrCode } from '../pos/pos.service.js';

const app = createApp();
const password = 'audit-original-password';
const phone = '5552223344';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
async function customerSession() {
  const response = await request(app).post('/auth/otp/verify').send({ phone, code: '111111' });
  expect(response.status).toBe(200);
  return response.body as { token: string; refreshToken: string };
}
async function adminSession() {
  await prisma.adminUser.upsert({
    where: { email: 'audit-admin@test.invalid' }, update: {},
    create: { email: 'audit-admin@test.invalid', role: 'SUPER_ADMIN', passwordHash: await hashPassword(password) },
  });
  const response = await request(app).post('/admin/auth/login').send({ email: 'audit-admin@test.invalid', password });
  expect(response.status).toBe(200);
  return response.body as { token: string; refreshToken: string; admin: { id: string } };
}
const get = (path: string, token: string) => request(app).get(path).auth(token, { type: 'bearer' });
const post = (path: string, token: string, body: object) => request(app).post(path).auth(token, { type: 'bearer' }).send(body);

describe('Panel financial request receipts', () => {
  it('requires an intent key and deduplicates concurrent/lost-response balance retries', async () => {
    const admin = await adminSession();
    await customerSession();
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    const path = `/admin/customers/${user.id}/balance`;
    expect((await post(path, admin.token, { amount: 100, reason: 'Operator correction' })).status).toBe(400);
    const body = { amount: 100, reason: 'Operator correction', idempotencyKey: randomUUID() };
    const results = await Promise.all(Array.from({ length: 6 }, () => post(path, admin.token, body)));
    expect(results.map((result) => result.status)).toEqual(Array(6).fill(200));
    expect(results.every((result) => result.body.balance === 100)).toBe(true);
    expect((await post(path, admin.token, body)).body.balance).toBe(100);
    expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balance)).toBe(100);
    expect(await prisma.walletTransaction.count({ where: { type: 'ADJUSTMENT' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'wallet.adjust' } })).toBe(1);
    expect(await prisma.adminMutationRequest.count()).toBe(1);
    const conflict = await post(path, admin.token, { ...body, amount: 200 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('rolls the receipt back with a failed adjustment, so the same intent can be retried', async () => {
    const admin = await adminSession();
    await customerSession();
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    const path = `/admin/customers/${user.id}/balance`;
    const body = { amount: -100, reason: 'Reverse mistaken credit', idempotencyKey: randomUUID() };
    expect((await post(path, admin.token, body)).body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(await prisma.adminMutationRequest.count()).toBe(0);
    await post(path, admin.token, { amount: 100, reason: 'Initial correction', idempotencyKey: randomUUID() });
    const retried = await post(path, admin.token, body);
    expect(retried.status).toBe(200);
    expect(retried.body.balance).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(2);
  });

  it('applies a repeated percentage update once and returns its original receipt', async () => {
    const admin = await adminSession();
    const body = { categoryId: 'sicak-kahveler', percent: 10, reason: 'Annual prices', idempotencyKey: randomUUID() };
    const results = await Promise.all(Array.from({ length: 4 }, () => post('/admin/menu/bulk-price', admin.token, body)));
    expect(results.map((result) => result.status)).toEqual(Array(4).fill(200));
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: 'caffe-latte' } })).price)).toBe(209);
    expect(await prisma.auditLog.count({ where: { action: 'product.bulkPrice' } })).toBe(1);
    await post('/admin/menu/bulk-price', admin.token, { ...body, idempotencyKey: randomUUID() });
    expect((await post('/admin/menu/bulk-price', admin.token, body)).body).toEqual(results[0]!.body);
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: 'caffe-latte' } })).price)).toBe(229.9);
    expect((await post('/admin/menu/bulk-price', admin.token, { ...body, percent: 20 })).status).toBe(409);
  });

  it('serializes separate concurrent percentage intentions without losing either update', async () => {
    const admin = await adminSession();
    const results = await Promise.all(Array.from({ length: 2 }, () => post('/admin/menu/bulk-price', admin.token, {
      percent: 10, reason: 'Independent price update', idempotencyKey: randomUUID(),
    })));
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: 'caffe-latte' } })).price)).toBe(229.9);
  });
});

describe('Bounded refresh replay incidents', () => {
  for (const kind of ['customer', 'admin'] as const) {
    const prefix = kind === 'customer' ? '/auth' : '/admin/auth';
    const protectedPath = kind === 'customer' ? '/me/wallet' : '/admin/auth/me';
    const session = kind === 'customer' ? customerSession : adminSession;

    it(`${kind}: reuse kills the affected family including access, while new logins survive repeat incidents`, async () => {
      const first = await session();
      const independent = await session();
      const rotated = await request(app).post(`${prefix}/refresh`).send({ refreshToken: first.refreshToken });
      expect(rotated.status).toBe(200);
      expect((await request(app).post(`${prefix}/refresh`).send({ refreshToken: first.refreshToken })).status).toBe(401);
      expect((await get(protectedPath, rotated.body.token)).status).toBe(401);
      expect((await get(protectedPath, first.token)).status).toBe(401);
      expect((await get(protectedPath, independent.token)).status).toBe(200);
      const later = await session();
      for (let i = 0; i < 3; i++) {
        expect((await request(app).post(`${prefix}/refresh`).send({ refreshToken: first.refreshToken })).status).toBe(401);
      }
      expect((await get(protectedPath, later.token)).status).toBe(200);
      expect((await get(protectedPath, independent.token)).status).toBe(200);
      const row = kind === 'customer' ? await prisma.user.findUniqueOrThrow({ where: { phone } })
        : await prisma.adminUser.findUniqueOrThrow({ where: { email: 'audit-admin@test.invalid' } });
      expect(row.tokenVersion).toBe(0);
    });

    it(`${kind}: expired revoked tokens cannot cause new revocation side effects`, async () => {
      const first = await session();
      const rotated = await request(app).post(`${prefix}/refresh`).send({ refreshToken: first.refreshToken });
      expect(rotated.status).toBe(200);
      const where = { tokenHash: sha(first.refreshToken) };
      const data = { expiresAt: new Date('2020-01-01') };
      if (kind === 'customer') await prisma.refreshToken.update({ where, data });
      else await prisma.adminRefreshToken.update({ where, data });
      for (let i = 0; i < 2; i++) {
        expect((await request(app).post(`${prefix}/refresh`).send({ refreshToken: first.refreshToken })).status).toBe(401);
      }
      expect((await get(protectedPath, rotated.body.token)).status).toBe(200);
      expect((await request(app).post(`${prefix}/refresh`).send({ refreshToken: rotated.body.refreshToken })).status).toBe(200);
    });

    it(`${kind}: logout closes its family access and leaves a separate login active`, async () => {
      const first = await session();
      const other = await session();
      expect((await request(app).post(`${prefix}/logout`).send({ refreshToken: first.refreshToken })).status).toBe(200);
      expect((await get(protectedPath, first.token)).status).toBe(401);
      expect((await get(protectedPath, other.token)).status).toBe(200);
    });
  }
});

describe('Revocation closes QR credentials', () => {
  it('rejects a QR that crosses the expiry grace boundary while awaiting the user lock', async () => {
    await customerSession();
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    await prisma.wallet.update({ where: { userId: user.id }, data: { balance: 100 } });
    const qr = await createQrToken(user.id);
    const graceEnd = new Date(qr.expiresAt).getTime() + 15_000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(graceEnd - 1);
    try {
      await expect(prisma.$transaction(async (tx) => {
        const queryRaw = tx.$queryRaw.bind(tx);
        // Do not spy on Prisma's transaction proxy: replacing its method may
        // mutate the shared client and leave later tests bound to this tx.
        const delayedLock = new Proxy(tx, {
          get(target, property) {
            if (property === '$queryRaw') {
              return (...args: Parameters<typeof queryRaw>) => queryRaw(...args).then((result) => {
                clock.mockReturnValue(graceEnd + 1);
                return result;
              });
            }
            return Reflect.get(target, property);
          },
        });
        return chargeQrCode(delayedLock, {
          branchId: 'beylikduzu-vadi-loca', requestId: 'expired-while-waiting', code: qr.code, amount: 1,
        });
      })).rejects.toMatchObject({ code: 'INVALID_QR' });
    } finally {
      clock.mockRestore();
    }
    expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balance)).toBe(100);
    expect(await prisma.posCharge.count()).toBe(0);
    expect((await prisma.qrToken.findUniqueOrThrow({ where: { code: qr.code } })).consumedAt).toBeNull();
  });

  it('cancels the current QR and rejects creation using an authorization snapshot taken before revoke', async () => {
    const admin = await adminSession();
    const session = await customerSession();
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    const family = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha(session.refreshToken) } });
    const qr = await createQrToken(user.id, { tokenVersion: user.tokenVersion, familyId: family.familyId });
    const req = { admin: { id: admin.admin.id }, ip: '127.0.0.1' } as Request;
    await revokeSessions(req, user.id, 'Lost phone');
    await expect(prisma.$transaction((tx) => chargeQrCode(tx, {
      branchId: 'beylikduzu-vadi-loca', requestId: 'old-qr-after-revoke', code: qr.code, amount: 1,
    }))).rejects.toMatchObject({ code: 'INVALID_QR' });
    await expect(createQrToken(user.id, { tokenVersion: user.tokenVersion, familyId: family.familyId }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(await prisma.qrToken.count({ where: { userId: user.id, consumedAt: null } })).toBe(0);
    expect(await prisma.posCharge.count()).toBe(0);
    const fresh = await customerSession();
    expect((await post('/me/wallet/qr-token', fresh.token, {})).status).toBe(200);
  });

  it('a concurrent QR issue and revoke leave no usable code from the old session', async () => {
    const admin = await adminSession();
    await customerSession();
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    const req = { admin: { id: admin.admin.id }, ip: '127.0.0.1' } as Request;
    const results = await Promise.allSettled([
      createQrToken(user.id, { tokenVersion: user.tokenVersion }),
      revokeSessions(req, user.id, 'Concurrent revocation'),
    ]);
    expect(results[1]!.status).toBe('fulfilled');
    expect(await prisma.qrToken.count({ where: { userId: user.id, consumedAt: null } })).toBe(0);
  });
});

describe('Temporary administrator credentials', () => {
  async function temporaryAdmin() {
    const owner = await adminSession();
    const created = await post('/admin/admins', owner.token, { email: 'temporary@test.invalid', name: 'Temporary', role: 'MANAGER' });
    expect(created.status).toBe(200);
    const response = await request(app).post('/admin/auth/login').send({ email: 'temporary@test.invalid', password: created.body.tempPassword });
    expect(response.status).toBe(200);
    return { owner, created: created.body, session: response.body };
  }

  it('only permits identity/password access until a different permanent password is set', async () => {
    const { created, session } = await temporaryAdmin();
    expect(session.admin.mustChangePassword).toBe(true);
    expect(new Date(created.tempPasswordExpiresAt).getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60_000);
    expect((await get('/admin/auth/me', session.token)).body.mustChangePassword).toBe(true);
    const blocked = await get('/admin/dashboard', session.token);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await post('/admin/auth/password', session.token, { currentPassword: created.tempPassword, newPassword: created.tempPassword })).status).toBe(400);
    const changed = await post('/admin/auth/password', session.token, { currentPassword: created.tempPassword, newPassword: 'permanent-admin-password' });
    expect(changed.status).toBe(200);
    expect((await get('/admin/auth/me', session.token)).status).toBe(401);
    const signedIn = await request(app).post('/admin/auth/login').send({ email: 'temporary@test.invalid', password: 'permanent-admin-password' });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.admin).toMatchObject({ mustChangePassword: false, tempPasswordExpiresAt: null });
    expect((await get('/admin/dashboard', signedIn.body.token)).status).toBe(200);
  });

  it('expires temporary credentials for login, refresh and already issued access tokens', async () => {
    const { created, session } = await temporaryAdmin();
    await prisma.adminUser.update({ where: { id: created.id }, data: { tempPasswordExpiresAt: new Date(Date.now() - 1000) } });
    const login = await request(app).post('/admin/auth/login').send({ email: 'temporary@test.invalid', password: created.tempPassword });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('TEMP_PASSWORD_EXPIRED');
    expect((await get('/admin/auth/me', session.token)).body.error.code).toBe('TEMP_PASSWORD_EXPIRED');
    expect((await request(app).post('/admin/auth/refresh').send({ refreshToken: session.refreshToken })).body.error.code).toBe('TEMP_PASSWORD_EXPIRED');
  });

  it('password reset revokes current sessions and starts a new restricted 24-hour credential', async () => {
    const { owner, created, session } = await temporaryAdmin();
    const reset = await post(`/admin/admins/${created.id}/reset-password`, owner.token, {});
    expect(reset.status).toBe(200);
    expect(reset.body.tempPassword).not.toBe(created.tempPassword);
    expect((await get('/admin/auth/me', session.token)).status).toBe(401);
    const login = await request(app).post('/admin/auth/login').send({ email: 'temporary@test.invalid', password: reset.body.tempPassword });
    expect(login.status).toBe(200);
    expect(login.body.admin.mustChangePassword).toBe(true);
    expect((await get('/admin/customers', login.body.token)).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
