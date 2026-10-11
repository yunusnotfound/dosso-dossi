import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { requireAdmin, scopeBranch } from '../../middleware/admin-auth.js';
import { login as customerLogin } from '../../test/helpers.js';
import { hashPassword } from './admin-auth.service.js';

const app = createApp();

const PASSWORD = 'cok-uzun-panel-sifresi';

async function makeAdmin(
  over: Partial<{
    email: string;
    role: 'SUPER_ADMIN' | 'MANAGER' | 'BRANCH_MANAGER' | 'VIEWER';
    branchId: string | null;
    isActive: boolean;
  }> = {},
) {
  return prisma.adminUser.create({
    data: {
      email: over.email ?? 'yonetici@dossodossi.com',
      name: 'Test Yönetici',
      passwordHash: await hashPassword(PASSWORD),
      role: over.role ?? 'SUPER_ADMIN',
      branchId: over.branchId ?? null,
      isActive: over.isActive ?? true,
    },
  });
}

async function adminToken(email = 'yonetici@dossodossi.com'): Promise<string> {
  const res = await request(app)
    .post('/admin/auth/login')
    .send({ email, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Admin girişi başarısız: ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

describe('admin auth', () => {
  it('doğru kimlikle giriş token + refresh + profil döner', async () => {
    await makeAdmin();
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yonetici@dossodossi.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.admin).toMatchObject({
      email: 'yonetici@dossodossi.com',
      role: 'SUPER_ADMIN',
    });
    // Şifre hiçbir biçimde yanıta sızmamalı
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const row = await prisma.adminUser.findUniqueOrThrow({
      where: { email: 'yonetici@dossodossi.com' },
    });
    expect(row.lastLoginAt).not.toBeNull();
    // Şifre düz metin saklanmaz
    expect(row.passwordHash).not.toContain(PASSWORD);
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('yanlış şifre ve olmayan hesap aynı hatayı verir (hesap varlığı sızmaz)', async () => {
    await makeAdmin();
    const wrong = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yonetici@dossodossi.com', password: 'yanlis-sifre-123' });
    const missing = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yok@dossodossi.com', password: PASSWORD });

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('pasif hesap giriş yapamaz', async () => {
    await makeAdmin({ isActive: false });
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yonetici@dossodossi.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('MÜŞTERİ token’ı panel ucuna giremez', async () => {
    await makeAdmin();
    const customer = await customerLogin(app, '05551112233');
    const res = await request(app)
      .get('/admin/auth/me')
      .set('Authorization', `Bearer ${customer}`);
    expect(res.status).toBe(401);
  });

  it('PANEL token’ı müşteri ucuna giremez', async () => {
    await makeAdmin();
    const token = await adminToken();
    const res = await request(app)
      .get('/me/wallet')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('refresh rotasyonu: eski token bir daha kullanılamaz', async () => {
    await makeAdmin();
    const first = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yonetici@dossodossi.com', password: PASSWORD });
    const oldRefresh = first.body.refreshToken as string;

    const rotated = await request(app)
      .post('/admin/auth/refresh')
      .send({ refreshToken: oldRefresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(oldRefresh);

    // Yeniden kullanım (çalıntı şüphesi) → tüm oturumlar düşer
    const reuse = await request(app)
      .post('/admin/auth/refresh')
      .send({ refreshToken: oldRefresh });
    expect(reuse.status).toBe(401);

    const fresh = await request(app)
      .post('/admin/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(fresh.status).toBe(401);
  });

  it('çıkış sonrası refresh token geçersizdir', async () => {
    await makeAdmin();
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yonetici@dossodossi.com', password: PASSWORD });
    await request(app)
      .post('/admin/auth/logout')
      .send({ refreshToken: res.body.refreshToken });

    const after = await request(app)
      .post('/admin/auth/refresh')
      .send({ refreshToken: res.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it('hesap pasifleştirilince eldeki access token da geçersizleşir', async () => {
    const admin = await makeAdmin();
    const token = await adminToken();
    expect((await request(app).get('/admin/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { isActive: false },
    });
    const res = await request(app)
      .get('/admin/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('şifre değişince tüm oturumlar düşer', async () => {
    await makeAdmin();
    const session = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'yonetici@dossodossi.com', password: PASSWORD });

    const changed = await request(app)
      .post('/admin/auth/password')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'yepyeni-panel-sifresi' });
    expect(changed.status).toBe(200);

    const after = await request(app)
      .post('/admin/auth/refresh')
      .send({ refreshToken: session.body.refreshToken });
    expect(after.status).toBe(401);
  });
});

describe('admin RBAC', () => {
  /// Rol koruması gerçek bir uçta sınanır (pos-auth.test.ts deseni).
  function roleApp() {
    const a = express();
    a.get('/yalniz-super', requireAdmin('SUPER_ADMIN'), (_req, res) => {
      res.json({ ok: true });
    });
    a.use(errorHandler);
    return a;
  }

  it('yetkisiz rol 403 FORBIDDEN alır, yetkili geçer', async () => {
    await makeAdmin({ email: 'viewer@dossodossi.com', role: 'VIEWER' });
    await makeAdmin({ email: 'super@dossodossi.com', role: 'SUPER_ADMIN' });

    const viewer = await adminToken('viewer@dossodossi.com');
    const superToken = await adminToken('super@dossodossi.com');

    const denied = await request(roleApp())
      .get('/yalniz-super')
      .set('Authorization', `Bearer ${viewer}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const allowed = await request(roleApp())
      .get('/yalniz-super')
      .set('Authorization', `Bearer ${superToken}`);
    expect(allowed.status).toBe(200);
  });

  it('scopeBranch: şube müdürü kendi şubesine kilitlenir', () => {
    const bm = {
      id: 'a1',
      email: 'bm@x.com',
      role: 'BRANCH_MANAGER' as const,
      branchId: 'beylikduzu-vadi-loca',
    };
    // İstek şubesiz gelirse kendi şubesi uygulanır
    expect(scopeBranch(bm)).toBe('beylikduzu-vadi-loca');
    // Kendi şubesini isterse geçer
    expect(scopeBranch(bm, 'beylikduzu-vadi-loca')).toBe('beylikduzu-vadi-loca');
    // Başka şubeyi isterse reddedilir
    expect(() => scopeBranch(bm, 'baska-sube')).toThrowError(/yetkiniz yok/);
    // Şubesi atanmamışsa hiç veri göremez
    expect(() =>
      scopeBranch({ ...bm, branchId: null }),
    ).toThrowError(/şube atanmamış/);

    // Diğer roller serbest: istenen şube neyse o
    const manager = { ...bm, role: 'MANAGER' as const, branchId: null };
    expect(scopeBranch(manager)).toBeUndefined();
    expect(scopeBranch(manager, 'baska-sube')).toBe('baska-sube');
  });
});

describe('admin CORS', () => {
  it('allowlist’teki origin’e izin verilir, dışındakine verilmez', async () => {
    const allowed = await request(app)
      .options('/admin/auth/login')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(allowed.headers['vary']).toContain('Origin');

    const blocked = await request(app)
      .options('/admin/auth/login')
      .set('Origin', 'https://kotu-site.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('müşteri uçlarında CORS başlığı yoktur', async () => {
    const res = await request(app)
      .get('/branches')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
