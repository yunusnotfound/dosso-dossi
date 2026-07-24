import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const app = createApp();

async function loginPair() {
  const res = await request(app)
    .post('/auth/otp/verify')
    .send({ phone: '05551112233', code: '111111' });
  return {
    token: res.body.token as string,
    refreshToken: res.body.refreshToken as string,
  };
}

describe('refresh token', () => {
  it('verify access + refresh çifti döner', async () => {
    const { token, refreshToken } = await loginPair();
    expect(token).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(await prisma.refreshToken.count()).toBe(1);
  });

  it('refresh rotasyonu: yeni çift gelir, eski refresh artık geçersizdir', async () => {
    const { refreshToken } = await loginPair();
    const rotated = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.token).toBeTruthy();
    expect(rotated.body.refreshToken).not.toBe(refreshToken);

    // Yeni access token çalışır
    const me = await request(app)
      .get('/me/wallet')
      .set('Authorization', `Bearer ${rotated.body.token}`);
    expect(me.status).toBe(200);
  });

  it('reuse tespiti: iptal edilmiş token kullanılırsa TÜM oturumlar iptal edilir', async () => {
    const { refreshToken } = await loginPair();
    const rotated = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    // Eski (rotasyonla iptal edilmiş) token yeniden kullanılıyor → saldırı şüphesi
    const reuse = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    expect(reuse.status).toBe(401);

    // Zincirdeki YENİ token da artık geçersiz olmalı
    const chained = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(chained.status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('logout refresh token\'ı iptal eder', async () => {
    const { refreshToken } = await loginPair();
    const out = await request(app).post('/auth/logout').send({ refreshToken });
    expect(out.status).toBe(200);

    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('süresi dolmuş refresh token reddedilir', async () => {
    const { refreshToken } = await loginPair();
    await prisma.refreshToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('bilinmeyen refresh token 401 döner', async () => {
    await loginPair();
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'gecersiz-token' });
    expect(res.status).toBe(401);
  });
});
