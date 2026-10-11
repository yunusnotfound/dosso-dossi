import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { branchStats, hourly, summary, timeseries } from './dashboard.service.js';
import { reconciliation } from './finance.service.js';
import { branchDetail } from './branches.service.js';
import { addBusinessDays, businessDateTime, businessParts, startOfBusinessDay, businessDayKey } from '../../lib/business-time.js';

it('QR revenue agrees across summary, daily chart and branch totals with branch/status/date isolation', async () => {
  const branchId = 'beylikduzu-vadi-loca';
  const { id: _id, ...branch } = await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  await prisma.branch.create({ data: { ...branch, id: 'other-branch', name: 'Diğer şube' } });
  const user = await prisma.user.create({ data: { phone: '5550000000' } });
  const today = businessDateTime({ ...businessParts(new Date()), hour: 12 });
  const yesterday = addBusinessDays(today, -1);
  await prisma.order.createMany({ data: [
    { userId: user.id, branchId, number: 1, total: 100, subtotal: 100, pickupSlot: 'asap', createdAt: today },
    { userId: user.id, branchId, number: 2, total: 999, subtotal: 999, pickupSlot: 'asap', status: 'CANCELLED', createdAt: today },
    { userId: user.id, branchId: 'other-branch', number: 3, total: 200, subtotal: 200, pickupSlot: 'asap', createdAt: today },
  ] });
  for (const data of [
    { branchId, amount: 50.15, status: 'APPROVED' as const, createdAt: today },
    { branchId, amount: 999, status: 'VOIDED' as const, createdAt: today },
    { branchId: 'other-branch', amount: 70.25, status: 'APPROVED' as const, createdAt: today },
    { branchId, amount: 33, status: 'APPROVED' as const, createdAt: yesterday },
  ]) {
    const token = await prisma.qrToken.create({ data: { userId: user.id, code: randomUUID(), expiresAt: today } });
    await prisma.posCharge.create({ data: { ...data, userId: user.id, qrTokenId: token.id } });
  }
  expect(await summary()).toMatchObject({ orderRevenue: 300, qrRevenue: 120.4, totalRevenue: 420.4, orderCount: 2 });
  expect(await summary(branchId)).toMatchObject({ orderRevenue: 100, qrRevenue: 50.15, totalRevenue: 150.15, orderCount: 1 });
  expect((await timeseries(1))[0]).toMatchObject({ revenue: 420.4, orders: 2 });
  expect((await timeseries(1, branchId))[0]).toMatchObject({ revenue: 150.15, orders: 1 });
  expect((await timeseries(2, branchId)).map(p => p.revenue)).toEqual([33, 150.15]);
  expect(await branchStats(branchId)).toEqual([
    expect.objectContaining({ branchId, revenue: 150.15, orders: 1 }),
  ]);
  const branches = await branchStats();
  expect(branches.find(b => b.branchId === 'other-branch')).toMatchObject({ revenue: 270.25, orders: 1 });
  expect(Number(branches.reduce((total, b) => total + b.revenue, 0).toFixed(2))).toBe(420.4);
});

it('İstanbul gece yarısı işlemleri UTC günü yerine aynı iş gününün tüm raporlarına girer', async () => {
  const user = await prisma.user.create({ data: { phone: '5550000001' } });
  const start = startOfBusinessDay();
  const early = new Date(start.getTime() + 30 * 60_000); // Istanbul 00:30, previous UTC date.
  const before = new Date(start.getTime() - 1);
  expect(early.toISOString().slice(0, 10)).not.toBe(businessDayKey(early));
  await prisma.order.createMany({ data: [
    { userId: user.id, branchId: 'beylikduzu-vadi-loca', number: 10, total: 100, subtotal: 100, pickupSlot: 'asap', createdAt: early },
    { userId: user.id, branchId: 'beylikduzu-vadi-loca', number: 11, total: 99, subtotal: 99, pickupSlot: 'asap', createdAt: before },
  ] });
  for (const createdAt of [early, before]) {
    const token = await prisma.qrToken.create({ data: { userId: user.id, code: randomUUID(), expiresAt: early } });
    await prisma.posCharge.create({ data: { userId: user.id, branchId: 'beylikduzu-vadi-loca', qrTokenId: token.id, amount: 25, status: 'APPROVED', createdAt } });
  }
  expect(await summary()).toMatchObject({ totalRevenue: 125, orderCount: 1 });
  expect(await branchDetail('beylikduzu-vadi-loca')).toMatchObject({ todayRevenue: 100, todayOrders: 1 });
  expect(await timeseries(1)).toEqual([{ date: businessDayKey(early), revenue: 125, orders: 1 }]);
  expect((await hourly())[0]).toEqual({ hour: 0, orders: 1 });
  expect(await reconciliation(1)).toEqual([expect.objectContaining({ date: businessDayKey(early), ourCount: 1, ourAmount: 25 })]);
});
