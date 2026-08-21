/// Ürün fotoğraflarını optimize eder ve menüye bağlar.
///
/// Kaynak klasördeki (varsayılan: ~/Desktop/ürünler) ham PNG'leri ürün
/// kimliğine (slug) eşler, 1000px WebP'ye küçültüp uploads/products/ altına
/// yazar ve seed-data/menu.json'daki imageUrl alanlarını günceller.
///
/// Kullanım: npm run optimize:images [-- /başka/kaynak/klasör]
/// Sıralama önemli: extract:menu → optimize:images → prisma:seed
/// (extract:menu, menu.json'u imageUrl:null ile yeniden üretir.)
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));

// --grid <klasör>: sipariş grid'i için kare vitrin fotoğrafları işlenir
// (kırpma yok, 640x640 cover, gridImageUrl alanına yazar). Bayraksız mod
// detay görsellerini işler (trim + 960, imageUrl alanına yazar).
const args = process.argv.slice(2);
const gridMode = args[0] === '--grid';
const srcDir =
  (gridMode ? args[1] : args[0]) ?? path.join(os.homedir(), 'Desktop', 'ürünler');
const outDir = path.resolve(
  here,
  gridMode ? '../uploads/products/grid' : '../uploads/products',
);
const urlPrefix = gridMode ? '/media/products/grid' : '/media/products';
const urlField = gridMode ? 'gridImageUrl' : 'imageUrl';
const menuFile = path.resolve(here, '../prisma/seed-data/menu.json');

// extract-menu.ts slug() ile birebir aynı
function slug(value: string): string {
  const turkish: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  let out = '';
  for (const ch of value.split('')) {
    out += turkish[ch] ?? ch.toLowerCase();
  }
  return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/// Fotoğraf dosya adı slug'ı → menü ürün kimliği (ad farklılıkları).
const ALIASES: Record<string, string> = {
  'beyaz-cik-brownie': 'beyaz-cikolatali-brownie',
  'beyaz-cik-newyork-roll-kruvasan': 'newyork-roll-kruvasan-beyaz-cikolatali',
  'sutlu-cik-newyork-roll-kruvasan': 'newyork-roll-kruvasan-cikolatali',
  'casa-lemone': 'casa-limone',
  danish: 'danish-uzumlu',
  'fistikli-magnolia': 'magnolia-fistikli',
  'mangolu-magnolia': 'magnolia-mangolu',
  'glutensiz-havuclu-cevizli-kek': 'glutensiz-havuclu-kek',
  'glutensiz-mermer-kek': 'glutensiz-mozaik-kek',
  'hindi-fumeli-sandvic': 'panini-hindi-fume-sandvic',
  'las-vegas-3-peynirli-bagel': 'las-vegas-uc-peynirli-bagel',
  macaron: 'macaron-6-li',
  'mango-eleganza': 'mango',
  'red-velvet': 'red-velvet-pasta',
  'cikolatali-cookie': 'sweet-cikolatali-cookie',
};

/// Mükerrer çekimler — kullanılmayacak dosyalar.
const SKIP = new Set([
  'beyaz-cik-brownie-2',
  'beyaz-c-ik-brownie-2',
  'panini-izgara-tavuklu-sandvic-2',
  'havuclu-kek-46',
]);

interface MenuProduct {
  id: string;
  imageUrl: string | null;
  gridImageUrl?: string | null;
  [key: string]: unknown;
}

async function main() {
  const menu = JSON.parse(fs.readFileSync(menuFile, 'utf8')) as {
    products: MenuProduct[];
  };
  const byId = new Map(menu.products.map((p) => [p.id, p]));
  // Bazı dışa aktarımlar Türkçe harfleri bozup araya '_' sokuyor
  // ("Havuçlu" → "Havuc_lu"). Tire çıkarılmış ikinci bir dizin bu tür
  // adları da yakalar ("havuc-lu-kek" → "havuclukek" → havuclu-kek).
  const dashless = (v: string) => v.replaceAll('-', '');
  const byDashless = new Map(menu.products.map((p) => [dashless(p.id), p]));
  const aliasDashless = new Map(
    Object.entries(ALIASES).map(([k, v]) => [dashless(k), v]),
  );
  fs.mkdirSync(outDir, { recursive: true });

  const unmatched: string[] = [];
  const duplicates: string[] = [];
  const done = new Set<string>();
  let written = 0;
  let skipped = 0;

  for (const file of fs.readdirSync(srcDir).filter((f) => /\.png$/i.test(f))) {
    // macOS dosya adlarını NFD saklar; Türkçe harf haritası NFC bekler.
    // Bazı dışa aktarımlar başa zaman damgası ekler ("1787..._Ad.png").
    const base = file
      .replace(/\.png$/i, '')
      .replace(/^\d+_/, '')
      .normalize('NFC');
    const s = slug(base);
    if (SKIP.has(s)) {
      skipped++;
      continue;
    }
    const aliased = ALIASES[s] ?? aliasDashless.get(dashless(s));
    const product =
      byId.get(aliased ?? s) ?? (aliased ? undefined : byDashless.get(dashless(s)));
    if (!product) {
      unmatched.push(`${file} → ${s}`);
      continue;
    }
    // Aynı ürüne birden fazla dosya düşerse ("Ad (2).png") ilkini kullan.
    if (done.has(product.id)) {
      duplicates.push(`${file} → ${product.id} (atlandı)`);
      continue;
    }
    done.add(product.id);
    const outFile = path.join(outDir, `${product.id}.webp`);
    const pipeline = sharp(path.join(srcDir, file));
    if (gridMode) {
      // Kare vitrin: fon zaten kadrajın parçası, kırpmadan tam kare doldur.
      await pipeline
        .resize({ width: 640, height: 640, fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(outFile);
    } else {
      // Detay: geniş boş kenarları at, ürün kadraja dolsun; küçük şeffaf pay.
      await pipeline
        .trim({ threshold: 25 })
        .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
        .extend({
          top: 20,
          bottom: 20,
          left: 20,
          right: 20,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 80 })
        .toFile(outFile);
    }
    // İçerik hash'i URL'de: fotoğraf değişince URL değişir, cihazlardaki
    // 1 yıllık immutable önbellek kendiliğinden kırılır.
    const hash = crypto
      .createHash('md5')
      .update(fs.readFileSync(outFile))
      .digest('hex')
      .slice(0, 8);
    product[urlField] = `${urlPrefix}/${product.id}.webp?v=${hash}`;
    written++;
  }

  fs.writeFileSync(menuFile, `${JSON.stringify(menu, null, 2)}\n`);

  const withImage = menu.products.filter((p) => p[urlField] != null).length;
  console.log(
    `✓ [${gridMode ? 'grid' : 'detay'}] ${written} webp yazıldı → ${outDir} (${skipped} listeden atlandı)`,
  );
  console.log(`${urlField} dolu ürün: ${withImage}/${menu.products.length}`);
  if (duplicates.length) {
    console.log(`Aynı ürüne mükerrer dosya (${duplicates.length}):\n  ${duplicates.join('\n  ')}`);
  }
  if (unmatched.length) {
    console.warn(`⚠ Eşleşmeyen ${unmatched.length} dosya:\n  ${unmatched.join('\n  ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
