import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { dec, toMoney } from '../../lib/money.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { assertActiveUser } from '../../lib/active-user.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { lockFinancialRequest, saveFinancialResult } from '../../lib/idempotency.js';
import { applyLoyalty } from '../loyalty/loyalty-apply.js';
import { loadOrderOptions } from '../menu/options.service.js';
import { parseOrderNumber } from './order-status.service.js';
import { kerzzPosClient } from './pos-client.js';
import type { PlaceOrderInput } from './orders.schemas.js';

export async function placeOrder(userId: string, input: PlaceOrderInput) {
  const result = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [userId]);
    await assertActiveUser(tx, userId);
    const request = await lockFinancialRequest(tx, userId, 'order', input.idempotencyKey, input);
    if (request?.response) {
      return { order: null, response: request.response as unknown as ReturnType<typeof serializeOrder> };
    }
    const optionDelta = await loadOrderOptions(tx);
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
      const basePrice = priceOverrides.get(product.id) ?? product.price;
      const unitPrice = product.hasOptions
        ? toMoney(basePrice.add(optionDelta('milk', item.milk)).add(optionDelta('shot', item.shot)))
        : toMoney(basePrice);
      if (!product.hasOptions && ((item.milk && item.milk !== 'Normal süt') || (item.shot && item.shot !== 'Tek shot'))) {
        throw new AppError('VALIDATION_ERROR', 400, 'Bu ürün için süt veya shot seçilemez');
      }
      if (unitPrice < 0) throw new AppError('VALIDATION_ERROR', 400, 'Ürün fiyatı negatif olamaz');
      return { ...item, product, unitPrice };
    });

    const subtotal = toMoney(lines.reduce((sum, l) => sum.add(dec(l.unitPrice).mul(l.quantity)), dec(0)));

    let discountRate = new Prisma.Decimal(0);
    let promoCode: string | undefined;
    if (input.promoCode) {
      promoCode = input.promoCode.toUpperCase();
      const promo = await tx.promoCode.findUnique({ where: { code: promoCode } });
      if (!promo || !promo.isActive || (promo.expiresAt && promo.expiresAt < new Date())) {
        throw AppError.invalidPromo();
      }
      discountRate = promo.discountRate;
    }
    const discount = toMoney(dec(subtotal).mul(discountRate));

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

    const total = toMoney(Prisma.Decimal.max(0, dec(subtotal).sub(discount).sub(freeDrinkDiscount)));
    if (input.expectedTotal !== undefined && dec(input.expectedTotal).comparedTo(dec(total)) !== 0) {
      throw AppError.priceChanged(total);
    }
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

    const response = serializeOrder(order);
    await saveFinancialResult(tx, request?.id, response, order.id);
    return { order, response };
  });

  // At-ve-unut değil: hata sweep'e loglanır, mini-outbox yeniden dener
  if (result.order) {
    const order = result.order;
    kerzzPosClient
      .forwardOrder(order)
      .catch((err) => logger.warn(`Sipariş DD-${order.number} POS'a iletilemedi: ${err}`));
  }
  return result.response;
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
    take: 50,
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
