import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import { webCommandConfiguration } from '../../src/config/web.js';
import { saveWebMedia } from '../../src/features/web/media.js';
import { saveProduct } from '../../src/features/web/catalog.service.js';
import { productInput } from '../../src/features/web/catalog.schemas.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
async function main(): Promise<void> {
  const config = webCommandConfiguration(process.env);
  const database = new PrismaClient({ datasourceUrl: config.WEB_DATABASE_URL });
  try {
    const seedCoffee = async () => {
      if (await database.webProduct.findUnique({ where: { slug: 'turkish-coffee' } })) return;
      const filename = 'turkish-coffee-250.webp';
      const media = await saveWebMedia(database, filename, fs.readFileSync(path.resolve('../dosso-dossi-web/public/images/products', filename)), 'image/webp');
      await saveProduct(database, productInput.parse({
        slug: 'turkish-coffee', type: 'COFFEE', status: 'PUBLISHED', nameTr: 'Türk Kahvesi', nameEn: 'Turkish Coffee',
        descriptionTr: 'Geleneksel Türk kahvesi ritüeli için 250 g paket. Fiyat örnektir; satış henüz açık değildir.',
        descriptionEn: 'A 250 g pack for the Turkish coffee ritual. Sample price; ordering is not yet available.', sortOrder: 0,
        images: [{ mediaId: media.id, altTr: 'Dosso Dossi Türk Kahvesi 250 g', altEn: 'Dosso Dossi Turkish Coffee 250 g', sortOrder: 0 }],
        variants: [{ sku: 'DD-WEB-TK-250', labelTr: '250 g', labelEn: '250 g', weightGrams: 250, priceMinor: 35000, stock: 0, active: true, imageId: media.id }],
        grindOptions: [{ code: 'turkish', nameTr: 'Türk kahvesi öğütümü', nameEn: 'Turkish coffee grind', priceDeltaMinor: 0, sortOrder: 0, active: true }],
      }), null);
    };
    const seedThermos = async () => {
      if (await database.webProduct.findUnique({ where: { slug: 'dosso-dossi-thermos' } })) return;
      const colors = [
        { code: 'orange', tr: 'Turuncu', en: 'Orange', hex: '#ed6b30' },
        { code: 'cream', tr: 'Krem', en: 'Cream', hex: '#e8decc' },
        { code: 'pink', tr: 'Pembe', en: 'Pink', hex: '#dda3b1' },
        { code: 'green', tr: 'Yeşil', en: 'Green', hex: '#9da977' },
      ];
      const media: Array<{ id: string; url: string }> = [];
      for (const color of colors) {
        const filename = `thermos-${color.code}.webp`;
        media.push(await saveWebMedia(database, filename, fs.readFileSync(path.resolve('../dosso-dossi-web/public/images/products', filename)), 'image/webp'));
      }
      await saveProduct(database, productInput.parse({
        slug: 'dosso-dossi-thermos', type: 'THERMOS', status: 'PUBLISHED', nameTr: 'Dosso Dossi Termos', nameEn: 'Dosso Dossi Thermos',
        descriptionTr: 'Kahve molanı yanında taşı. Fiyat örnektir; satış henüz açık değildir.',
        descriptionEn: 'Take your coffee moment with you. Sample price; ordering is not yet available.', sortOrder: 1,
        images: colors.map((color, index) => ({ mediaId: media[index]!.id, altTr: `${color.tr} Dosso Dossi termos`, altEn: `${color.en} Dosso Dossi thermos`, sortOrder: index })),
        variants: colors.map((color, index) => ({ sku: `DD-WEB-THERMOS-${color.code.toUpperCase()}`, labelTr: color.tr, labelEn: color.en, colorNameTr: color.tr, colorNameEn: color.en, colorHex: color.hex, priceMinor: 89000, stock: 0, active: true, imageId: media[index]!.id })),
        grindOptions: [],
      }), null);
    };
    await seedCoffee();
    await seedThermos();
    console.info('Web örnek kataloğu hazır. Mevcut ürünler korunmuştur; yeni örnek ürünlerin stoğu sıfırdır.');
  } finally { await database.$disconnect(); }
}
main().catch(() => { console.error('Web katalog seed tamamlanamadı; ayrı web DB migration durumunu ve yerel ürün görsellerini kontrol edin.'); process.exitCode = 1; });
