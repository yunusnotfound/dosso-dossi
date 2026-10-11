// This suite uses an isolated Vite server and synthetic HTTP fixtures only.
// It never uploads to, logs in to, or writes to the running local backend.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:5297';
const apiBase = 'http://stories-regression.invalid';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5297', '--strictPort'], { cwd, env: { ...process.env, VITE_API_BASE: apiBase }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (value) => { log += value; });
server.stderr.on('data', (value) => { log += value; });
const fixturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+G0X8AAAAASUVORK5CYII=', 'base64');
const common = { description: 'Mevcut kampanyayı keşfet.', imageUrl: '', actionLabel: 'Keşfet', isActive: true, startsAt: null, endsAt: null, createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' };
let stories = [{ ...common, id: 'story-coffee', title: '5 damga, 1 ikram', action: 'kahve-ictikce', sortOrder: 0 }, { ...common, id: 'story-topup', title: 'Yükle Kazan', action: 'yukle-kazan', sortOrder: 1 }];
const requests = [];
const errors = [];
const checks = [];
let uploadGate;
let uploadArrived = false;
let expiredUpload = false;
let refreshCount = 0;
let browser;
function checked(name) { checks.push(name); console.log(`✓ ${name}`); }
async function waitUntil(fn, message) {
  const deadline = Date.now() + 10_000;
  while (!await fn()) { if (Date.now() > deadline) throw new Error(message); await new Promise((r) => setTimeout(r, 25)); }
}
try {
  await waitUntil(async () => { if (server.exitCode !== null) throw new Error(log); return fetch(base).then((res) => res.ok).catch(() => false); }, 'Isolated Vite server did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'Europe/Istanbul' });
  await context.addInitScript(() => {
    localStorage.setItem('dd_admin_access', 'SUPER_ADMIN-access');
    localStorage.setItem('dd_admin_refresh', 'SUPER_ADMIN-refresh');
    localStorage.setItem('dd_admin_session', 'fixture-session');
  });
  await context.route(`${apiBase}/**`, async (route) => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    const method = req.method();
    const raw = req.headers()['content-type']?.startsWith('image/');
    const body = raw ? null : req.postDataJSON();
    const token = req.headers().authorization?.replace('Bearer ', '') ?? '';
    requests.push({ pathname, method, body, raw, token });
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
    const json = (value, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(value) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (pathname === '/admin/auth/me') return json({ id: token.split('-')[0], email: 'fixture@example.invalid', name: 'Hikâye Yönetimi', role: token.split('-')[0], branchId: null });
    if (pathname === '/admin/auth/refresh') { refreshCount++; return json({ token: 'SUPER_ADMIN-rotated', refreshToken: 'SUPER_ADMIN-refresh-rotated' }); }
    if (pathname === '/admin/campaigns') return json([]);
    if (pathname.startsWith('/media/')) return route.fulfill({ status: 200, headers: { ...headers, 'Content-Type': 'image/png' }, body: fixturePng });
    if (pathname === '/admin/campaign-stories/image') {
      assert.equal(raw, true);
      assert.ok(req.postDataBuffer().length > 0);
      uploadArrived = true;
      if (uploadGate) await uploadGate.promise;
      if (expiredUpload && !token.endsWith('rotated')) return json({ error: { code: 'UNAUTHORIZED', message: 'Fixture expired token' } }, 401);
      return json({ imageUrl: '/media/campaign-stories/test.png' });
    }
    if (pathname === '/admin/campaign-stories') {
      if (method === 'GET') return json(stories);
      const item = { ...common, ...body, id: body.id ?? `story-${stories.length + 1}` };
      const index = stories.findIndex((s) => s.id === item.id);
      if (index >= 0) stories[index] = item; else stories.push(item);
      return json(item);
    }
    if (pathname.startsWith('/admin/campaign-stories/') && method === 'DELETE') { stories = stories.filter((s) => s.id !== pathname.split('/').at(-1)); return json({ ok: true }); }
    errors.push(`Unmocked ${method} ${pathname}`);
    return json({ error: { code: 'UNMOCKED', message: pathname } }, 404);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${base}/kampanyalar`);
  await page.getByRole('button', { name: 'Hikâyeler', exact: true }).click();
  await page.getByRole('article', { name: 'Hikâye: 5 damga, 1 ikram', exact: true }).waitFor();
  assert.equal(await page.locator('.story-ring').count(), 4);
  const ring = await page.locator('.story-ring').first().evaluate((el) => ({ shape: getComputedStyle(el).borderRadius, background: getComputedStyle(el).backgroundImage, center: getComputedStyle(el.firstElementChild).backgroundColor }));
  assert.equal(ring.shape, '50%'); assert.equal(ring.center, 'rgb(255, 255, 255)'); assert.ok(ring.background.includes('gradient'));
  checked('Existing campaigns appear with white circles and the orange gradient ring');
  await mkdir('/tmp/dosso-campaign-stories-admin', { recursive: true });
  await page.screenshot({ path: '/tmp/dosso-campaign-stories-admin/stories-overview.png', fullPage: true });

  const save = () => page.getByRole('button', { name: 'Hikâyeyi kaydet', exact: true }).click();
  const writes = () => requests.filter((r) => r.pathname === '/admin/campaign-stories' && r.method === 'POST');
  await page.getByRole('button', { name: 'Yeni hikâye', exact: true }).click();
  await save(); await page.getByRole('alert').filter({ hasText: 'Hikâye başlığını yazın.' }).waitFor();
  await page.getByLabel('Hikâye başlığı').fill('Yeni kahve seçkisi');
  await save(); await page.getByRole('alert').filter({ hasText: 'bir görsel yükleyin' }).waitFor();
  await page.getByLabel('Görsel yükle', { exact: true }).setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await page.getByRole('alert').filter({ hasText: 'PNG, JPEG veya WebP' }).waitFor();
  await page.getByLabel('Görsel yükle', { exact: true }).setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await page.getByRole('alert').filter({ hasText: 'en fazla 10 MB' }).waitFor();
  assert.equal(writes().length, 0);
  assert.equal(requests.filter((r) => r.pathname.endsWith('/image')).length, 0);
  checked('Missing artwork, invalid image types and oversized files are rejected before any write');

  expiredUpload = true;
  await page.getByLabel('Görsel yükle', { exact: true }).setInputFiles({ name: 'coffee.png', mimeType: 'image/png', buffer: fixturePng });
  await waitUntil(() => page.getByLabel('Görsel adresi').inputValue().then((v) => v === '/media/campaign-stories/test.png'), 'Upload did not populate image URL');
  assert.equal(refreshCount, 1);
  assert.equal(requests.filter((r) => r.pathname.endsWith('/image') && r.method === 'POST').length, 2);
  assert.equal(await page.locator('img[src$="/media/campaign-stories/test.png"]').count(), 1);
  checked('Raw image upload refreshes once and resolves the returned relative media URL');

  await page.getByLabel('Bağlantı hedefi').selectOption('online-magaza');
  await page.getByLabel('Düğme metni').fill('Seçkiyi incele');
  await page.getByLabel('Gösterim sırası').fill('2');
  await page.getByLabel('Yayın başlangıcı').fill('2027-03-10T10:00');
  await page.getByLabel('Yayın bitişi').fill('2027-03-09T10:00');
  await save(); await page.getByRole('alert').filter({ hasText: 'Bitiş, başlangıç' }).waitFor();
  assert.equal(writes().length, 0);
  await page.getByLabel('Yayın bitişi').fill('2027-03-12T10:00');
  await page.screenshot({ path: '/tmp/dosso-campaign-stories-admin/stories-editor.png', fullPage: true });
  await save();
  await page.getByRole('article', { name: 'Hikâye: Yeni kahve seçkisi', exact: true }).waitFor();
  assert.equal(writes().at(-1).body.startsAt, '2027-03-10T07:00:00.000Z');
  assert.equal(writes().at(-1).body.endsAt, '2027-03-12T07:00:00.000Z');
  assert.equal(writes().at(-1).body.action, 'online-magaza');
  assert.equal(writes().at(-1).body.imageUrl, '/media/campaign-stories/test.png');
  checked('Story creation keeps the selected campaign link, image, order and timezone-safe schedule');

  const coffee = page.getByRole('article', { name: 'Hikâye: 5 damga, 1 ikram', exact: true });
  await coffee.getByRole('button', { name: 'Düzenle', exact: true }).click();
  await page.getByLabel('Hikâye açıklaması').fill('Yeni kampanya açıklaması');
  await save();
  await coffee.getByText('Yeni kampanya açıklaması', { exact: true }).waitFor();
  assert.equal(writes().at(-1).body.id, 'story-coffee');
  assert.equal(writes().at(-1).body.imageUrl, '');
  await coffee.getByRole('button', { name: 'Yayından kaldır', exact: true }).click();
  await coffee.getByText('Taslak', { exact: true }).waitFor();
  await coffee.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await coffee.getByText('Yayında', { exact: true }).waitFor();
  checked('Built-in campaign artwork remains valid without an upload; editing and publish toggles work');

  await page.getByRole('button', { name: 'Yeni hikâye', exact: true }).click();
  uploadArrived = false;
  uploadGate = {};
  uploadGate.promise = new Promise((resolveGate) => { uploadGate.release = resolveGate; });
  await page.getByLabel('Görsel yükle', { exact: true }).setInputFiles({ name: 'late.png', mimeType: 'image/png', buffer: fixturePng });
  await waitUntil(() => uploadArrived, 'Deferred upload not started');
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.getByRole('button', { name: 'Yeni hikâye', exact: true }).click();
  uploadGate.release(); uploadGate = undefined;
  await waitUntil(() => page.getByRole('button', { name: 'Hikâyeyi kaydet' }).isEnabled(), 'New drawer still busy');
  assert.equal(await page.getByLabel('Görsel adresi').inputValue(), '');
  await page.keyboard.press('Escape');
  checked('Closing an uploading drawer prevents its response from populating the next draft');

  uploadArrived = false;
  uploadGate = {};
  uploadGate.promise = new Promise((resolveGate) => { uploadGate.release = resolveGate; });
  await page.evaluate(() => { window.oldStoryUpload = import('/src/api/client.ts').then(({ upload }) => upload('/admin/campaign-stories/image', new Blob(['fixture'], { type: 'image/png' }))).then(() => 'incorrect-success', (error) => error.code); });
  await waitUntil(() => uploadArrived, 'Session-bound upload not started');
  await page.evaluate(() => import('/src/api/client.ts').then(({ tokens }) => tokens.replace('MANAGER-access', 'MANAGER-refresh')));
  uploadGate.release(); uploadGate = undefined;
  assert.equal(await page.evaluate(() => window.oldStoryUpload), 'SESSION_CHANGED');
  checked('A late upload cannot cross into a replacement account session');

  const custom = page.getByRole('article', { name: 'Hikâye: Yeni kahve seçkisi', exact: true });
  await custom.getByRole('button', { name: 'Sil', exact: true }).click();
  assert.equal(stories.length, 3);
  await custom.getByRole('button', { name: 'Silmeyi onayla', exact: true }).click();
  await waitUntil(() => custom.count().then((n) => n === 0), 'Deleted story remained in list');
  assert.equal(stories.length, 2);
  checked('Deleting a story requires the concrete confirmation and refreshes the list');

  for (const role of ['VIEWER', 'BRANCH_MANAGER']) {
    await page.evaluate((role) => { localStorage.setItem('dd_admin_access', `${role}-access`); localStorage.setItem('dd_admin_refresh', `${role}-refresh`); localStorage.setItem('dd_admin_session', role); window.dispatchEvent(new StorageEvent('storage', { key: 'dd_admin_session', newValue: role })); }, role);
    await page.getByRole('button', { name: 'Hikâyeler', exact: true }).click();
    await page.getByText('Salt okunur', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Yeni hikâye', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Düzenle', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Yayından kaldır|Yayınla|Silmeyi onayla/ }).count(), 0);
  }
  checked('Viewer and branch-manager roles can inspect stories without any mutation controls');
  assert.deepEqual(errors, []);
  console.log(`\n${checks.length} isolated story regressions passed. All API requests mocked.`);
} catch (error) {
  console.error(error, { errors, lastRequests: requests.slice(-5) });
  process.exitCode = 1;
} finally {
  uploadGate?.release();
  await browser?.close();
  server.kill('SIGTERM');
}
