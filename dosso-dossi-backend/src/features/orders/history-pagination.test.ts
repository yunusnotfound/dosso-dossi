import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login } from '../../test/helpers.js';

const app = createApp();
const branchId = 'beylikduzu-vadi-loca';
const createdAt = new Date('2026-09-01T10:00:00Z');

describe('Stable and isolated customer history pagination', () => {
  let token: string;
  let userId: string;
  let accountId: string;
  beforeEach(async () => {
    token = await login(app, '05558881111');
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: '5558881111' }, include: { loyalty: true } });
    userId = user.id;
    accountId = user.loyalty!.id;
  });

  it.each(['/orders', '/gifts', '/me/loyalty'])('%s can reach every old record despite equal timestamps and new arrivals', async endpoint => {
    const other = await prisma.user.create({ data: { phone: '5558882222', loyalty: { create: {} } }, include: { loyalty: true } });
    const seed = async (ownerId: string, loyaltyId: string, prefix: string, count: number, date: Date, firstNumber: number) => {
      const rows = Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${String(i).padStart(3, '0')}`, createdAt: date }));
      if (endpoint === '/orders') await prisma.order.createMany({ data: rows.map((row, i) => ({
        ...row, userId: ownerId, branchId, number: firstNumber + i, pickupSlot: 'asap', subtotal: 10, total: 10,
      })) });
      if (endpoint === '/gifts') await prisma.gift.createMany({ data: rows.map(row => ({
        ...row, senderId: ownerId, recipientPhone: '5559999999', type: 'BALANCE', label: 'Test', amount: 10, redeemCode: row.id,
      })) });
      if (endpoint === '/me/loyalty') await prisma.loyaltyEvent.createMany({ data: rows.map(row => ({
        ...row, accountId: loyaltyId, type: 'STAMPS_EARNED', title: 'Test',
      })) });
    };
    await seed(userId, accountId, 'own', 57, createdAt, 1000);
    await seed(other.id, other.loyalty!.id, 'other', 3, createdAt, 2000);
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 4; page++) {
      const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`)
        .query({ paginated: 'true', limit: 20, ...(cursor ? { cursor } : {}) });
      expect(response.status).toBe(200);
      const rows = endpoint === '/me/loyalty' ? response.body.history : response.body.items;
      expect(rows.length).toBeLessThanOrEqual(20);
      seen.push(...rows.map((row: { id: string }) => row.id));
      cursor = response.body.nextCursor;
      if (page === 0) {
        // A new record belongs on the next refresh, never shifts older pages.
        await seed(userId, accountId, 'new', 1, new Date(createdAt.getTime() + 60_000), 3000);
      }
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(seen).toHaveLength(57);
    expect(new Set(seen).size).toBe(57);
    const expected = Array.from({ length: 57 }, (_, i) => endpoint === '/orders' ? `DD-${1000 + i}` : `own-${String(i).padStart(3, '0')}`);
    expect(new Set(seen)).toEqual(new Set(expected));
    const fresh = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`).query({ paginated: 'true', limit: 1 });
    const first = endpoint === '/me/loyalty' ? fresh.body.history[0] : fresh.body.items[0];
    expect(first.id).toBe(endpoint === '/orders' ? 'DD-3000' : 'new-000');
  });

  it('keeps the existing array contract and rejects malformed/unbounded pages', async () => {
    for (const endpoint of ['/orders', '/gifts']) {
      const legacy = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
      expect(legacy.status).toBe(200);
      expect(legacy.body).toEqual([]);
    }
    for (const endpoint of ['/orders', '/gifts', '/me/loyalty']) {
      for (const query of [{ cursor: 'not-a-cursor' }, { limit: 101 }, { limit: 0 }, { limit: 'NaN' }]) {
        const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`).query(query);
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    }
  });
});
