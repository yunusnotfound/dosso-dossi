import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signAdminToken } from '../../middleware/admin-auth.js';
import { signToken } from '../../middleware/auth.js';
import { login } from '../../test/helpers.js';
import { hashPassword, changePassword } from './admin-auth.service.js';
import { consumeOtp, sendOtp } from '../auth/otp.service.js';
import { ledgerCsv } from './finance.service.js';
import { ordersWorkbook } from './exports.service.js';
import { listCustomers } from './customers.service.js';
import { summary } from './dashboard.service.js';

const app = createApp();
const branchId = 'beylikduzu-vadi-loca';
async function admin(role: 'SUPER_ADMIN' | 'BRANCH_MANAGER' = 'SUPER_ADMIN') {
  const row = await prisma.adminUser.create({ data: {
    email: `${role.toLowerCase()}@test.invalid`, passwordHash: await hashPassword('current-password-123'), role,
    branchId: role === 'BRANCH_MANAGER' ? branchId : null,
  } });
  return { row, token: signAdminToken(row.id) };
}
async function customer(phone = '5551112233', name = '') {
  return prisma.user.create({ data: { phone, name, wallet: { create: {} }, loyalty: { create: {} } } });
}
async function order(userId: string, number: number, total = 100) {
  return prisma.order.create({ data: { userId, branchId, number, total, subtotal: total, pickupSlot: 'asap' } });
}

describe('Independent reliability regressions', () => {
  it('branch manager cannot access global CRM/finance/POS including exports', async () => {
    const { token } = await admin('BRANCH_MANAGER');
    for (const endpoint of ['/admin/customers', '/admin/customers/gifts/pending', '/admin/finance/ledger', '/admin/finance/ledger.csv', '/admin/finance/ledger.xlsx', '/admin/finance/payments', '/admin/finance/charges', '/admin/finance/reconciliation', '/admin/pos/events', '/admin/pos/health']) {
      const response = await request(app).get(endpoint).auth(token, { type: 'bearer' });
      expect(response.status, endpoint).toBe(403);
    }
    expect((await request(app).get('/admin/orders').auth(token, { type: 'bearer' })).status).toBe(200);
  });

  it('customer all-session revocation rejects old access immediately and permits fresh login', async () => {
    const oldToken = await login(app, '05551112233');
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: '5551112233' } });
    const { token } = await admin();
    expect((await request(app).post(`/admin/customers/${user.id}/revoke-sessions`).auth(token, { type: 'bearer' }).send({ reason: 'Şüpheli oturum incelemesi' })).status).toBe(200);
    expect((await request(app).get('/me/wallet').auth(oldToken, { type: 'bearer' })).status).toBe(401);
    const fresh = await login(app, '05551112233');
    expect((await request(app).get('/me/wallet').auth(fresh, { type: 'bearer' })).status).toBe(200);
  });

  it('password change revokes admin access immediately', async () => {
    const { row, token } = await admin();
    await changePassword(row.id, 'current-password-123', 'new-password-456');
    expect((await request(app).get('/admin/auth/me').auth(token, { type: 'bearer' })).status).toBe(401);
    const fresh = await request(app).post('/admin/auth/login').send({ email: row.email, password: 'new-password-456' });
    expect(fresh.status).toBe(200);
    expect((await request(app).get('/admin/auth/me').auth(fresh.body.token, { type: 'bearer' })).status).toBe(200);
  });

  it('concurrent super-admin demotions preserve one active super-admin', async () => {
    const { row, token } = await admin();
    const second = await prisma.adminUser.create({ data: {
      email: 'second-super@test.invalid', passwordHash: row.passwordHash, role: 'SUPER_ADMIN',
    } });
    const results = await Promise.all([row.id, second.id].map(id =>
      request(app).patch(`/admin/admins/${id}`).auth(token, { type: 'bearer' }).send({ role: 'MANAGER' })));
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.filter(r => [401, 403].includes(r.status))).toHaveLength(1);
    expect(await prisma.adminUser.count({ where: { role: 'SUPER_ADMIN', isActive: true } })).toBe(1);
  });

  it('changing a branch assignment revokes the existing admin session', async () => {
    const manager = await admin('BRANCH_MANAGER');
    const { token } = await admin();
    const { id: _id, ...branch } = await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
    await prisma.branch.create({ data: { ...branch, id: 'second-branch', name: 'İkinci şube' } });
    const changed = await request(app).patch(`/admin/admins/${manager.row.id}`)
      .auth(token, { type: 'bearer' }).send({ branchId: 'second-branch' });
    expect(changed.status).toBe(200);
    expect((await request(app).get('/admin/orders').auth(manager.token, { type: 'bearer' })).status).toBe(401);
  });

  it('only one concurrent password change can use the same old password', async () => {
    const { row } = await admin();
    const results = await Promise.allSettled([
      changePassword(row.id, 'current-password-123', 'new-password-one'),
      changePassword(row.id, 'current-password-123', 'new-password-two'),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const logins = await Promise.all(['new-password-one', 'new-password-two'].map(password =>
      request(app).post('/admin/auth/login').send({ email: row.email, password })));
    expect(logins.filter(r => r.status === 200)).toHaveLength(1);
  });

  it('blocked account may read its profile but cannot create financial operations', async () => {
    const user = await customer();
    await prisma.user.update({ where: { id: user.id }, data: { isBlocked: true } });
    const token = signToken(user.id);
    expect((await request(app).get('/me/wallet').auth(token, { type: 'bearer' })).status).toBe(200);
    for (const endpoint of ['/orders', '/gifts', '/me/wallet/topup', '/me/wallet/qr-token']) {
      const result = await request(app).post(endpoint).auth(token, { type: 'bearer' }).send({ amount: 100 });
      expect(result.status, endpoint).toBe(403);
      expect(result.body.error.code).toBe('ACCOUNT_BLOCKED');
    }
  });

  it('rejects wrong setting types and exposes valid rules publicly without credentials', async () => {
    const { token } = await admin();
    for (const [key, value] of [['loyalty.stampTarget', 1.5], ['loyalty.topUpBonusDrinks', -1], ['loyalty.topUpBonusDrinks', 1.5], ['loyalty.topUpBonusFirstOnly', 'false'], ['loyalty.topUpBonusThreshold', 0.005]]) {
      const res = await request(app).post('/admin/settings').auth(token, { type: 'bearer' }).send({ key, value });
      expect(res.status).toBe(400);
    }
    expect((await request(app).post('/admin/settings').auth(token, { type: 'bearer' }).send({ key: 'loyalty.stampTarget', value: 7 })).status).toBe(200);
    expect((await request(app).get('/config/public')).body.stampTarget).toBe(7);
    await login(app, '05551112233');
    expect((await prisma.loyaltyAccount.findFirstOrThrow()).target).toBe(7);
  });

  it('availability-only mutation preserves an existing branch price', async () => {
    const { token } = await admin();
    await prisma.branchProduct.create({ data: { branchId, productId: 'caffe-latte', priceOverride: 210 } });
    for (const isAvailable of [false, true]) expect((await request(app).post(`/admin/branches/${branchId}/availability/caffe-latte`).auth(token, { type: 'bearer' }).send({ isAvailable })).status).toBe(200);
    expect(Number((await prisma.branchProduct.findFirstOrThrow()).priceOverride)).toBe(210);
  });

  it('exports all 275 ledger rows and neutralizes text formulas without changing numeric amounts', async () => {
    const user = await customer('5551112233', '=1+1');
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.walletTransaction.createMany({ data: Array.from({ length: 275 }, (_, i) => ({ walletId: wallet.id, type: 'TOPUP' as const, amount: 0.25, balanceAfter: i * 0.25, note: i === 0 ? '@SUM(1+1)' : 'ordinary' })) });
    const csv = await ledgerCsv({});
    expect(csv.trim().split('\n')).toHaveLength(276);
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"\'@SUM(1+1)"');
    expect(csv).toContain(';0.25;');
    expect((await ledgerCsv({ q: 'ordinary' })).trim().split('\n')).toHaveLength(275);
  });

  it('XLSX order export honors the same search as the list', async () => {
    const alice = await customer('5551112233', 'Alice');
    const bob = await customer('5551112244', 'Bob');
    await order(alice.id, 9001, 125.50); await order(bob.id, 9002, 200);
    const buffer = await ordersWorkbook({ q: 'Alice' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const values = JSON.stringify(wb.worksheets.map(sheet => sheet.getSheetValues()));
    expect(values).toContain('Alice'); expect(values).not.toContain('Bob');
    expect(values).toContain('125.5');
  });

  it('LTV is sorted across all matching customers before pagination', async () => {
    const big = await customer('5551112200', 'Büyük müşteri');
    await order(big.id, 9100, 9000);
    for (let i = 1; i <= 12; i++) {
      const u = await customer(`55511122${String(i).padStart(2, '0')}`, `Recent ${i}`);
      await order(u.id, 9100 + i, i);
    }
    const page = await listCustomers({ sort: 'ltv', pageSize: 10 });
    expect(page.customers[0]?.id).toBe(big.id); expect(page.total).toBe(13);
  });

  it('five topup bonus drinks count as five rewards, not one event', async () => {
    const user = await customer();
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.paymentIntent.create({ data: { userId: user.id, amount: 1000, status: 'SUCCEEDED', provider: 'dev', bonusDrinks: 5, confirmedAt: new Date() } });
    await prisma.loyaltyEvent.create({ data: { accountId: account.id, type: 'TOPUP_BONUS', title: '5 ikram' } });
    expect((await summary()).freeDrinksGranted).toBe(5);
  });

  it('a real OTP is consumed only once under parallel verification', async () => {
    const phone = '5551112233';
    await prisma.otpCode.create({ data: { phone, codeHash: createHash('sha256').update('123456').digest('hex'), expiresAt: new Date(Date.now() + 60000) } });
    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => consumeOtp(phone, '123456')));
    expect(outcomes.filter(v => v.status === 'fulfilled')).toHaveLength(1);
  });

  it('parallel OTP sends cannot exceed the per-phone quota', async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => sendOtp('5551112233')));
    expect(outcomes.filter(v => v.status === 'fulfilled')).toHaveLength(3);
    expect(await prisma.otpCode.count()).toBe(3);
  });
});
