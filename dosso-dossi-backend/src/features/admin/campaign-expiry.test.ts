import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signAdminToken } from '../../middleware/admin-auth.js';
import { hashPassword } from './admin-auth.service.js';

const app = createApp();
async function token() {
  const admin = await prisma.adminUser.create({ data: { email: 'promo-expiry@test.invalid', passwordHash: await hashPassword('audit-password-123'), role: 'SUPER_ADMIN' } });
  return signAdminToken(admin.id);
}

describe('Promo expiry edit intent', () => {
  it('preserves an expired date when omitted and removes it only on explicit null', async () => {
    const authorization = await token();
    const expiresAt = '2020-01-01T10:00:00.000Z';
    await prisma.promoCode.create({ data: { code: 'EXPIRY', discountRate: 0.1, expiresAt: new Date(expiresAt), isActive: true } });
    const update = await request(app).post('/admin/promos').auth(authorization, { type: 'bearer' }).send({ code: 'EXPIRY', discountRate: 0.2, isActive: true });
    expect(update.status).toBe(200);
    expect(update.body.expiresAt).toBe(expiresAt);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { code: 'EXPIRY' } })).expiresAt?.toISOString()).toBe(expiresAt);
    const clear = await request(app).post('/admin/promos').auth(authorization, { type: 'bearer' }).send({ code: 'EXPIRY', discountRate: 0.2, isActive: true, expiresAt: null });
    expect(clear.status).toBe(200);
    expect(clear.body.expiresAt).toBeNull();
  });

  it('creates an undated promo and can explicitly set its expiry', async () => {
    const authorization = await token();
    const create = await request(app).post('/admin/promos').auth(authorization, { type: 'bearer' }).send({ code: 'NEWDATE', discountRate: 0.1, isActive: true });
    expect(create.status).toBe(200);
    expect(create.body.expiresAt).toBeNull();
    const expiresAt = '2030-01-01T10:00:00.000Z';
    const dated = await request(app).post('/admin/promos').auth(authorization, { type: 'bearer' }).send({ code: 'NEWDATE', discountRate: 0.1, isActive: true, expiresAt });
    expect(dated.status).toBe(200);
    expect(dated.body.expiresAt).toBe(expiresAt);
  });
});
