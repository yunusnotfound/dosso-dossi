// These regression checks intercept every backend request; no live data is read or changed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 5306;
const base = `http://127.0.0.1:${port}`;
const apiBase = 'http://audit-fixes.invalid';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env: { ...process.env, VITE_API_BASE: apiBase }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; server.stdout.on('data', (x) => { logs += x; }); server.stderr.on('data', (x) => { logs += x; });
const admin = { id: 'audit-admin', email: 'audit@example.invalid', name: 'Audit', role: 'SUPER_ADMIN', branchId: null, mustChangePassword: false, tempPasswordExpiresAt: null };
const customer = { id: 'customer', name: 'Test Müşteri', phone: '5550000000', email: '', isBlocked: false, balance: 100, stamps: 1, target: 5, freeDrinks: 0, orderCount: 1, lifetimeSpend: 50, createdAt: '2026-10-01T10:00:00Z' };
const category = { id: 'coffee', name: 'Kahve', sortOrder: 0, productCount: 0 };
const promo = { code: 'TEST', discountRate: 0.1, isActive: true, expiresAt: '2026-11-01T20:00:00Z', usageCount: 0, totalDiscount: 0 };
const calls = []; const intents = new Map(); const unhandled = []; let failList = false; let failDetail = false; let loseBalanceResponse = true; let loseBulkResponse = true; let bulkRuns = 0;
let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (f) => { for (let i = 0; i < 200; i++) { if (await f()) return; await sleep(25); } throw new Error('Condition did not become true'); };
try {
  await waitFor(() => fetch(base).then((r) => r.ok).catch(() => { if (server.exitCode !== null) throw new Error(logs); return false; }));
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.env.CI ? undefined : 'chrome'), headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route(`${apiBase}/**`, async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
    const json = (value, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(value) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = request.postDataJSON(); calls.push({ path, method, body, query: url.searchParams.toString() });
    if (path === '/admin/auth/me') return json(admin);
    if (path === '/admin/auth/login') return json({ token: 'access', refreshToken: 'refresh', admin });
    if (path === '/admin/auth/logout') return json({ ok: true });
    if (path === '/admin/auth/password') { admin.mustChangePassword = false; admin.tempPasswordExpiresAt = null; return json({ ok: true }); }
    if (path === '/admin/customers') return failList ? json({ error: { code: 'READ_FAILED', message: 'Müşteri listesi yüklenemedi' } }, 503) : json({ page: 1, pageSize: 25, total: 1, customers: [customer] });
    if (path === '/admin/customers/customer') return failDetail ? json({ error: { code: 'READ_FAILED', message: 'Müşteri ayrıntısı yüklenemedi' } }, 503) : json({ ...customer, activeSessions: 1, loyalty: { stamps: 1, target: 5, freeDrinks: 0 }, transactions: [], orders: [], loyaltyEvents: [], giftsSent: [], giftsReceived: [], qrCharges: [] });
    if (path === '/admin/customers/customer/balance') {
      if (!intents.has(body.idempotencyKey)) { customer.balance += body.amount; intents.set(body.idempotencyKey, { balance: customer.balance }); }
      if (loseBalanceResponse) { loseBalanceResponse = false; return route.abort('failed'); }
      return json(intents.get(body.idempotencyKey));
    }
    if (path === '/admin/menu/categories') return json([category]);
    if (path === '/admin/menu/products') return json({ page: 1, pageSize: 50, total: 0, products: [] });
    if (path === '/admin/menu/bulk-price') {
      if (!intents.has(body.idempotencyKey)) { bulkRuns++; intents.set(body.idempotencyKey, { updated: 1 }); }
      if (loseBulkResponse) { loseBulkResponse = false; return route.abort('failed'); }
      return json(intents.get(body.idempotencyKey));
    }
    if (path === '/admin/campaigns') return json([]);
    if (path === '/admin/promos') { if (method === 'POST') { Object.assign(promo, body); return json(promo); } return json([promo]); }
    if (path === '/admin/admins' || path === '/admin/branches') return json([]);
    if (path === '/admin/audit') {
      const page = Number(url.searchParams.get('page')); const filtered = url.searchParams.has('entity') || url.searchParams.has('action');
      return json({ page, pageSize: 50, total: filtered ? 1 : 51, logs: [{ id: `log-${page}`, action: 'order.update', entity: 'Order', entityId: 'fixture', reason: '', ip: '', adminName: 'Audit', adminEmail: admin.email, createdAt: '2026-10-01T12:00:00Z', before: null, after: null }] });
    }
    unhandled.push(`${method} ${path}`); return json({ error: { code: 'UNMOCKED', message: path } }, 404);
  });
  const page = await context.newPage(); page.setDefaultTimeout(12_000); page.on('pageerror', (e) => unhandled.push(String(e)));
  await page.addInitScript(() => { if (!localStorage.getItem('dd_admin_session')) { localStorage.setItem('dd_admin_access', 'access'); localStorage.setItem('dd_admin_refresh', 'refresh'); localStorage.setItem('dd_admin_session', 'audit-session'); } });
  await page.goto(`${base}/musteriler`);
  const row = () => page.getByRole('row').filter({ hasText: 'Test Müşteri' });
  await row().waitFor(); await row().focus(); await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Test Müşteri', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Bakiye düzelt', exact: true }).click();
  let balanceDialog = page.getByRole('dialog', { name: 'Bakiye düzeltmesi', exact: true });
  await balanceDialog.getByLabel('Tutar (₺)').fill('100'); await balanceDialog.getByLabel('Gerekçe').fill('Audit correction');
  await balanceDialog.getByRole('button', { name: 'Bakiyeyi güncelle' }).click();
  await balanceDialog.getByText('İşlem başarısız', { exact: true }).waitFor();
  assert.equal(customer.balance, 200);
  await page.reload(); await row().click(); await page.getByRole('button', { name: 'Bakiye düzelt', exact: true }).click();
  balanceDialog = page.getByRole('dialog', { name: 'Bakiye düzeltmesi', exact: true });
  await balanceDialog.getByLabel('Tutar (₺)').fill('100'); await balanceDialog.getByLabel('Gerekçe').fill('Audit correction');
  await balanceDialog.getByRole('button', { name: 'Bakiyeyi güncelle' }).click();
  await balanceDialog.waitFor({ state: 'hidden' });
  const balanceCalls = calls.filter((r) => r.path.endsWith('/balance'));
  assert.equal(balanceCalls.length, 2); assert.equal(balanceCalls[0].body.idempotencyKey, balanceCalls[1].body.idempotencyKey); assert.equal(customer.balance, 200);
  console.log('✓ Balance response loss + full page reload reuses the operation key without a second credit');

  const mainDialog = page.getByRole('dialog', { name: 'Test Müşteri', exact: true });
  await mainDialog.getByRole('button', { name: 'Bakiye düzelt', exact: true }).click();
  balanceDialog = page.getByRole('dialog', { name: 'Bakiye düzeltmesi', exact: true });
  const focusable = balanceDialog.locator('button:not(:disabled), input:not(:disabled)');
  await focusable.first().focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await balanceDialog.evaluate((el) => el.contains(document.activeElement)), true);
  await page.keyboard.press('Escape'); await balanceDialog.waitFor({ state: 'hidden' });
  assert.equal(await mainDialog.isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Bakiye düzelt', exact: true }).evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press('Escape'); await mainDialog.waitFor({ state: 'hidden' });
  console.log('✓ Keyboard opens rows, nested dialogs trap focus, Escape closes only the top dialog and restores focus');

  failList = true; await page.reload(); await page.getByRole('alert').filter({ hasText: 'Müşteri listesi yüklenemedi' }).waitFor();
  assert.equal(await page.getByText('Kayıt yok', { exact: true }).count(), 0);
  failList = false; await page.getByRole('button', { name: 'Yeniden dene' }).click(); await row().waitFor();
  failDetail = true; await row().click(); await page.getByRole('alert').filter({ hasText: 'Müşteri ayrıntısı yüklenemedi' }).waitFor();
  failDetail = false; await page.getByRole('button', { name: 'Yeniden dene' }).click(); await page.getByRole('button', { name: 'Bakiye düzelt', exact: true }).waitFor(); await page.keyboard.press('Escape');
  console.log('✓ List and detail failures show retry controls instead of empty states');

  await page.goto(`${base}/menu`); await page.getByPlaceholder('Ürün ara').waitFor();
  const before = calls.filter((r) => r.path === '/admin/menu/products').length;
  await page.getByPlaceholder('Ürün ara').pressSequentially('latte', { delay: 20 });
  await waitFor(() => calls.some((r) => r.path === '/admin/menu/products' && new URLSearchParams(r.query).get('q') === 'latte'));
  assert.equal(calls.filter((r) => r.path === '/admin/menu/products').length, before + 1);
  console.log('✓ Typing a product search sends only the final debounced request');
  await page.getByRole('button', { name: 'Toplu fiyat', exact: true }).click();
  const bulkDialog = page.getByRole('dialog', { name: 'Toplu fiyat güncelleme', exact: true });
  await bulkDialog.getByLabel(/^Gerekçe/).fill('Bulk audit correction');
  await bulkDialog.getByRole('button', { name: 'Fiyatları güncelle', exact: true }).click();
  await bulkDialog.getByText('Uygulanamadı', { exact: true }).waitFor();
  await bulkDialog.getByRole('button', { name: 'Fiyatları güncelle', exact: true }).click();
  await bulkDialog.waitFor({ state: 'hidden' });
  const bulkCalls = calls.filter((r) => r.path === '/admin/menu/bulk-price');
  assert.equal(bulkCalls.length, 2); assert.equal(bulkCalls[0].body.idempotencyKey, bulkCalls[1].body.idempotencyKey); assert.equal(bulkRuns, 1);
  console.log('✓ A lost bulk-price response is safely retried with the original operation key');


  await page.goto(`${base}/yonetim`); await page.getByRole('button', { name: 'İşlem geçmişi', exact: true }).click();
  await page.getByRole('button', { name: 'Sonraki ›' }).click(); await page.getByText('51 kayıt · sayfa 2/2').waitFor();
  await page.locator('select').selectOption('Order'); await page.getByText('log-2', { exact: true }).waitFor({ state: 'hidden' });
  await waitFor(() => calls.some((r) => r.path === '/admin/audit' && r.query.includes('entity=Order')));
  assert.equal(new URLSearchParams(calls.filter((r) => r.path === '/admin/audit').at(-1).query).get('page'), '1');
  console.log('✓ Audit filters reset the current page before fetching narrowed results');

  await page.goto(`${base}/kampanyalar`); await page.getByRole('button', { name: 'Promosyon kodları', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'TEST' }).click();
  await page.getByLabel('İndirim (%)', { exact: true }).fill('15'); await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await waitFor(() => calls.some((r) => r.path === '/admin/promos' && r.method === 'POST'));
  assert.equal(Object.hasOwn(calls.filter((r) => r.path === '/admin/promos' && r.method === 'POST').at(-1).body, 'expiresAt'), false);
  await page.getByRole('row').filter({ hasText: 'TEST' }).click(); await page.getByLabel(/^Son kullanma tarihi/).selectOption('clear'); await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await waitFor(() => calls.filter((r) => r.path === '/admin/promos' && r.method === 'POST').length === 2);
  assert.equal(promo.expiresAt, null);
  console.log('✓ Editing a promo preserves expiry; only an explicit clear removes it');

  admin.mustChangePassword = true; admin.tempPasswordExpiresAt = '2099-01-01T00:00:00Z';
  const start = calls.length; await page.reload(); await page.getByRole('heading', { name: 'Şifrenizi değiştirin', exact: true }).waitFor();
  assert.equal(calls.slice(start).some((r) => !r.path.startsWith('/admin/auth/')), false);
  await page.getByLabel('Geçici şifre', { exact: true }).fill('old-password-123'); await page.locator('input[autocomplete="new-password"]').first().fill('new-password-123'); await page.getByLabel('Yeni şifre (tekrar)', { exact: true }).fill('new-password-123');
  await page.getByRole('button', { name: 'Şifreyi değiştir ve çıkış yap', exact: true }).click(); await page.getByRole('button', { name: 'Giriş yap', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('dd_admin_access')), null);
  console.log('✓ Temporary credentials cannot enter panel routes and changing password returns to sign-in');
  assert.deepEqual(unhandled, []);
  console.log('All isolated audit fixes passed. No live backend requests or database writes.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
