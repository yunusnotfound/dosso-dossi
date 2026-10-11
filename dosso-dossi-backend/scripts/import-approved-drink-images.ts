// Onaylanan içecekleri mevcut soğuk kahve görsellerinin ölçüsünde hazırlar.
// Çalıştır: npx tsx scripts/import-approved-drink-images.ts
// Yalnız dosyaları ve seed menüsünün görsel URL'lerini günceller; DB'ye yazmaz.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(backend, '../design-previews/soguk-cay-soft-icecekler');
const output = path.join(backend, 'uploads/products');
const menuPath = path.join(backend, 'prisma/seed-data/menu.json');
const ids = [
  'chai-tea-latte-freddo',
  'matcha-latte-freddo',
  'matcha-fragola-latte-freddo',
  'matcha-vaniglia-latte-freddo',
  'fanta-kutu',
  'soda-uludag',
  'soda-uludag-premium',
  'san-pellegrino',
  'sut-bardak',
];
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const menu = JSON.parse(await fs.readFile(menuPath, 'utf8')) as {
  products: Array<{ id: string; imageUrl: string | null; gridImageUrl?: string }>;
};

// Şeffaf alandaki çok düşük alfa artıkları ürünün kadrajını büyütmesin.
// Yalnız sınır hesabında eşik kullanılır; iç piksellerin alfası korunur.
async function productCrop(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + info.channels - 1]! <= 20) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error(`Görünür ürün yok: ${file}`);
  left = Math.max(0, left - 3); top = Math.max(0, top - 3);
  right = Math.min(info.width - 1, right + 3);
  bottom = Math.min(info.height - 1, bottom + 3);
  return sharp(file).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toBuffer();
}

for (const id of ids) {
  if (!menu.products.some((p) => p.id === id)) throw new Error(`Ürün bulunamadı: ${id}`);
  await fs.access(path.join(source, `${id}.png`));
}
await fs.mkdir(path.join(output, 'grid'), { recursive: true });

const result: Array<{ id: string; imageUrl: string; gridImageUrl: string }> = [];
for (const id of ids) {
  const crop = await productCrop(path.join(source, `${id}.png`));
  const detail = await sharp(crop)
    .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: transparent })
    .webp({ quality: 80 }).toBuffer();
  const fitted = await sharp(crop)
    .resize({ width: 614, height: 614, fit: 'inside', withoutEnlargement: true })
    .png().toBuffer();
  const grid = await sharp({ create: { width: 720, height: 720, channels: 4, background: transparent } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 80 }).toBuffer();
  await fs.writeFile(path.join(output, `${id}.webp`), detail);
  await fs.writeFile(path.join(output, 'grid', `${id}.webp`), grid);
  const hash = (buffer: Buffer) => createHash('md5').update(buffer).digest('hex').slice(0, 8);
  const urls = {
    id,
    imageUrl: `/media/products/${id}.webp?v=${hash(detail)}`,
    gridImageUrl: `/media/products/grid/${id}.webp?v=${hash(grid)}`,
  };
  Object.assign(menu.products.find((p) => p.id === id)!, urls);
  result.push(urls);
}
await fs.writeFile(menuPath, `${JSON.stringify(menu, null, 2)}\n`);
await fs.writeFile(path.join(source, 'published-assets.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(`${result.length} ürün için grid ve detay görselleri hazırlandı.`);
