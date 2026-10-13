import fs from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { getCustomerMailConfiguration } from '../src/features/web/customer-mail.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

async function main() {
  if (getCustomerMailConfiguration().delivery !== 'preview') {
    throw new Error('Bu komut yalnız WEB_EMAIL_MODE=preview ile kullanılır.');
  }
  const directory = path.resolve('.local/web-emails');
  const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const previews = await Promise.all(files.filter(file => /^[a-f0-9-]+\.html$/.test(file)).map(async file => {
    const filename = path.join(directory, file);
    return { filename, modified: (await stat(filename)).mtimeMs };
  }));
  previews.sort((a, b) => b.modified - a.modified);
  if (!previews.length) {
    console.log('Henüz e-posta önizlemesi yok. Web sitesinde kayıt veya bağlantı talebi oluşturun.');
    return;
  }
  console.log('Yerel e-posta önizlemesi — gerçek e-posta gönderilmedi.');
  console.log(previews[0]!.filename);
}

main().catch(() => {
  console.error('Yerel önizleme okunamadı. WEB_EMAIL_MODE ve .local/web-emails klasörünü kontrol edin.');
  process.exitCode = 1;
});
