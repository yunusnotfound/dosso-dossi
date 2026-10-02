// Actual React screens, isolated Playwright browser, synthetic read-only API fixtures.
// No production/local backend API is called. Never run the mutable e2e smoke script.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const production = path.join(repo, 'video-production/management-intro');
const shots = path.join(production, 'screens');
const { chromium } = await import(pathToFileURL(path.join(repo, 'dosso-dossi-admin/node_modules/playwright/index.mjs')));
const menu = JSON.parse(await fs.readFile(path.join(repo, 'dosso-dossi-backend/prisma/seed-data/menu.json'), 'utf8'));
const iso = (hour, minute = 0) => `2026-09-30T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const admin = { id: 'presentation-super-admin', email: 'sunum@example.test', name: 'Sunum Yöneticisi', role: 'SUPER_ADMIN', branchId: null };
const branches = [
  ['beylikduzu-vadi-loca', 'Beylikdüzü Vadi Loca', 'İstanbul', 7, 42],
  ['beylikduzu-son-durak', 'Beylikdüzü Son Durak', 'İstanbul', 8, 31],
  ['vatan-caddesi', 'Vatan Caddesi', 'İstanbul', 6, 36],
  ['diyarbakir-stad', 'Diyarbakır Stad', 'Diyarbakır', 9, 19],
].map(([id, name, city, prepMinutes, orderCount], i) => ({ id, name, city, address: 'Sunum için örnek şube adresi', phone: '+90 5•• ••• •• ••', lat: 41.0021 + i * .01, lng: 28.6543 + i * .01, hours: '08:00–23:00', isOpen: true, prepMinutes, orderCount }));
const customers = Array.from({ length: 8 }, (_, i) => ({ id: `sample-customer-${i + 1}`, name: `Örnek Müşteri ${String(i + 1).padStart(2, '0')}`, phone: `5•• ••• •• ${String(i + 1).padStart(2, '0')}`, email: `musteri${i + 1}@example.test`, isBlocked: false, balance: [810, 540, 275, 1000, 350, 625, 185, 450][i], stamps: [3, 1, 4, 2, 0, 3, 2, 4][i], target: 5, freeDrinks: [2, 1, 0, 5, 1, 0, 2, 1][i], orderCount: [12, 8, 18, 3, 7, 15, 4, 10][i], lifetimeSpend: [2640, 1520, 3890, 570, 1425, 3375, 760, 2125][i], createdAt: `2026-09-${String(29 - i).padStart(2, '0')}T09:30:00.000Z` }));
const orders = Array.from({ length: 9 }, (_, i) => ({ id: `DD-${2041 + i}`, number: 2041 + i, status: ['RECEIVED', 'PREPARING', 'READY'][i % 3], branchName: branches[i % 4].name, customerName: customers[i % 8].name, customerPhone: customers[i % 8].phone, itemCount: [2, 1, 3][i % 3], total: [380, 190, 610, 250, 420, 340, 195, 500, 275][i], usedFreeDrink: i === 4, promoCode: i === 5 ? 'DOSSO10' : null, forwarded: false, createdAt: iso(13, 12 - i) }));
const products = menu.products.slice(0, 12).map(p => ({ ...p, categoryName: menu.categories.find(c => c.id === p.categoryId)?.name ?? '', isActive: true }));
const categories = menu.categories.map(c => ({ ...c, productCount: menu.products.filter(p => p.categoryId === c.id).length }));
const campaigns = [
  { id: 'kahve-ictikce', title: 'Kahve İçtikçe Kahve Kazan', badge: '5 + 1', description: '5 damga tamamlandığında 1 ikram kahve.', style: 'orange', sortOrder: 0, isActive: true },
  { id: 'yukle-kazan', title: 'Yükle Kazan', badge: '5 İKRAM', description: 'İlk yüklemede tek seferde 1.000 TL ve üzeri bakiye yükle, 5 ikram kazan.', style: 'dark', sortOrder: 1, isActive: true },
];
const txs = [
  ['ORDER_PAYMENT', -190, 810, 'Sipariş DD-2041'],
  ['TOPUP', 1000, 1000, 'Örnek yükleme — ödeme simülasyonu'],
  ['GIFT_SENT', -100, 540, 'Örnek hediye gönderimi'],
  ['QR_PAYMENT', -250, 275, 'Örnek QR tahsilatı'],
  ['GIFT_RECEIVED', 100, 350, 'Örnek hediye bakiye'],
  ['REFUND', 190, 625, 'Örnek sipariş iadesi'],
].map(([type, amount, balanceAfter, note], i) => ({ id: `sample-tx-${i}`, type, amount, balanceAfter, note, customerName: customers[i].name, customerPhone: customers[i].phone, createdAt: iso(13 - Math.floor(i / 2), 10 - i) }));
const payments = customers.slice(0, 6).map((c, i) => ({ id: `sample-payment-${i}`, amount: [1000, 500, 250, 1000, 500, 100][i], status: i === 4 ? 'PENDING' : 'SUCCEEDED', provider: 'dev', providerRef: `demo_${String(i + 1).padStart(3, '0')}`, bonusDrinks: i === 0 || i === 3 ? 5 : 0, customerName: c.name, customerPhone: c.phone, createdAt: iso(10 + Math.floor(i / 3), i * 7), confirmedAt: i === 4 ? null : iso(10 + Math.floor(i / 3), i * 7 + 1) }));
const settings = { 'loyalty.stampTarget': 5, 'loyalty.topUpBonusThreshold': 1000, 'loyalty.topUpBonusDrinks': 5, 'loyalty.topUpBonusFirstOnly': true };
const admins = [
  ['sample-admin-1', 'Örnek Merkez Yöneticisi', 'merkez@example.test', 'SUPER_ADMIN', null],
  ['sample-admin-2', 'Örnek Operasyon Yöneticisi', 'operasyon@example.test', 'MANAGER', null],
  ['sample-admin-3', 'Örnek Şube Yöneticisi', 'sube@example.test', 'BRANCH_MANAGER', branches[0]],
  ['sample-admin-4', 'Örnek Rapor Kullanıcısı', 'rapor@example.test', 'VIEWER', null],
].map(([id, name, email, role, branch]) => ({ id, name, email, role, branchId: branch?.id ?? null, branchName: branch?.name ?? null, isActive: true, lastLoginAt: iso(9, 15), createdAt: '2026-09-01T09:00:00.000Z' }));
const dashboard = {
  summary: { orderRevenue: 27450, qrRevenue: 8950, totalRevenue: 36400, orderCount: 128, topUpTotal: 18500, newUsers: 24, stampsEarned: 156, freeDrinksGranted: 28, pendingGifts: 3 },
  timeseries: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, revenue: Math.round(17800 + i * 460 + Math.sin(i * 1.3) * 2300), orders: 60 + i * 2 })),
  branches: branches.map((b, i) => ({ branchId: b.id, name: b.name, isOpen: b.isOpen, orders: b.orderCount, revenue: [9300, 6540, 7870, 3740][i] })),
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: hour < 8 || hour > 21 ? 0 : [6, 10, 12, 15, 11, 9, 7, 8, 13, 16, 11, 8, 6, 4][hour - 8] })),
  alerts: { unforwardedOrders: 0, failedPosEvents: 0, closedBranches: [], pendingPayments: 0 },
};
const paginated = (key, rows, pageSize = 25) => ({ page: 1, pageSize, total: rows.length, [key]: rows });
function fixture(url) {
  const p = url.pathname;
  if (p === '/admin/auth/me') return admin;
  if (p === '/admin/dashboard') return dashboard;
  if (p === '/admin/orders') return paginated('orders', orders);
  if (p === '/admin/menu/categories') return categories;
  if (p === '/admin/menu/products') return paginated('products', products, 50);
  if (p === '/admin/menu/options') return [{ id: 'oat', group: 'milk', name: 'Yulaf sütü', priceDelta: 60, sortOrder: 1, isActive: true }, { id: 'double', group: 'shot', name: 'Çift shot', priceDelta: 40, sortOrder: 2, isActive: true }];
  if (p === '/admin/branches') return branches;
  if (p === '/admin/campaigns') return campaigns;
  if (p === '/admin/settings') return settings;
  if (p === '/admin/customers') return paginated('customers', customers);
  if (p.startsWith('/admin/customers/sample-customer-')) {
    const c = customers.find(x => p.endsWith(x.id));
    return { ...c, activeSessions: 1, loyalty: { stamps: c.stamps, target: c.target, freeDrinks: c.freeDrinks }, transactions: txs.slice(0, 2), orders: orders.slice(0, 2), loyaltyEvents: [{ id: 'sample-event', type: 'REWARD_EARNED', title: 'Damga kartı tamamlandı — 1 ikram kahve', createdAt: iso(12) }], giftsSent: [], giftsReceived: [], qrCharges: [] };
  }
  if (p === '/admin/finance/ledger') return { ...paginated('entries', txs, 50), totalsByType: txs.map(t => ({ type: t.type, count: 1, amount: t.amount })) };
  if (p === '/admin/finance/payments') return payments;
  if (p === '/admin/pos/health') return { sources: [{ source: 'simulator', lastSeenAt: iso(13, 10), total: 12, failed: 1 }, { source: 'dev-payment', lastSeenAt: iso(13, 5), total: 6, failed: 0 }], outbox: [{ id: 'DD-2041', number: 2041, branchName: branches[0].name, createdAt: iso(13, 12), waitingMinutes: 2 }] };
  if (p === '/admin/admins') return admins;
  return undefined;
}

await fs.mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addInitScript(() => {
  localStorage.setItem('dd_admin_access', 'presentation-fixture-not-a-valid-token');
  localStorage.setItem('dd_admin_refresh', 'presentation-fixture-not-a-valid-refresh-token');
});
const calls = [], blocked = [], errors = [];
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.startsWith('/admin/') || (url.hostname === 'localhost' && url.port === '3000')) {
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    }
    if (request.method() !== 'GET') {
      blocked.push({ method: request.method(), path: url.pathname });
      return route.abort('blockedbyclient');
    }
    const body = fixture(url);
    if (body === undefined) {
      blocked.push({ method: 'GET', path: url.pathname, reason: 'No fixture; real API forbidden' });
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'FIXTURE_NOT_FOUND', message: 'Sunum verisi tanımlı değil' } }), headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    calls.push({ method: 'GET', path: url.pathname });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  // Only Vite assets and font GETs may leave the isolated fixture layer.
  if (request.method() !== 'GET') {
    blocked.push({ method: request.method(), path: url.pathname });
    return route.abort('blockedbyclient');
  }
  return route.continue();
});
const page = await context.newPage();
page.on('pageerror', e => errors.push(String(e)));
const captures = [];
async function capture(id, routePath, title, settleText, interaction, caveat = '') {
  await page.goto(`http://localhost:5173${routePath}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  if (interaction) await interaction();
  if (settleText) await page.getByText(settleText, { exact: false }).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(id === 'admin_dashboard' ? 1800 : 350);
  await page.mouse.move(1500, 970);
  const file = path.join(shots, `${id}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
  captures.push({ id, route: routePath, file: `screens/${id}.png`, title, viewport: { width: 1600, height: 1000 }, captureOrigin: 'Actual local React admin UI, unchanged; Playwright screenshot', dataOrigin: 'Synthetic read-only route fixtures; public product metadata copied from repository seed', requiredVideoLabel: 'Örnek verilerle gösterim', caveat });
  console.log(`Captured ${id}`);
}

try {
  await capture('admin_dashboard', '/', 'Panel', 'Dağıtılan damga', null, 'Figures are synthetic, not company performance.');
  await capture('admin_orders', '/siparisler', 'Siparişler', 'DD-2041', null, 'Example statuses, no actual preparation or POS delivery.');
  await capture('admin_menu', '/menu', 'Menü', 'Filtre Kahve');
  await capture('admin_branches', '/subeler', 'Şubeler', 'Beylikdüzü Vadi Loca');
  await capture('admin_campaigns', '/kampanyalar', 'Kampanyalar', 'Yükle Kazan');
  await capture('admin_loyalty', '/kampanyalar', 'Kampanyalar', 'Yalnız ilk yükleme', () => page.getByRole('button', { name: 'Sadakat kuralları', exact: true }).click(), 'Stamp-target setting is not connected end-to-end; embedded mobile campaign copy remains static.');
  await capture('admin_customers', '/musteriler', 'Müşteriler', 'Örnek Müşteri 01');
  await capture('admin_customer_detail', '/musteriler', 'Müşteriler', 'Bakiye düzelt', () => page.getByText('Örnek Müşteri 01', { exact: true }).click(), 'Synthetic customer; no financial or account action clicked.');
  await capture('admin_finance', '/finans', 'Finans', 'Örnek yükleme — ödeme simülasyonu');
  await capture('admin_payments', '/finans', 'Finans', 'demo_001', () => page.getByRole('button', { name: 'Yüklemeler', exact: true }).click(), 'Dev payment examples; no bank charge.');
  await capture('admin_pos', '/pos', 'POS İzleme', 'simulator', null, 'Simulated webhook event metadata; not proof of a live terminal connection.');
  await capture('admin_administration', '/yonetim', 'Yönetim', 'Örnek Merkez Yöneticisi');
} finally {
  await fs.writeFile(path.join(production, 'admin-capture-map.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), appUrl: 'http://localhost:5173', script: 'tooling/capture-admin.mjs', fixtureOnly: true, realBackendRequests: 0, serverWrites: 0, fixtureAccount: admin, requiredVideoLabel: 'Örnek verilerle gösterim', captures, fixtureRequests: calls, blockedRequests: blocked, pageErrors: errors }, null, 2));
  await browser.close();
}
if (errors.length || blocked.length) throw new Error(`Capture issues: ${errors.length} page errors, ${blocked.length} unexpected/blocked requests. See admin-capture-map.json.`);
console.log(`Done: ${captures.length} actual UI screenshots; no server writes.`);
