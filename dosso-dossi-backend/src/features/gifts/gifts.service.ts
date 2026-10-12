import { historyBoundary, historyPageResult, type HistoryPage } from '../../lib/history-page.js';
import { randomBytes } from 'node:crypto';
import type { Gift } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { dec, toMoney } from '../../lib/money.js';
import { normalizePhone } from '../../lib/phone.js';
import { lockRecipientPhone } from '../../lib/phone-lock.js';
import { prisma } from '../../lib/prisma.js';
import { assertActiveUser } from '../../lib/active-user.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { lockFinancialRequest, saveFinancialResult } from '../../lib/idempotency.js';
import { assertSmsAvailable, smsProvider } from '../../lib/sms/dev-sms-provider.js';
import { claimGiftForUser, claimPendingGiftsForUser } from './gift-claim.js';
import type { SendGiftInput } from './gifts.schemas.js';

export async function sendGift(senderId: string, input: SendGiftInput) {
  assertSmsAvailable();
  const recipientPhone = normalizePhone(input.recipientPhone);

  const result = await prisma.$transaction(async (tx) => {
    await lockRecipientPhone(tx, recipientPhone);
    const recipient = await tx.user.findUnique({ where: { phone: recipientPhone } });
    await lockUsers(tx, recipient ? [senderId, recipient.id] : [senderId]);
    await assertActiveUser(tx, senderId);
    if (recipient && (await tx.user.findUniqueOrThrow({ where: { id: recipient.id }, select: { closedAt: true } })).closedAt) {
      throw AppError.invalidStatusTransition('Alıcı hesabı kapatılmış; bu hesaba hediye gönderilemez');
    }
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
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });
  return gifts.map(serializeGift);
}

export async function listGiftPage(senderId: string, page: HistoryPage) {
  const rows = await prisma.gift.findMany({
    where: { senderId, ...historyBoundary(page) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  });
  return historyPageResult(rows, page, serializeGift);
}

/** Reconcile already sent gifts after an interrupted registration or account unblock. */
export async function claimPendingGifts(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!user) throw AppError.unauthorized();
    await lockRecipientPhone(tx, user.phone);
    await lockUsers(tx, [userId]);
    await assertActiveUser(tx, userId);
    return { claimed: await claimPendingGiftsForUser(tx, userId, user.phone) };
  });
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
