/// Panelin uçtan uca duman testi: giriş → tüm modüller → çıkış.
/// Sistemde kurulu Chrome'u kullanır (ayrı tarayıcı indirmez).
///
///   ADMIN_EMAIL=... ADMIN_PASSWORD=... node e2e/smoke.mjs [--headed]
import { chromium } from 'playwright';

const BASE = process.env.PANEL_URL ?? 'http://localhost:5173';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const SHOT_DIR = process.env.SHOT_DIR ?? '.';

if (!EMAIL || !PASSWORD) {
  console.error('ADMIN_EMAIL ve ADMIN_PASSWORD gerekli');
  process.exit(1);
}

const fails = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(name);
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !process.argv.includes('--headed'),
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

/// Tablo başlıkları CSS ile büyütülüyor; innerText dönüşmüş metni verir.
/// Bu yüzden karşılaştırma Türkçe yerelde küçük harfe indirilerek yapılır.
const lower = (s) => s.toLocaleLowerCase('tr');

/// Sol menüden bir modüle geçer ve beklenen içeriği doğrular.
async function visit(label, heading, expectTexts) {
  await page.getByRole('link', { name: label }).click();
  await page.getByRole('heading', { name: heading }).waitFor({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  const body = lower(await page.locator('body').innerText());
  const missing = expectTexts.filter((t) => !body.includes(lower(t)));
  check(`${label} açılıyor`, missing.length === 0, missing.join(', '));
  return body;
}

/// Sekmeye geçip beklenen metnin GERÇEKTEN gelmesini bekler.
/// networkidle yarışa açık: istek daha başlamadan "boşta" sayılabiliyor.
async function tab(name, expectText, checkName) {
  await page.getByRole('button', { name }).click();
  try {
    await page.getByText(expectText, { exact: false }).first().waitFor({ timeout: 15_000 });
    check(checkName, true);
  } catch {
    check(checkName, false, `"${expectText}" görünmedi`);
  }
}

/// "Dışa aktar" menüsünden bir dosyayı indirir ve gerçekten geldiğini
/// doğrular. Bu, düz <a href> ile 401 alan eski davranışın nöbetçisi.
async function downloadCheck(itemLabel, checkName, namePattern) {
  try {
    await page.getByRole('button', { name: 'Dışa aktar' }).click();
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      page.getByRole('button', { name: new RegExp(itemLabel, 'i') }).click(),
    ]);
    const name = dl.suggestedFilename();
    const path = await dl.path();
    const { size } = await import('node:fs').then((fs) => fs.promises.stat(path));
    const ok = namePattern.test(name) && size > 500;
    check(checkName, ok, `${name} · ${size} bayt`);
  } catch (e) {
    check(checkName, false, String(e).slice(0, 140));
  }
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('giriş ekranı açılıyor', await page.getByText('Yönetim Paneli').isVisible());
  await page.screenshot({ path: `${SHOT_DIR}/01-login.png` });

  // Hatalı şifre reddedilmeli
  await page.getByLabel('E-posta').fill(EMAIL);
  await page.getByLabel('Şifre').fill('kesinlikle-yanlis-sifre');
  await page.getByRole('button', { name: /giriş yap/i }).click();
  const alert = page.getByRole('alert');
  await alert.waitFor({ timeout: 10_000 });
  check('hatalı şifre reddediliyor', await alert.isVisible(), await alert.innerText());
  consoleErrors.length = 0; // beklenen 401 gürültüsü

  // Giriş
  await page.getByLabel('Şifre').fill(PASSWORD);
  await page.getByRole('button', { name: /giriş yap/i }).click();
  await page.getByRole('heading', { name: 'Panel' }).waitFor({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  check('giriş başarılı, panel açıldı', true);

  const dash = lower(await page.locator('body').innerText());
  check(
    'dashboard KPI’ları dolu',
    ['Ciro', 'Sipariş', 'Bakiye yükleme', 'Dağıtılan damga'].every((t) => dash.includes(lower(t))),
  );
  check('grafikler çizildi', (await page.locator('svg.recharts-surface').count()) >= 2);
  await page.screenshot({ path: `${SHOT_DIR}/02-dashboard.png`, fullPage: true });

  // ── Modüller ──
  await visit('Siparişler', 'Siparişler', ['Canlı pano', 'Alındı', 'Hazırlanıyor', 'Hazır']);
  await downloadCheck('Excel raporu', 'sipariş Excel indirmesi', /\.xlsx$/);
  await page.screenshot({ path: `${SHOT_DIR}/03-siparisler.png`, fullPage: true });

  const menuBody = await visit('Menü', 'Menü', ['Ürünler', 'Kategoriler', 'Opsiyonlar']);
  check('menüde ürünler listeleniyor', menuBody.includes(lower('Latte')));
  await tab('Opsiyonlar', 'Yulaf sütü', 'opsiyon fiyatları DB’den geliyor');
  await page.screenshot({ path: `${SHOT_DIR}/04-menu.png`, fullPage: true });

  const branchBody = await visit('Şubeler', 'Şubeler', ['Şube', 'Hazırlık', 'Durum']);
  check('şubeler listeleniyor', branchBody.includes(lower('Beylikdüzü')));

  // Gerçek yazma yolu: şubeyi kapat, kapandığını gör, geri aç.
  // Bu aynı zamanda audit defterine kayıt düşürür.
  const openBadge = page.getByRole('button', { name: 'Açık' }).first();
  await openBadge.click();
  try {
    await page.getByRole('button', { name: 'Kapalı' }).first().waitFor({ timeout: 10_000 });
    check('şube kapatılabiliyor (yazma yolu)', true);
    await page.getByRole('button', { name: 'Kapalı' }).first().click();
    await page.getByRole('button', { name: 'Açık' }).first().waitFor({ timeout: 10_000 });
    check('şube geri açılıyor', true);
  } catch (e) {
    check('şube kapatılabiliyor (yazma yolu)', false, String(e).slice(0, 120));
  }
  await page.screenshot({ path: `${SHOT_DIR}/05-subeler.png`, fullPage: true });

  await visit('Kampanyalar', 'Kampanyalar', ['Promosyon kodları', 'Sadakat kuralları']);
  await tab('Sadakat kuralları', 'Yalnız ilk yükleme', 'sadakat ayarları panelden yönetiliyor');
  await page.screenshot({ path: `${SHOT_DIR}/06-kampanyalar.png`, fullPage: true });

  await visit('Müşteriler', 'Müşteriler', ['Bakiye', 'Damga', 'Harcama']);
  await page.screenshot({ path: `${SHOT_DIR}/07-musteriler.png`, fullPage: true });

  await visit('Finans', 'Finans', ['Cüzdan defteri', 'Yüklemeler', 'QR tahsilatları', 'Mutabakat']);
  await downloadCheck('Excel defteri', 'defter Excel indirmesi', /\.xlsx$/);
  await downloadCheck('CSV', 'defter CSV indirmesi', /\.csv$/);
  await tab('Mutabakat', 'POS eşleşen', 'mutabakat raporu geliyor');
  await page.screenshot({ path: `${SHOT_DIR}/08-finans.png`, fullPage: true });

  await visit('POS İzleme', 'POS İzleme', ['Sağlık', 'Olay defteri']);
  await page.screenshot({ path: `${SHOT_DIR}/09-pos.png`, fullPage: true });

  const adminBody = await visit('Yönetim', 'Yönetim', ['Yöneticiler', 'İşlem geçmişi']);
  check('yönetici listesi dolu', adminBody.includes(lower(EMAIL)));
  await tab('İşlem geçmişi', 'Gerekçe', 'audit kayıtları görünüyor');
  await page.screenshot({ path: `${SHOT_DIR}/10-yonetim.png`, fullPage: true });

  // Oturum kalıcılığı ve çıkış
  await page.reload({ waitUntil: 'networkidle' });
  check('sayfa yenilenince oturum korunuyor', !(await page.getByLabel('Şifre').isVisible()));

  await page.getByRole('button', { name: /çıkış yap/i }).click();
  await page.getByLabel('Şifre').waitFor({ timeout: 10_000 });
  check('çıkış sonrası giriş ekranına dönülüyor', true);

  await page.reload({ waitUntil: 'networkidle' });
  check('çıkış kalıcı', await page.getByLabel('Şifre').isVisible());

  check('tarayıcı konsolunda hata yok', consoleErrors.length === 0, consoleErrors[0] ?? '');
} catch (err) {
  check('beklenmeyen hata', false, String(err));
  await page.screenshot({ path: `${SHOT_DIR}/99-hata.png` }).catch(() => {});
} finally {
  await browser.close();
}

console.log(fails.length === 0 ? '\nTÜMÜ GEÇTİ' : `\nBAŞARISIZ: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
