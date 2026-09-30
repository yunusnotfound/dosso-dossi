import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signAdminToken } from '../../middleware/admin-auth.js';
import { login as customerLogin } from '../../test/helpers.js';
import { invalidateSettingsCache } from '../settings/settings.service.js';

const app = createApp();
const domains = ['menu', 'branches', 'campaigns', 'loyalty', 'wallet', 'orders'] as const;
type Domain = (typeof domains)[number];
type Revisions = Record<Domain, string>;

async function revisions(): Promise<Revisions> {
  // Intentionally anonymous: the response must be safe before customer login.
  const res = await request(app).get('/sync/revisions');
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  expect(Object.keys(res.body).sort()).toEqual([...domains].sort());
  for (const value of Object.values(res.body)) {
    expect(value).toMatch(/^[a-f0-9]{64}$/);
  }
  return res.body as Revisions;
}

function expectChangedOnly(before: Revisions, after: Revisions, changed: Domain[]) {
  for (const domain of domains) {
    if (changed.includes(domain)) {
      expect(after[domain], `${domain} should change`).not.toBe(before[domain]);
    } else {
      expect(after[domain], `${domain} should remain stable`).toBe(before[domain]);
    }
  }
}

describe('GET /sync/revisions', () => {
  let adminId: string;
  let token: string;

  beforeEach(async () => {
    invalidateSettingsCache();
    const admin = await prisma.adminUser.create({
      data: {
        email: 'sync-tests@dossodossi.com',
        passwordHash: 'unused-in-sync-tests',
        role: 'SUPER_ADMIN',
      },
    });
    adminId = admin.id;
    token = signAdminToken(adminId);
  });

  it('returns only six opaque revisions, stable across repeated reads and app instances', async () => {
    await prisma.auditLog.create({
      data: {
        adminId,
        entity: 'Wallet',
        entityId: 'private-wallet-id',
        action: 'wallet.adjust',
        before: { balance: 25, phone: '5551112233' },
        after: { balance: 75 },
        reason: 'Private adjustment reason',
        ip: '192.0.2.23',
      },
    });

    const first = await revisions();
    expect(await revisions()).toEqual(first);
    const anotherInstance = await request(createApp()).get('/sync/revisions');
    expect(anotherInstance.status).toBe(200);
    expect(anotherInstance.body).toEqual(first);
    // Exact keys and hex-only values above exclude audit payloads and identifiers.
  });

  it('a saved product rename changes only menu and is immediately public', async () => {
    const before = await revisions();
    const saved = await request(app)
      .post('/admin/menu/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'caffe-latte',
        name: 'Yeni Caffe Latte',
        price: 190,
        categoryId: 'sicak-kahveler',
        stampMultiplier: 1,
        hasOptions: true,
      });
    expect(saved.status).toBe(200);
    expectChangedOnly(before, await revisions(), ['menu']);

    const products = await request(app).get('/menu/products');
    expect(products.status).toBe(200);
    expect(products.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'caffe-latte', name: 'Yeni Caffe Latte' }),
      ]),
    );
  });

  it('closing a branch changes only branches and its public open state', async () => {
    const before = await revisions();
    const saved = await request(app)
      .post('/admin/branches/beylikduzu-vadi-loca/open')
      .set('Authorization', `Bearer ${token}`)
      .send({ isOpen: false });
    expect(saved.status).toBe(200);
    expectChangedOnly(before, await revisions(), ['branches']);

    const branches = await request(app).get('/branches');
    expect(branches.status).toBe(200);
    expect(branches.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'beylikduzu-vadi-loca', isOpen: false }),
      ]),
    );
  });

  it('branch product availability changes both menu and branches', async () => {
    const before = await revisions();
    const saved = await request(app)
      .post('/admin/branches/beylikduzu-vadi-loca/availability/caffe-latte')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: false, priceOverride: 210 });
    expect(saved.status).toBe(200);
    expectChangedOnly(before, await revisions(), ['menu', 'branches']);
  });

  it('campaign creation and deletion each produce a new campaign revision', async () => {
    const before = await revisions();
    const created = await request(app)
      .post('/admin/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 'sync-campaign', title: 'Yeni kampanya', style: 'orange' });
    expect(created.status).toBe(200);
    const afterCreate = await revisions();
    expectChangedOnly(before, afterCreate, ['campaigns']);
    const visible = await request(app).get('/campaigns');
    expect(visible.status).toBe(200);
    expect(visible.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'sync-campaign' })]),
    );

    const deleted = await request(app)
      .delete('/admin/campaigns/sync-campaign')
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    const afterDelete = await revisions();
    expectChangedOnly(afterCreate, afterDelete, ['campaigns']);
    expect(afterDelete.campaigns).not.toBe(before.campaigns);
    const removed = await request(app).get('/campaigns');
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual([]);
  });

  it('a loyalty setting change refreshes campaigns and loyalty only', async () => {
    const before = await revisions();
    const saved = await request(app)
      .post('/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'loyalty.topUpBonusThreshold', value: 500 });
    expect(saved.status).toBe(200);
    expectChangedOnly(before, await revisions(), ['campaigns', 'loyalty']);
  });

  it('customer wallet and loyalty corrections invalidate their own domains', async () => {
    const customer = await customerLogin(app, '05551112233');
    const user = await prisma.user.findFirstOrThrow();
    const before = await revisions();
    const balance = await request(app)
      .post(`/admin/customers/${user.id}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, reason: 'Test bakiye düzeltmesi' });
    expect(balance.status).toBe(200);
    const afterBalance = await revisions();
    expectChangedOnly(before, afterBalance, ['wallet']);
    const wallet = await request(app)
      .get('/me/wallet')
      .set('Authorization', `Bearer ${customer}`);
    expect(wallet.status).toBe(200);
    expect(wallet.body.balance).toBe(100);

    const loyalty = await request(app)
      .post(`/admin/customers/${user.id}/loyalty`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stamps: 2, freeDrinks: 1, reason: 'Test sadakat düzeltmesi' });
    expect(loyalty.status).toBe(200);
    expectChangedOnly(afterBalance, await revisions(), ['loyalty']);
    const account = await request(app)
      .get('/me/loyalty')
      .set('Authorization', `Bearer ${customer}`);
    expect(account.status).toBe(200);
    expect(account.body).toMatchObject({ stamps: 2, freeDrinks: 1 });
  });

  it('a rolled-back product write and its audit never change revisions', async () => {
    const before = await revisions();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: 'caffe-latte' },
          data: { name: 'Uncommitted rename' },
        });
        await tx.auditLog.create({
          data: {
            adminId,
            entity: 'Product',
            entityId: 'caffe-latte',
            action: 'product.update',
          },
        });
        throw new Error('Intentional rollback');
      }),
    ).rejects.toThrow('Intentional rollback');

    expect(await revisions()).toEqual(before);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: 'caffe-latte' } });
    expect(product.name).toBe('Caffe Latte');
    expect(await prisma.auditLog.count({ where: { entity: 'Product' } })).toBe(0);
  });

  it('unauthorized, invalid and rejected transactional writes leave revisions unchanged', async () => {
    await customerLogin(app, '05551112233');
    const user = await prisma.user.findFirstOrThrow();
    const before = await revisions();
    const unauthorized = await request(app)
      .post('/admin/branches/beylikduzu-vadi-loca/open')
      .send({ isOpen: false });
    expect(unauthorized.status).toBe(401);
    const invalid = await request(app)
      .post('/admin/menu/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 'caffe-latte', name: '', price: -1, categoryId: 'sicak-kahveler' });
    expect(invalid.status).toBe(400);
    const rejected = await request(app)
      .post(`/admin/customers/${user.id}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -100, reason: 'Test geçersiz bakiye düzeltmesi' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(await revisions()).toEqual(before);
  });

  it.each<{ entity: string; action: string; changed: Domain[] }>([
    { entity: 'Category', action: 'category.update', changed: ['menu'] },
    { entity: 'ProductOption', action: 'option.update', changed: ['menu'] },
    { entity: 'PromoCode', action: 'promo.delete', changed: ['campaigns'] },
    { entity: 'PosCharge', action: 'posCharge.void', changed: ['wallet'] },
    { entity: 'Order', action: 'order.status', changed: ['orders'] },
    { entity: 'Order', action: 'order.cancel', changed: ['orders', 'wallet', 'loyalty'] },
    { entity: 'AdminUser', action: 'admin.update', changed: [] },
    { entity: 'User', action: 'user.block', changed: [] },
    // An unrelated entity must not gain order cancellation side effects by action alone.
    { entity: 'User', action: 'order.cancel', changed: [] },
  ])('$entity / $action invalidates only its affected domains', async ({ entity, action, changed }) => {
    const before = await revisions();
    await prisma.auditLog.create({
      data: { adminId, entity, action, entityId: 'private-entity-id' },
    });
    expectChangedOnly(before, await revisions(), changed);
  });

  it('detects another committed audit even when its timestamp and id sort before the latest', async () => {
    const data = {
      adminId,
      entity: 'Product',
      action: 'product.update',
      entityId: 'caffe-latte',
    };
    await prisma.auditLog.create({
      data: { ...data, id: 'z-existing-audit', createdAt: new Date('2026-09-20T12:00:00Z') },
    });
    const before = await revisions();
    await prisma.auditLog.create({
      data: { ...data, id: 'a-later-commit', createdAt: new Date('2026-09-19T12:00:00Z') },
    });
    const after = await revisions();
    expectChangedOnly(before, after, ['menu']);
    expect(await revisions()).toEqual(after);
  });
});
