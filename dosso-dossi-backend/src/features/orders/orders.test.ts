import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login } from '../../test/helpers.js';

const app = createApp();
const PHONE = '05551112233';

async function loginAndTopUp(amount: number): Promise<string> {
  const token = await login(app, PHONE);
  await request(app)
    .post('/me/wallet/topup')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount });
  return token;
}

function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 'beylikduzu-vadi-loca',
    pickupSlot: '12:30',
    items: [{ productId: 'caffe-latte', quantity: 1 }],
    payment: { method: 'dosso_card' },
    ...overrides,
  };
}

describe('orders', () => {
  it('fiyatı sunucu hesaplar: opsiyon farkları + promo indirimi', async () => {
    const token = await loginAndTopUp(500);
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(
        orderBody({
          items: [
            {
              productId: 'caramel-macchiato',
              quantity: 1,
              milk: 'Yulaf sütü',
              shot: 'Çift shot',
            },
          ],
          promoCode: 'DOSSO10',
        }),
      );
    expect(res.status).toBe(201);
    // 250 + 60 (yulaf) + 40 (çift shot) = 350; %10 indirim → 315
    expect(res.body.subtotal).toBe(350);
    expect(res.body.discount).toBe(35);
    expect(res.body.total).toBe(315);
    expect(res.body.stampsEarned).toBe(1);
    expect(res.body.id).toBe('DD-1042');

    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(185);
    const tx = await prisma.walletTransaction.findFirstOrThrow({
      where: { type: 'ORDER_PAYMENT' },
    });
    expect(Number(tx.amount)).toBe(-315);
  });

  it('yetersiz bakiyede hiçbir kayıt değişmez (transaction bütünlüğü)', async () => {
    const token = await loginAndTopUp(100);
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderBody());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(100);
    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.stamps).toBe(0);
  });

  it('damga hedefi dolunca ikrama çevrilir (3+3 → 1 damga + 1 ikram)', async () => {
    // 1000₺ yükleme bonus ikram verirdi; testte eşiğin altında kal
    const token = await loginAndTopUp(600);
    await prisma.loyaltyAccount.updateMany({ data: { stamps: 3 } });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderBody({ items: [{ productId: 'caffe-latte', quantity: 3 }] }));
    expect(res.status).toBe(201);
    expect(res.body.stampsEarned).toBe(3);

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.stamps).toBe(1);
    expect(loyalty.freeDrinks).toBe(1);
    expect(
      await prisma.loyaltyEvent.count({ where: { type: 'REWARD_EARNED' } }),
    ).toBe(1);
  });

  it('ikram: hakkı yoksa NO_FREE_DRINK, varsa en pahalı içecek bedava', async () => {
    // Bonus eşiğinin altında yükle ki freeDrinks 0'dan başlasın
    const token = await loginAndTopUp(900);
    const auth = ['Authorization', `Bearer ${token}`] as const;

    const denied = await request(app)
      .post('/orders')
      .set(...auth)
      .send(orderBody({ useFreeDrink: true }));
    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe('NO_FREE_DRINK');

    await prisma.loyaltyAccount.updateMany({ data: { freeDrinks: 1 } });
    const res = await request(app)
      .post('/orders')
      .set(...auth)
      .send(
        orderBody({
          items: [
            { productId: 'caffe-latte', quantity: 1 },
            { productId: 'caramel-macchiato', quantity: 1 },
          ],
          useFreeDrink: true,
        }),
      );
    expect(res.status).toBe(201);
    // En pahalı damgalı içecek (250) bedava: 440 - 250 = 190
    expect(res.body.freeDrinkDiscount).toBe(250);
    expect(res.body.total).toBe(190);

    const loyalty = await prisma.loyaltyAccount.findFirstOrThrow();
    expect(loyalty.freeDrinks).toBe(0);
    const freeItem = await prisma.orderItem.findFirstOrThrow({
      where: { isFreeDrink: true },
    });
    expect(freeItem.productId).toBe('caramel-macchiato');
  });

  it('kapalı şube BRANCH_CLOSED döner', async () => {
    const token = await loginAndTopUp(500);
    await prisma.branch.updateMany({ data: { isOpen: false } });
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderBody());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BRANCH_CLOSED');
  });

  it('şubede müsait olmayan ürün PRODUCT_UNAVAILABLE döner', async () => {
    const token = await loginAndTopUp(500);
    await prisma.branchProduct.create({
      data: {
        branchId: 'beylikduzu-vadi-loca',
        productId: 'caffe-latte',
        isAvailable: false,
      },
    });
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderBody());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('şube fiyat override uygulanır (priceOverride)', async () => {
    const token = await loginAndTopUp(500);
    await prisma.branchProduct.create({
      data: {
        branchId: 'beylikduzu-vadi-loca',
        productId: 'caffe-latte',
        priceOverride: 210,
      },
    });
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderBody());
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(210);
  });

  it('geçersiz promo INVALID_PROMO döner', async () => {
    const token = await loginAndTopUp(500);
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderBody({ promoCode: 'YOKBOYLE' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PROMO');
  });

  it('sipariş numaraları DD-1042den monoton artar; liste yeniden eskiye', async () => {
    const token = await loginAndTopUp(1000);
    const auth = ['Authorization', `Bearer ${token}`] as const;
    const first = await request(app).post('/orders').set(...auth).send(orderBody());
    const second = await request(app).post('/orders').set(...auth).send(orderBody());
    expect(first.body.id).toBe('DD-1042');
    expect(second.body.id).toBe('DD-1043');

    const list = await request(app).get('/orders').set(...auth);
    expect(list.body.map((o: { id: string }) => o.id)).toEqual(['DD-1043', 'DD-1042']);
  });

  it('eşzamanlılık: bakiyeyi aşan iki paralel siparişten yalnız biri geçer', async () => {
    const token = await loginAndTopUp(400); // mug 390; iki sipariş 780 > 400
    const auth = ['Authorization', `Bearer ${token}`] as const;
    const body = orderBody({ items: [{ productId: 'mug-konik', quantity: 1 }] });

    const [a, b] = await Promise.all([
      request(app).post('/orders').set(...auth).send(body),
      request(app).post('/orders').set(...auth).send(body),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);

    const wallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(wallet.balance)).toBe(10);
    expect(await prisma.order.count()).toBe(1);
  });
});
