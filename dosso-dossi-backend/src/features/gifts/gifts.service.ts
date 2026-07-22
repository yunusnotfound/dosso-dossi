import { randomBytes } from 'node:crypto';
import { AppError } from '../../lib/errors.js';
import { dec, toMoney } from '../../lib/money.js';
import { normalizePhone } from '../../lib/phone.js';
import { prisma } from '../../lib/prisma.js';
import { smsProvider } from '../../lib/sms/dev-sms-provider.js';
import { claimGiftForUser } from './gift-claim.js';
import type { SendGiftInput } from './gifts.schemas.js';

export async function sendGift(senderId: string, input: SendGiftInput) {
  const recipientPhone = normalizePhone(input.recipientPhone);

  const gift = await prisma.$transaction(async (tx) => {
    let label: string;
    let amount: number;
    let productId: string | undefined;
    if (input.type === 'drink') {
      const product = await tx.product.findUnique({
        where: { id: input.productId! },
      });
      if (!product || !product.isActive) {
        throw AppError.productUnavailable('Hediye edilecek ürün bulunamadı');
      }
      label = product.name;
      amount = Number(product.price);
      productId = product.id;
    } else {
      amount = input.amount!;
      label = `${toMoney(amount)} ₺ bakiye`;
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
    const recipient = await tx.user.findUnique({ where: { phone: recipientPhone } });
    if (recipient) {
      await claimGiftForUser(tx, gift, recipient.id);
      return tx.gift.findUniqueOrThrow({ where: { id: gift.id } });
    }
    return gift;
  });

  await smsProvider.send(
    recipientPhone,
    `Dosso Dossi'den hediyeniz var: ${gift.label}. Kod: ${gift.redeemCode}. ` +
      `Uygulamaya bu numarayla giriş yapınca hesabınıza tanımlanır.`,
  );
  return serializeGift(gift);
}

export async function listGifts(senderId: string) {
  const gifts = await prisma.gift.findMany({
    where: { senderId },
    orderBy: { createdAt: 'desc' },
  });
  return gifts.map(serializeGift);
}

function serializeGift(gift: {
  id: string;
  recipientPhone: string;
  type: string;
  label: string;
  amount: unknown;
  note: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: gift.id,
    recipientPhone: gift.recipientPhone,
    type: gift.type.toLowerCase(),
    label: gift.label,
    amount: toMoney(gift.amount as never),
    note: gift.note,
    status: gift.status.toLowerCase(),
    date: gift.createdAt.toISOString(),
  };
}
