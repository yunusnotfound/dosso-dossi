import type { Gift, Prisma } from '@prisma/client';

/// Hediyeyi alıcıya işler: bakiye hediyesi cüzdana, içecek hediyesi
/// ikram hakkına dönüşür. Hem kayıt anında (auth) hem gönderim anında
/// (kayıtlı alıcı) kullanılır.
export async function claimGiftForUser(
  tx: Prisma.TransactionClient,
  gift: Gift,
  userId: string,
): Promise<void> {
  // Çifte işleme guard'ı: kayıt anındaki claim ile gönderim anındaki claim
  // yarışsa bile hediye yalnızca bir kez krediye dönüşür.
  const claimed = await tx.gift.updateMany({
    where: { id: gift.id, status: 'PENDING' },
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
    const loyalty = await tx.loyaltyAccount.update({
      where: { userId },
      data: { freeDrinks: { increment: 1 } },
    });
    await tx.loyaltyEvent.create({
      data: {
        accountId: loyalty.id,
        type: 'GIFT_DRINK_RECEIVED',
        title: `Hediye: ${gift.label}`,
      },
    });
  }
}
