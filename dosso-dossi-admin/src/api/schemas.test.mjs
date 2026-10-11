import assert from 'node:assert/strict';
import test from 'node:test';
import { accountRequestListSchema, adminProfileSchema, dashboardResponseSchema, ledgerSchema, loginResponseSchema, orderListSchema, refreshResponseSchema } from './schemas.ts';
import { fmtDateTime, fmtDayShort } from './format.ts';
import { addDateRange } from './filters.ts';

const admin = { id: 'admin-1', name: 'Test Admin', email: 'test@example.invalid', role: 'SUPER_ADMIN', branchId: null, mustChangePassword: false, tempPasswordExpiresAt: null };

test('Login and refresh reject missing or malformed tokens before storage', () => {
  assert.equal(loginResponseSchema.safeParse({ token: '', refreshToken: 'refresh', admin }).success, false);
  assert.equal(loginResponseSchema.safeParse({ token: 'access', refreshToken: 42, admin }).success, false);
  assert.equal(adminProfileSchema.safeParse({ ...admin, role: 'OWNER' }).success, false);
  assert.equal(refreshResponseSchema.safeParse({ token: 'new-access' }).success, false);
  assert.equal(loginResponseSchema.safeParse({ token: 'access', refreshToken: 'refresh', admin, futureField: true }).success, true);
});

test('Dashboard rejects incorrectly typed money rather than rendering misleading totals', () => {
  const value = { summary: { orderRevenue: 125.50, qrRevenue: 0, totalRevenue: 125.50, orderCount: 1, topUpTotal: 0, newUsers: 0, stampsEarned: 1, freeDrinksGranted: 0, pendingGifts: 0 }, timeseries: [], branches: [], hourly: [], alerts: { unforwardedOrders: 0, failedPosEvents: 0, closedBranches: [], pendingPayments: 0 } };
  assert.equal(dashboardResponseSchema.safeParse(value).success, true);
  assert.equal(dashboardResponseSchema.safeParse({ ...value, summary: { ...value.summary, totalRevenue: '125.50' } }).success, false);
});

test('Order rows require complete status and amount contracts', () => {
  const order = { id: 'DD-42', number: 42, status: 'READY', branchName: 'Test', customerName: '', customerPhone: '5550000000', itemCount: 1, total: 0, usedFreeDrink: true, promoCode: null, forwarded: true, createdAt: '2026-10-07T12:00:00Z' };
  const list = { page: 1, pageSize: 25, total: 1, orders: [order] };
  assert.equal(orderListSchema.safeParse(list).success, true);
  assert.equal(orderListSchema.safeParse({ ...list, orders: [{ ...order, status: 'UNKNOWN' }] }).success, false);
  assert.equal(orderListSchema.safeParse({ ...list, orders: [{ ...order, createdAt: 'invalid' }] }).success, false);
});

test('Ledger preserves signed adjustments and rejects nonfinite monetary values', () => {
  const entry = { id: 'tx-1', type: 'ADJUSTMENT', amount: -15.25, balanceAfter: 4.75, note: 'Correction', customerName: '', customerPhone: '5550000000', createdAt: '2026-10-07T12:00:00+03:00' };
  const ledger = { page: 1, pageSize: 50, total: 1, totalsByType: [], entries: [entry] };
  assert.equal(ledgerSchema.parse(ledger).entries[0].amount, -15.25);
  assert.equal(ledgerSchema.safeParse({ ...ledger, entries: [{ ...entry, amount: Infinity }] }).success, false);
});

test('Account request results validate scope, state and timestamps', () => {
  const request = { id: 'request-1', kind: 'CLOSURE', status: 'OPEN', note: '', response: '', createdAt: '2026-10-07T12:00:00Z', updatedAt: '2026-10-07T12:00:00Z', user: { id: 'user-1', name: '', phone: '5550000000', email: '' }, balance: 0 };
  const value = { page: 1, pageSize: 30, total: 1, entries: [request] };
  assert.equal(accountRequestListSchema.safeParse(value).success, true);
  assert.equal(accountRequestListSchema.safeParse({ ...value, entries: [{ ...request, status: 'DELETED' }] }).success, false);
});

test('Business timestamps use Istanbul while daily report keys retain their date', () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const params = new URLSearchParams();
    addDateRange(params, '2026-10-07', '2026-10-07');
    assert.equal(params.get('from'), '2026-10-06T21:00:00.000Z');
    assert.equal(params.get('to'), '2026-10-07T20:59:59.999Z');
    assert.match(fmtDateTime('2026-10-06T22:30:00Z'), /7\.10\.2026 01:30/);
    assert.match(fmtDayShort('2026-10-07'), /07/);
    process.env.TZ = 'Pacific/Kiritimati';
    assert.match(fmtDayShort('2026-10-07'), /07/);
  } finally {
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  }
});
