import type { Gift, Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { journalMetadata, loyaltyState } from '../loyalty/loyalty-journal.js';

/// Hediyeyi alıcıya işler: bakiye hediyesi cüzdana, içecek hediyesi
/// ikram hakkına dönüşür. Hem kayıt anında (auth) hem gönderim anında
/// (kayıtlı alıcı) kullanılır.
export async function claimGiftForUser(
  tx: Prisma.TransactionClient,
  giftReference: Pick<Gift, 'id'>,
  userId: string,
): Promise<void> {
  await lockUsers(tx, [userId]);
  const gift = await tx.gift.findUnique({ where: { id: giftReference.id } });
  if (!gift) throw AppError.notFound('Hediye bulunamadı');
  const recipient = await tx.user.findUnique({
    where: { id: userId },
    select: { phone: true, isBlocked: true },
  });
  if (!recipient || recipient.phone !== gift.recipientPhone) {
    throw AppError.forbidden('Hediye yalnızca gönderildiği telefon numarasının hesabına eklenebilir');
  }
  // Dondurulan hesap giriş yapabilir; hediye, hesap yeniden etkinleşene
  // kadar bekler ve giriş sırasında tekrar değerlendirilir.
  if (recipient.isBlocked) return;

  // Çifte işleme guard'ı: kayıt anındaki claim ile gönderim anındaki claim
  // yarışsa bile hediye yalnızca bir kez krediye dönüşür. REDEEMED burada
  // hesabına aktarıldığını belirtir; kasada kullanıldığını değil.
  const claimed = await tx.gift.updateMany({
    where: { id: gift.id, recipientPhone: recipient.phone, status: 'PENDING' },
    data: { status: 'REDEEMED', recipientId: userId, redeemedAt: new Date() },
  });
  if (claimed.count === 0) return;

  if (gift.type === 'BALANCE') {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: gift.amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'GIFT_RECEIVED',
        amount: gift.amount,
        balanceAfter: wallet.balance,
        giftId: gift.id,
        note: `Hediye bakiye (${gift.label})`,
      },
    });
  } else {
    const before = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    const loyalty = await tx.loyaltyAccount.update({
      where: { userId },
      data: { freeDrinks: { increment: 1 } },
    });
    await tx.loyaltyEvent.create({
      data: {
        accountId: loyalty.id,
        type: 'GIFT_DRINK_RECEIVED',
        title: `Hediye: ${gift.label}`,
        metadata: journalMetadata({ kind: 'grant', before: loyaltyState(before), freeDrinks: 1 }),
      },
    });
  }
}
