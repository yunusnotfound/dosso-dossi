import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { dec, toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { applyLoyalty } from '../loyalty/loyalty-apply.js';
import { parseOrderNumber } from './order-status.service.js';
import { kerzzPosClient } from './pos-client.js';
import type { PlaceOrderInput } from './orders.schemas.js';

/// Opsiyon fiyat farkları — Flutter'daki product_options.dart ile aynı.
/// TODO: ileride /menu/options endpoint'ine taşınabilir (sözleşme notu).
const OPTION_DELTAS: Record<string, number> = {
  'Yulaf sütü': 60,
  'Badem sütü': 60,
  'Çift shot': 40,
};

function optionDelta(name: string): number {
  return OPTION_DELTAS[name] ?? 0;
}

export async function placeOrder(userId: string, input: PlaceOrderInput) {
  const order = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw AppError.notFound('Şube bulunamadı');
    if (!branch.isOpen) throw AppError.branchClosed();

    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const availability = await tx.branchProduct.findMany({
      where: { branchId: branch.id, productId: { in: productIds } },
    });
    const unavailable = new Set(
      availability.filter((a) => !a.isAvailable).map((a) => a.productId),
    );
    const priceOverrides = new Map(
      availability
        .filter((a) => a.priceOverride !== null)
        .map((a) => [a.productId, a.priceOverride as Prisma.Decimal]),
    );

    // Fiyatlar sunucuda yeniden hesaplanır; istemci toplamına güvenilmez.
    // Kurallar cart.dart (CartState) ile birebir aynı.
    const lines = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        throw AppError.productUnavailable(`Ürün bulunamadı: ${item.productId}`);
      }
      if (unavailable.has(product.id)) {
        throw AppError.productUnavailable(`${product.name} bu şubede şu an yok`);
      }
      const basePrice = Number(priceOverrides.get(product.id) ?? product.price);
      const unitPrice = product.hasOptions
        ? basePrice + optionDelta(item.milk) + optionDelta(item.shot)
        : basePrice;
      return { ...item, product, unitPrice };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

    let discountRate = 0;
    let promoCode: string | undefined;
    if (input.promoCode) {
      promoCode = input.promoCode.toUpperCase();
      const promo = await tx.promoCode.findUnique({ where: { code: promoCode } });
      if (!promo || !promo.isActive || (promo.expiresAt && promo.expiresAt < new Date())) {
        throw AppError.invalidPromo();
      }
      discountRate = Number(promo.discountRate);
    }
    const discount = subtotal * discountRate;

    // İkram: damga kazandıran en yüksek birim fiyatlı üründen 1 adet bedava.
    // İkram edilen içecek de damga kazanır (mock ile aynı kural).
    let freeDrinkDiscount = 0;
    let freeLine: (typeof lines)[number] | undefined;
    if (input.useFreeDrink) {
      const loyalty = await tx.loyaltyAccount.findUniqueOrThrow({
        where: { userId },
      });
      if (loyalty.freeDrinks < 1) throw AppError.noFreeDrink();
      for (const line of lines) {
        if (line.product.stampMultiplier === 0) continue;
        if (!freeLine || line.unitPrice > freeLine.unitPrice) freeLine = line;
      }
      if (!freeLine) throw AppError.noFreeDrink('Sepette ikrama uygun içecek yok');
      freeDrinkDiscount = freeLine.unitPrice;
    }

    const total = Math.max(0, subtotal - discount - freeDrinkDiscount);
    const stampsEarned = lines.reduce(
      (sum, l) => sum + l.product.stampMultiplier * l.quantity,
      0,
    );

    // Koşullu düşüm: bakiye yeterliyse tek adımda düşer (yarış koşulu yok)
    const debited = await tx.wallet.updateMany({
      where: { userId, balance: { gte: dec(total) } },
      data: { balance: { decrement: dec(total) } },
    });
    if (debited.count === 0) throw AppError.insufficientBalance();
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    const numberRow = await tx.$queryRaw<[{ nextval: bigint }]>(
      Prisma.sql`SELECT nextval('order_number_seq')`,
    );
    const number = Number(numberRow[0].nextval);

    const order = await tx.order.create({
      data: {
        number,
        userId,
        branchId: branch.id,
        pickupSlot: input.pickupSlot,
        subtotal: dec(subtotal),
        discount: dec(discount),
        freeDrinkDiscount: dec(freeDrinkDiscount),
        total: dec(total),
        promoCode,
        usedFreeDrink: input.useFreeDrink,
        stampsEarned,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            productName: l.product.name,
            unitPrice: dec(l.unitPrice),
            quantity: l.quantity,
            size: l.size,
            milk: l.milk,
            shot: l.shot,
            isFreeDrink: input.useFreeDrink && l === freeLine,
          })),
        },
      },
      include: { items: true, branch: true },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'ORDER_PAYMENT',
        amount: dec(-total),
        balanceAfter: wallet.balance,
        orderId: order.id,
        note: `Sipariş DD-${number}`,
      },
    });

    // Damga/ikram işleme — kasadaki satışla (sale webhook) ortak kural
    await applyLoyalty(tx, userId, {
      stampsEarned,
      consumeFreeDrink:
        input.useFreeDrink && freeLine
          ? { title: freeLine.product.name }
          : undefined,
      sourceTitle: `Sipariş DD-${number}`,
      orderId: order.id,
    });

    return order;
  });

  kerzzPosClient.forwardOrder(order);
  return serializeOrder(order);
}

export async function getOrder(userId: string, orderId: string) {
  const number = parseOrderNumber(orderId);
  const order = await prisma.order.findFirst({
    where: { number, userId },
    include: { items: true, branch: true },
  });
  if (!order) throw AppError.notFound('Sipariş bulunamadı');
  return serializeOrder(order);
}

export async function listOrders(userId: string) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: true, branch: true },
  });
  return orders.map(serializeOrder);
}

function serializeOrder(
  order: Prisma.OrderGetPayload<{ include: { items: true; branch: true } }>,
) {
  return {
    id: `DD-${order.number}`,
    status: order.status.toLowerCase(),
    createdAt: order.createdAt.toISOString(),
    branchId: order.branchId,
    branchName: order.branch.name,
    pickupSlot: order.pickupSlot,
    subtotal: toMoney(order.subtotal),
    discount: toMoney(order.discount),
    freeDrinkDiscount: toMoney(order.freeDrinkDiscount),
    total: toMoney(order.total),
    stampsEarned: order.stampsEarned,
    items: order.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      unitPrice: toMoney(i.unitPrice),
      quantity: i.quantity,
      size: i.size,
      milk: i.milk,
      shot: i.shot,
      isFreeDrink: i.isFreeDrink,
    })),
  };
}
