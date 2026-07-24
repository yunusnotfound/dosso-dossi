import { beforeEach, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';

const TABLES = [
  'PosEvent',
  'PosCharge',
  'PaymentIntent',
  'RefreshToken',
  'OtpCode',
  'WalletTransaction',
  'LoyaltyEvent',
  'OrderItem',
  'Order',
  'Gift',
  'QrToken',
  'NotificationPrefs',
  'LoyaltyAccount',
  'Wallet',
  'User',
  'BranchProduct',
  'Product',
  'Category',
  'Branch',
  'Campaign',
  'PromoCode',
];

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1042`,
  );
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`,
  );
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE order_number_seq RESTART WITH 1042`);
  await seedFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/// Testlerin ortak sabitleri: 1 şube, 3 ürün, 1 promo kod
async function seedFixtures(): Promise<void> {
  await prisma.branch.create({
    data: {
      id: 'beylikduzu-vadi-loca',
      name: 'Beylikdüzü Vadi Loca',
      address: 'Test Adres',
      city: 'İstanbul',
      lat: 41.0021,
      lng: 28.6543,
      hours: '08:00–01:00',
      isOpen: true,
      prepMinutes: 7,
    },
  });
  await prisma.category.create({
    data: { id: 'sicak-kahveler', name: 'Sıcak Kahveler', sortOrder: 0 },
  });
  await prisma.category.create({
    data: { id: 'merch', name: 'Termos & Mug', sortOrder: 1 },
  });
  await prisma.product.createMany({
    data: [
      {
        id: 'caffe-latte',
        name: 'Caffe Latte',
        price: 190,
        categoryId: 'sicak-kahveler',
        stampMultiplier: 1,
        hasOptions: true,
      },
      {
        id: 'caramel-macchiato',
        name: 'Caramel Macchiato',
        price: 250,
        categoryId: 'sicak-kahveler',
        stampMultiplier: 1,
        hasOptions: true,
      },
      {
        id: 'mug-konik',
        name: 'Mug Konik',
        price: 390,
        categoryId: 'merch',
        stampMultiplier: 0,
        hasOptions: false,
      },
    ],
  });
  await prisma.promoCode.create({ data: { code: 'DOSSO10', discountRate: 0.1 } });
}
