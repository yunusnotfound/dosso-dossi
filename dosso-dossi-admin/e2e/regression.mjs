// Isolated admin regression: every API request is fulfilled by fixtures.
// Starts its own Vite server. No credentials, live backend or database writes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 5296;
const base = `http://127.0.0.1:${port}`;
const apiBase = 'http://admin-regression.invalid';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd, env: { ...process.env, VITE_API_BASE: apiBase }, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (data) => { serverLog += data; });
server.stderr.on('data', (data) => { serverLog += data; });
let browser;
const checks = [];
const mutations = [];
const requests = [];
const errors = [];
const waits = new Map();
const gates = new Map();
function gate(name) {
  let release;
  const promise = new Promise((r) => { release = r; });
  gates.set(name, { promise, release });
}
const profiles = {
  a: { id: 'a', email: 'a@example.invalid', name: 'Audit A', role: 'SUPER_ADMIN', branchId: null },
  b: { id: 'b', email: 'b@example.invalid', name: 'Audit B', role: 'MANAGER', branchId: null },
  branch: { id: 'branch', email: 'branch@example.invalid', name: 'Audit Branch', role: 'BRANCH_MANAGER', branchId: 'b1' },
  viewer: { id: 'viewer', email: 'viewer@example.invalid', name: 'Audit Viewer', role: 'VIEWER', branchId: null },
};
const settings = { 'loyalty.stampTarget': 5, 'loyalty.topUpBonusThreshold': 1000, 'loyalty.topUpBonusDrinks': 5, 'loyalty.topUpBonusFirstOnly': true };
const branch = { id: 'b1', name: 'Audit Şube', address: 'Test adres', city: 'İstanbul', phone: '', lat: 41, lng: 29, hours: '09:00–20:00', isOpen: true, prepMinutes: 7, orderCount: 1 };
const availability = { productId: 'latte', name: 'Audit Latte', categoryName: 'Kahve', basePrice: 190, isAvailable: true, priceOverride: 210.50 };
const product = { id: 'latte', name: 'Audit Latte', categoryId: 'coffee', categoryName: 'Kahve', description: '', price: 190.50, imageUrl: 'https://images.invalid/detail.png', gridImageUrl: 'https://images.invalid/grid-old.png', sizeMl: 250, stampMultiplier: 1, isActive: true, isNew: false, isFeatured: false, hasOptions: false };
const order = (number, status = 'RECEIVED') => ({ id: `DD-${number}`, number, status, branchName: branch.name, customerName: 'Sentetik Müşteri', customerPhone: '5550000000', itemCount: 1, total: 425.50, usedFreeDrink: false, promoCode: null, forwarded: true, createdAt: '2026-10-02T10:00:00Z' });
const customer = (account) => ({ id: `customer-${account}`, name: `ACCOUNT_${account.toUpperCase()}_CUSTOMER`, phone: '5550000000', email: '', isBlocked: false, balance: 425.50, stamps: 2, target: 5, freeDrinks: 1, orderCount: 7, lifetimeSpend: 850.50, createdAt: '2026-01-01T10:00:00Z' });
async function waitUntil(fn, message, timeout = 10_000) {
  const start = Date.now();
  while (!await fn()) {
    if (Date.now() - start > timeout) throw new Error(message);
    await new Promise((r) => setTimeout(r, 30));
  }
}
function checked(name) { checks.push(name); console.log(`✓ ${name}`); }
try {
  await waitUntil(async () => {
    if (server.exitCode !== null) throw new Error(serverLog);
    return fetch(base).then((r) => r.ok).catch(() => false);
  }, 'Isolated Vite server did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  await context.route(`${apiBase}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const body = req.postDataJSON();
    const token = req.headers().authorization?.replace('Bearer ', '') ?? '';
    const account = token.split('-')[0] || 'a';
    requests.push({ path, query: url.searchParams.toString(), method, account, body });
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
    const json = (value, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(value) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (method !== 'GET') mutations.push({ path, body, account });
    if (path === '/admin/auth/login') {
      const name = body.email.split('@')[0];
      return json({ token: `${name}-access`, refreshToken: `${name}-refresh`, admin: profiles[name] });
    }
    if (path === '/admin/auth/me') return json(profiles[account]);
    if (path === '/admin/auth/logout') return json({ ok: true });
    if (path === '/admin/auth/password') return json({ ok: true });
    if (path === '/admin/auth/refresh') {
      waits.set('refresh', true);
      if (gates.has('refresh')) await gates.get('refresh').promise;
      const name = body.refreshToken.split('-')[0];
      return json({ token: `${name}-rotated`, refreshToken: `${name}-refresh-rotated` });
    }
    if (path === '/admin/audit-test/deferred') {
      waits.set('deferred', true);
      await gates.get('deferred').promise;
      return json({ private: 'old-account-data' });
    }
    if (path === '/admin/audit-test/invalid') return json({ error: { code: 'UNAUTHORIZED', message: 'Revoked fixture' } }, 401);
    if (path === '/admin/audit-test/refresh') return token.endsWith('rotated') ? json({ ok: true }) : json({ error: { code: 'UNAUTHORIZED', message: 'Expired fixture' } }, 401);
    if (path === '/admin/dashboard') return json({ summary: { orderRevenue: 425.50, qrRevenue: 0, totalRevenue: 425.50, orderCount: 1, topUpTotal: 1000, newUsers: 1, stampsEarned: 2, freeDrinksGranted: 5, pendingGifts: 0 }, timeseries: [], branches: [], hourly: [], alerts: { unforwardedOrders: 0, failedPosEvents: 0, closedBranches: [], pendingPayments: 0 } });
    if (path === '/admin/customers') return json({ page: 1, pageSize: 25, total: 1, customers: [customer(account)] });
    if (path.startsWith('/admin/customers/customer-')) return json({ ...customer(account), activeSessions: 1, loyalty: { stamps: 2, target: 5, freeDrinks: 1 }, transactions: [], orders: [], loyaltyEvents: [], giftsSent: [], giftsReceived: [], qrCharges: [] });
    if (path === '/admin/settings') {
      if (method === 'POST') settings[body.key] = body.value;
      return json(method === 'GET' ? settings : { ok: true });
    }
    if (path === '/admin/campaigns' || path === '/admin/promos') return json([]);
    if (path === '/admin/branches') return json([branch]);
    if (path === '/admin/branches/b1/availability') return json([availability]);
    if (path === '/admin/branches/b1/availability/latte') { Object.assign(availability, body); return json({ ok: true }); }
    if (path === '/admin/menu/categories') return json([{ id: 'coffee', name: 'Kahve', sortOrder: 0, productCount: 1 }]);
    if (path === '/admin/menu/products') {
      if (method === 'POST') Object.assign(product, body);
      return json(method === 'GET' ? { page: 1, pageSize: 50, total: 1, products: [product] } : product);
    }
    if (path === '/admin/menu/options') return json([{ id: 'milk', group: 'milk', name: 'Yulaf sütü', priceDelta: 20, sortOrder: 1, isActive: true }]);
    if (path === '/admin/orders') {
      const pageNo = Number(url.searchParams.get('page') ?? 1);
      if (url.searchParams.get('activeOnly') === 'true') return json({ page: pageNo, pageSize: 50, total: 51, orders: [order(pageNo === 1 ? 1000 : 999)] });
      return json({ page: pageNo, pageSize: 25, total: 1, orders: [order(3000, 'COMPLETED')] });
    }
    if (path.endsWith('/export.csv') || path.endsWith('/ledger.csv') || path.endsWith('/export.xlsx') || path.endsWith('/ledger.xlsx')) {
      return route.fulfill({ status: 200, headers: { ...headers, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit.csv"', 'Access-Control-Expose-Headers': 'Content-Disposition' }, body: 'id;amount\nfixture;425.50\n' });
    }
    if (path === '/admin/finance/ledger') return json({ page: 1, pageSize: 50, total: 1, totalsByType: [{ type: 'REFUND', count: 1, amount: 425.50 }], entries: [{ id: 't1', type: 'REFUND', amount: 425.50, balanceAfter: 1000, note: 'Audit', customerName: 'Sentetik', customerPhone: '5550000000', createdAt: '2026-10-02T10:00:00Z' }] });
    errors.push(`Unmocked API: ${method} ${path}`);
    return json({ error: { code: 'FIXTURE_MISSING', message: `Unmocked ${path}` } }, 404);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (e) => errors.push(String(e)));
  async function login(name) {
    await page.getByRole('textbox', { name: 'E-posta' }).fill(`${name}@example.invalid`);
    await page.getByLabel('Şifre', { exact: true }).fill('fictional-password');
    await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
    await page.getByRole('button', { name: 'Çıkış yap', exact: true }).waitFor();
  }
  async function visit(name) {
    await page.getByRole('link', { name: new RegExp(`${name}$`) }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
  }
  await page.goto(base);
  await login('a');
  await visit('Müşteriler');
  await page.getByText('ACCOUNT_A_CUSTOMER', { exact: true }).waitFor();
  await page.getByText('ACCOUNT_A_CUSTOMER', { exact: true }).click();
  await page.getByText('7 sipariş', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  checked('Customer detail displays the real order count');

  gate('deferred');
  await page.evaluate(() => {
    window.oldResult = import('/src/api/client.ts').then(({ api }) => api('/admin/audit-test/deferred')).then(() => 'incorrect-success', (e) => e.code);
  });
  await waitUntil(() => waits.get('deferred'), 'Deferred request not started');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await login('b');
  await page.getByText('ACCOUNT_B_CUSTOMER', { exact: true }).waitFor();
  assert.equal(await page.getByText('ACCOUNT_A_CUSTOMER', { exact: true }).count(), 0);
  assert.ok(requests.some((r) => r.path === '/admin/customers' && r.account === 'b'));
  gates.get('deferred').release();
  assert.equal(await page.evaluate(() => window.oldResult), 'SESSION_CHANGED');
  checked('New login has its own cache; late prior-account responses are rejected');

  gate('refresh');
  await page.evaluate(() => { window.oldRefresh = import('/src/api/client.ts').then(({ api }) => api('/admin/audit-test/refresh')).then(() => 'incorrect-success', (e) => e.code); });
  await waitUntil(() => waits.get('refresh'), 'Refresh request not started');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await login('a');
  gates.get('refresh').release();
  assert.equal(await page.evaluate(() => window.oldRefresh), 'SESSION_CHANGED');
  assert.equal(await page.evaluate(() => localStorage.getItem('dd_admin_access')), 'a-access');
  gates.delete('refresh');
  checked('A late refresh cannot overwrite the new account tokens');

  const otherTab = await context.newPage();
  await otherTab.goto(base);
  await otherTab.getByRole('button', { name: 'Çıkış yap', exact: true }).waitFor();
  gate('refresh'); waits.delete('refresh');
  const refreshCount = requests.filter((r) => r.path === '/admin/auth/refresh').length;
  const retryCount = requests.filter((r) => r.path === '/admin/audit-test/refresh').length;
  await page.evaluate(() => { window.sharedRefresh = import('/src/api/client.ts').then(({ api }) => api('/admin/audit-test/refresh')); });
  await otherTab.evaluate(() => { window.sharedRefresh = import('/src/api/client.ts').then(({ api }) => api('/admin/audit-test/refresh')); });
  await waitUntil(() => requests.filter((r) => r.path === '/admin/audit-test/refresh').length >= retryCount + 2 && waits.get('refresh'), 'Two-tab refresh not started');
  gates.get('refresh').release();
  const both = await Promise.all([page.evaluate(() => window.sharedRefresh), otherTab.evaluate(() => window.sharedRefresh)]);
  assert.ok(both.every((r) => r.ok));
  assert.equal(requests.filter((r) => r.path === '/admin/auth/refresh').length - refreshCount, 1);
  gates.delete('refresh'); await otherTab.close();
  checked('Concurrent tabs rotate the shared token once and both requests complete');

  await visit('Siparişler');
  await page.getByText('DD-1000', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sonraki ›', exact: true }).click();
  await page.getByText('DD-999', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Tüm siparişler', exact: true }).click();
  await page.getByPlaceholder('DD-1042, telefon veya isim').fill('Search Test');
  await page.getByRole('combobox').selectOption('COMPLETED');
  await page.getByText('DD-3000', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Dışa aktar', exact: true }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /^CSV/ }).click();
  await dl;
  assert.ok(requests.some((r) => r.path === '/admin/orders/export.csv' && new URLSearchParams(r.query).get('q') === 'Search Test' && new URLSearchParams(r.query).get('status') === 'COMPLETED'));
  await page.getByRole('button', { name: 'Canlı pano', exact: true }).click();
  await page.getByText('DD-999', { exact: true }).waitFor();
  assert.ok(requests.filter((r) => r.path === '/admin/orders' && r.query.includes('activeOnly')).every((r) => !r.query.includes('q=') && !r.query.includes('status=')));
  checked('Active orders are separately paged; history filters do not leak; export preserves filters');

  await visit('Kampanyalar');
  await page.getByRole('button', { name: 'Sadakat kuralları', exact: true }).click();
  const bonus = page.getByRole('spinbutton', { name: 'Yükleme ikramı (adet)' });
  await bonus.fill('1.5');
  await bonus.blur();
  assert.equal(mutations.filter((r) => r.path === '/admin/settings').length, 0);
  const bonusForm = bonus.locator('xpath=ancestor::form');
  assert.equal(await bonusForm.getByRole('button', { name: 'Kaydet' }).isDisabled(), true);
  await bonus.fill('6');
  await bonus.blur();
  assert.equal(mutations.filter((r) => r.path === '/admin/settings').length, 0);
  await bonusForm.getByRole('button', { name: 'Kaydet' }).click();
  await waitUntil(() => settings['loyalty.topUpBonusDrinks'] === 6, 'Setting was not saved');
  assert.equal(typeof mutations.findLast((r) => r.path === '/admin/settings').body.value, 'number');
  const firstForm = page.locator('form').filter({ hasText: 'Yalnız ilk yükleme' });
  await firstForm.getByRole('checkbox').uncheck();
  await firstForm.getByRole('button', { name: 'Kaydet' }).click();
  await waitUntil(() => settings['loyalty.topUpBonusFirstOnly'] === false, 'Boolean setting was not saved');
  checked('Settings reject fractional rewards and save valid typed values only on explicit submit');

  await visit('Şubeler');
  await page.getByRole('button', { name: 'Ürün müsaitliği', exact: true }).click();
  await page.getByRole('button', { name: 'Var', exact: true }).click();
  await waitUntil(() => availability.isAvailable === false, 'Availability did not toggle');
  assert.equal(availability.priceOverride, 210.50);
  assert.equal(Object.hasOwn(mutations.findLast((r) => r.path.includes('/availability/latte')).body, 'priceOverride'), false);
  await page.keyboard.press('Escape');
  checked('Availability toggle preserves and displays the branch-specific price');

  await visit('Menü');
  await page.getByText('Audit Latte', { exact: true }).click();
  await page.getByLabel('Detay görseli URL').fill('https://images.invalid/detail-new.png');
  await page.getByRole('checkbox', { name: 'Liste ve detayda aynı görseli kullan', exact: true }).check();
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await waitUntil(() => product.imageUrl.endsWith('detail-new.png'), 'Product image was not saved');
  assert.equal(product.gridImageUrl, null);
  checked('Choosing one image clears the stale grid override while preserving product fields');

  await visit('Finans');
  await page.getByRole('combobox').selectOption('REFUND');
  await page.getByRole('textbox', { name: 'Hareket ara' }).fill('Audit');
  await page.getByLabel('Başlangıç tarihi').fill('2026-10-01');
  await page.getByLabel('Bitiş tarihi').fill('2026-10-02');
  await page.getByRole('button', { name: 'Dışa aktar', exact: true }).click();
  const ledgerDl = page.waitForEvent('download');
  await page.getByRole('button', { name: /^CSV/ }).click();
  await ledgerDl;
  const exportedLedger = requests.findLast((r) => r.path === '/admin/finance/ledger.csv');
  const ledgerParams = new URLSearchParams(exportedLedger.query);
  assert.equal(ledgerParams.get('type'), 'REFUND');
  assert.equal(ledgerParams.get('q'), 'Audit');
  assert.ok(ledgerParams.get('from')); assert.ok(ledgerParams.get('to'));
  const shownLedger = new URLSearchParams(requests.findLast((r) => r.path === '/admin/finance/ledger').query);
  for (const key of ['q', 'type', 'from', 'to']) assert.equal(ledgerParams.get(key), shownLedger.get(key));
  assert.ok((await page.locator('main').innerText()).includes('425,50'));
  checked('Ledger download follows the visible filter and money retains kuruş');

  await page.getByRole('button', { name: 'Şifremi değiştir', exact: true }).click();
  await page.getByLabel('Mevcut şifre').fill('fictional-old');
  await page.locator('input[autocomplete="new-password"]').first().fill('fictional-new-long');
  await page.getByLabel('Yeni şifre (tekrar)').fill('fictional-new-long');
  await page.getByRole('button', { name: 'Şifreyi değiştir ve çıkış yap' }).click();
  await page.getByText(/Şifreniz değiştirildi ve mevcut oturumlarınız kapatıldı/).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('dd_admin_access')), null);
  checked('Password change ends the local session and explains the required new login');

  await login('branch');
  assert.equal(await page.getByRole('link', { name: /Finans$/ }).count(), 0);
  assert.equal(await page.getByRole('link', { name: /Müşteriler$/ }).count(), 0);
  assert.equal(await page.getByRole('link', { name: /POS İzleme$/ }).count(), 0);
  await page.goto(`${base}/finans`);
  await page.getByRole('heading', { name: 'Panel', exact: true }).waitFor();
  checked('Branch manager cannot enter global CRM/finance/POS routes');

  const revoked = await page.evaluate(() => import('/src/api/client.ts').then(({ api }) => api('/admin/audit-test/invalid')).then(() => 'incorrect-success', (e) => e.code));
  assert.equal(revoked, 'UNAUTHORIZED');
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('dd_admin_access')), null);
  checked('A rejected refreshed session clears protected UI and stored tokens');
  await login('viewer');
  await visit('Menü');
  assert.equal(await page.getByRole('button', { name: 'Yeni ürün', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Pasifleştir', exact: true }).isDisabled(), true);
  await visit('Kampanyalar');
  assert.equal(await page.getByRole('button', { name: 'Yeni kampanya', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Sadakat kuralları', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Yükleme ikramı (adet)' }).isDisabled(), true);
  checked('Viewer can inspect catalog and rules without enabled write controls');


  assert.deepEqual(errors, []);
  console.log(`\n${checks.length} isolated regressions passed. API calls: ${requests.length}; all mocked.`);
} catch (error) {
  console.error(error);
  console.error({ errors, lastRequests: requests.slice(-5) });
  process.exitCode = 1;
} finally {
  for (const { release } of gates.values()) release();
  await browser?.close();
  server.kill('SIGTERM');
}
