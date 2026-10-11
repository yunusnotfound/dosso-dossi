import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login } from '../../test/helpers.js';

const app = createApp();

describe('auth', () => {
  it('OTP gönderir ve kod kaydı oluşturur', async () => {
    const res = await request(app)
      .post('/auth/otp/send')
      .send({ phone: '05551112233' });
    expect(res.status).toBe(200);
    expect(await prisma.otpCode.count({ where: { phone: '5551112233' } })).toBe(1);
  });

  it('dev master kodu (111111) ile giriş yapar ve yeni kullanıcıyı kurar', async () => {
    const res = await request(app)
      .post('/auth/otp/verify')
      .send({ phone: '0555 111 22 33', code: '111111' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toEqual({ phone: '5551112233', name: '', email: '' });

    const user = await prisma.user.findUnique({
      where: { phone: '5551112233' },
      include: { wallet: true, loyalty: true, notificationPrefs: true },
    });
    expect(user?.wallet).toBeTruthy();
    expect(Number(user?.wallet?.balance)).toBe(0);
    expect(user?.loyalty?.stamps).toBe(0);
    expect(user?.notificationPrefs).toBeTruthy();
  });

  it('yanlış kod INVALID_OTP döner', async () => {
    const res = await request(app)
      .post('/auth/otp/verify')
      .send({ phone: '05551112233', code: '999999' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('geçersiz telefon VALIDATION_ERROR döner', async () => {
    const res = await request(app)
      .post('/auth/otp/send')
      .send({ phone: '12345678901' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('token ile PATCH /me çalışır, tokensiz 401 döner', async () => {
    const token = await login(app, '05551112233');
    const ok = await request(app)
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Yunus' });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Yunus');

    const noAuth = await request(app).patch('/me').send({ name: 'X' });
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('UNAUTHORIZED');
  });

  it('OTP gönderimi rate limitlenir (10 dakikada 3)', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/auth/otp/send')
        .send({ phone: '05551112233' });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app)
      .post('/auth/otp/send')
      .send({ phone: '05551112233' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
