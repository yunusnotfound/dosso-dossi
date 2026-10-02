import { randomBytes } from 'node:crypto';
import type { Gift } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { dec, toMoney } from '../../lib/money.js';
import { normalizePhone } from '../../lib/phone.js';
import { prisma } from '../../lib/prisma.js';
import { assertActiveUser } from '../../lib/active-user.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { lockFinancialRequest, saveFinancialResult } from '../../lib/idempotency.js';
import { smsProvider } from '../../lib/sms/dev-sms-provider.js';
import { claimGiftForUser } from './gift-claim.js';
import type { SendGiftInput } from './gifts.schemas.js';

export async function sendGift(senderId: string, input: SendGiftInput) {
  const recipientPhone = normalizePhone(input.recipientPhone);

  const result = await prisma.$transaction(async (tx) => {
    const recipient = await tx.user.findUnique({ where: { phone: recipientPhone } });
    await lockUsers(tx, recipient ? [senderId, recipient.id] : [senderId]);
    await assertActiveUser(tx, senderId);
    const request = await lockFinancialRequest(tx, senderId, 'gift', input.idempotencyKey, {
      ...input, recipientPhone,
    });
    if (request?.response) {
      return { gift: null, response: request.response as unknown as ReturnType<typeof serializeGift> };
    }
    let label: string;
    let amount: number;
    let productId: string | undefined;
    if (input.type === 'drink') {
      const product = await tx.product.findUnique({
        where: { id: input.productId! },
      });
      if (!product || !product.isActive || product.stampMultiplier <= 0) {
        throw AppError.productUnavailable('Hediye edilecek ürün bulunamadı');
      }
      label = product.name;
      amount = Number(product.price);
      productId = product.id;
    } else {
      amount = input.amount!;
      label = `${toMoney(amount)} ₺ bakiye`;
    }

    if (input.expectedTotal !== undefined && !dec(input.expectedTotal).equals(dec(amount))) {
      throw AppError.priceChanged(amount);
    }
    const debited = await tx.wallet.updateMany({
      where: { userId: senderId, balance: { gte: dec(amount) } },
      data: { balance: { decrement: dec(amount) } },
    });
    if (debited.count === 0) throw AppError.insufficientBalance();
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { userId: senderId },
    });

    const gift = await tx.gift.create({
      data: {
        senderId,
        recipientPhone,
        type: input.type === 'drink' ? 'DRINK' : 'BALANCE',
        productId,
        label,
        amount: dec(amount),
        note: input.note,
        redeemCode: randomBytes(4).toString('hex').toUpperCase(),
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'GIFT_SENT',
        amount: dec(-amount),
        balanceAfter: wallet.balance,
        giftId: gift.id,
        note: `Hediye → ${recipientPhone} (${label})`,
      },
    });

    // Alıcı zaten kayıtlıysa hediye anında işlenir
    if (recipient) {
      await claimGiftForUser(tx, gift, recipient.id);
    }
    const updated = await tx.gift.findUniqueOrThrow({ where: { id: gift.id } });
    const response = serializeGift(updated);
    await saveFinancialResult(tx, request?.id, response, gift.id);
    return { gift: updated, response };
  });

  if (result.gift) await smsProvider.send(
    recipientPhone,
    `Dosso Dossi'den hediyeniz var: ${result.gift.type === 'DRINK' ? '1 ikram kahve' : result.gift.label}. ` +
      `Hediyenizi kullanmak için Dosso Dossi Coffee uygulamasına bu telefon numarasıyla giriş yapın. ` +
      `Hediyeniz hesabınıza eklenir ve yalnızca uygulama üzerinden kullanılabilir.`,
  );
  return result.response;
}

export async function listGifts(senderId: string) {
  const gifts = await prisma.gift.findMany({
    where: { senderId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return gifts.map(serializeGift);
}

function serializeGift(gift: Gift) {
  return {
    id: gift.id,
    recipientPhone: gift.recipientPhone,
    type: gift.type.toLowerCase(),
    benefit: gift.type === 'DRINK' ? 'free_drink' : 'wallet_balance',
    label: gift.label,
    amount: toMoney(gift.amount),
    note: gift.note,
    status: gift.status.toLowerCase(),
    date: gift.createdAt.toISOString(),
  };
}
