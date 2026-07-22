/// Flutter mock menüsünü (mock_menu_repository.dart) parse edip
/// prisma/seed-data/menu.json üretir. Dart dosyası mock'ların kaynağı olarak
/// kalır; bu JSON seed için commit'lenen anlık görüntüdür.
///
/// Kullanım: npm run extract:menu
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dartFile = path.resolve(
  here,
  '../../dosso-dossi-app/lib/features/order/data/mock_menu_repository.dart',
);
const outFile = path.resolve(here, '../prisma/seed-data/menu.json');

const source = fs.readFileSync(dartFile, 'utf8');

// Dart _slug() ile birebir aynı
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

// Dart _p() içindeki kategori varsayılanları ile birebir aynı
const coffeeCategories = new Set(['sicak-kahveler', 'aromali-kahveler', 'soguk-kahveler']);
const descriptions: Record<string, string> = {
  'sicak-kahveler': 'Taze kavrulmuş çekirdeklerle, sipariş üzerine hazırlanır.',
  'aromali-kahveler': 'Ev yapımı şuruplarla hazırlanan imza kahve.',
  'sicak-cikolatalar': 'Yoğun çikolata, buharda ısıtılmış süt.',
  caylar: 'Demleme ve latte çay çeşitleri.',
  'soguk-kahveler': 'Buz üzerine, ferahlatıcı soğuk kahve.',
  'soguk-caylar': 'Buz gibi servis edilir.',
  'soguk-cikolatali': 'Soğuk çikolata keyfi.',
  'soguk-meyveli': 'Taze meyveli, buz gibi.',
  'soft-icecekler': 'Soğuk servis edilir.',
  kahvalti: 'Her sabah taze pişer.',
  tatlilar: 'Günlük üretim, el yapımı tatlı.',
  'kek-kurabiye': 'Günlük üretim, el yapımı.',
  'sandvic-tost': 'Sipariş üzerine taze hazırlanır.',
  atistirmalik: 'Yanında götürmelik atıştırmalık.',
  cekirdek: 'Evinde Dosso Dossi keyfi — taze kavrulmuş çekirdek.',
  merch: 'Dosso Dossi tasarım ürünü.',
};

// ── Kategoriler ─────────────────────────────────────────────────────
const categoryRe = /MenuCategory\(id:\s*'([^']+)',\s*name:\s*'([^']+)'\)/g;
const categories: Array<{ id: string; name: string; sortOrder: number }> = [];
for (const m of source.matchAll(categoryRe)) {
  categories.push({ id: m[1]!, name: m[2]!, sortOrder: categories.length });
}

// ── Ürünler: _p(...) çağrılarını dengeli parantezle ayıkla ──────────
const products: Array<Record<string, unknown>> = [];
const callStarts = [...source.matchAll(/_p\(/g)]
  // fonksiyon tanımındaki "Product _p(" hariç
  .filter((m) => !source.slice(Math.max(0, m.index - 20), m.index).includes('Product '));

for (const start of callStarts) {
  let depth = 0;
  let end = start.index;
  for (let i = start.index + 3; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ']') depth--;
    else if (ch === ')') {
      if (depth === 0) {
        end = i;
        break;
      }
      depth--;
    }
  }
  const argsRaw = source.slice(start.index + 3, end);

  // Dart string'leri tek ya da çift tırnaklı olabilir ("Macaron 6'lı")
  const str = `(?:'([^']*)'|"([^"]*)")`;
  const positional = argsRaw.match(
    new RegExp(`^\\s*${str},\\s*${str},\\s*([\\d.]+)`),
  );
  if (!positional) {
    throw new Error(`Çözümlenemeyen _p çağrısı: ${argsRaw.slice(0, 80)}`);
  }
  const categoryId = (positional[1] ?? positional[2])!;
  const name = (positional[3] ?? positional[4])!;
  const price = Number(positional[5]!);

  const named = (key: string): string | undefined =>
    argsRaw.match(new RegExp(`${key}:\\s*(true|false|\\d+|'[^']*'|"[^"]*")`))?.[1];
  const namedStr = (key: string): string | undefined => {
    const v = named(key);
    return v && (v.startsWith("'") || v.startsWith('"')) ? v.slice(1, -1) : undefined;
  };

  products.push({
    id: slug(name),
    name,
    price,
    categoryId,
    description: namedStr('desc') ?? descriptions[categoryId] ?? '',
    imageUrl: null,
    sizeMl: Number(named('ml') ?? 0),
    stampMultiplier: coffeeCategories.has(categoryId) ? 1 : 0,
    isNew: named('isNew') === 'true',
    isFeatured: named('featured') === 'true',
    hasOptions: named('options') === 'true',
  });
}

// Slug çakışması = veri hatası; seed'den önce yakala
const ids = new Set<string>();
for (const p of products) {
  if (ids.has(p.id as string)) throw new Error(`Slug çakışması: ${p.id}`);
  ids.add(p.id as string);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify({ categories, products }, null, 2)}\n`);
console.log(`✓ ${categories.length} kategori, ${products.length} ürün → ${outFile}`);
