import type { Prisma } from '@prisma/client';
import { env } from '../../../config/env.js';
import { AppError } from '../../../lib/errors.js';
import { dec, toMoney } from '../../../lib/money.js';
import { prisma } from '../../../lib/prisma.js';
import { paymentProvider } from './dev-payment-provider.js';
import { getSetting } from '../../settings/settings.service.js';

// CEO kampanyası: kullanıcının İLK bakiye yüklemesi eşiği geçiyorsa ikram
// kahve verilir. Tek seferliktir: ilk yükleme eşiğin altındaysa da hak düşer,
// sonraki yüklemelerde tutar ne olursa olsun ikram verilmez.
// Eşik/adet/kural artık Setting tablosundan (panelden yönetilir).

export interface TopUpResult {
  balance: number;
  bonusDrinks: number;
  paymentId: string;
  status: 'succeeded' | 'pending';
  redirectUrl?: string;
}

/// İki fazlı yükleme: önce PaymentIntent (PENDING), sağlayıcı onayı
/// gelmeden bakiyeye ASLA yazılmaz. Dev sağlayıcı anında onayladığı için
/// uygulama deneyimi eşzamanlı hisseder; iyzico'da 'pending' + redirectUrl
/// dönecek ve onay webhook'la gelecek.
export async function startTopUp(
  userId: string,
  amount: number,
): Promise<TopUpResult> {
  const intent = await prisma.paymentIntent.create({
    data: { userId, amount: dec(amount), provider: env.PAYMENT_PROVIDER },
  });

  const payment = await paymentProvider.createPayment({
    intentId: intent.id,
    userId,
    amount,
  });
  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerRef: payment.providerRef, redirectUrl: payment.redirectUrl },
  });

  if (payment.status === 'failed') {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: 'FAILED' },
    });
    throw AppError.paymentNotPending('Ödeme sağlayıcı tarafından reddedildi');
  }
  if (payment.status === 'pending') {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    return {
      balance: toMoney(wallet.balance),
      bonusDrinks: 0,
      paymentId: intent.id,
      status: 'pending',
      redirectUrl: payment.redirectUrl,
    };
  }

  const confirmed = await confirmTopUp(intent.id);
  return { ...confirmed, paymentId: intent.id, status: 'succeeded' };
}

/// Onayı işler; paymentId ile idempotent. startTopUp (dev, anında) bu
/// sarmalayıcıyı kullanır; ödeme webhook'u runPosEvent'in tx'iyle
/// confirmTopUpTx'i doğrudan çağırır.
export async function confirmTopUp(
  intentId: string,
): Promise<{ balance: number; bonusDrinks: number }> {
  return prisma.$transaction((tx) => confirmTopUpTx(tx, intentId));
}

export async function confirmTopUpTx(
  tx: Prisma.TransactionClient,
  intentId: string,
): Promise<{ balance: number; bonusDrinks: number }> {
  {
    const claimed = await tx.paymentIntent.updateMany({
      where: { id: intentId, status: 'PENDING' },
      data: { status: 'SUCCEEDED', confirmedAt: new Date() },
    });
    const intent = await tx.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw AppError.notFound('Ödeme bulunamadı');

    const amount = Number(intent.amount);

    if (claimed.count === 0) {
      // Daha önce sonuçlanmış: SUCCEEDED ise idempotent yanıt, değilse hata
      if (intent.status !== 'SUCCEEDED') throw AppError.paymentNotPending();
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: intent.userId },
      });
      // İkram onay anında hesaplanıp intent'e yazıldı; burada yeniden
      // hesaplanamaz çünkü yükleme kaydı artık "ilk" değil.
      return { balance: toMoney(wallet.balance), bonusDrinks: intent.bonusDrinks };
    }

    // Kampanya yalnızca ilk yüklemeye özel: bu cüzdanda daha önce yükleme
    // kaydı varsa tutar ne olursa olsun ikram verilmez.
    const walletBefore = await tx.wallet.findUniqueOrThrow({
      where: { userId: intent.userId },
    });
    const previousTopUps = await tx.walletTransaction.count({
      where: { walletId: walletBefore.id, type: 'TOPUP' },
    });
    const firstOnly = await getSetting<boolean>('loyalty.topUpBonusFirstOnly');
    const threshold = await getSetting<number>('loyalty.topUpBonusThreshold');
    const drinks = await getSetting<number>('loyalty.topUpBonusDrinks');
    const eligible = (!firstOnly || previousTopUps === 0) && amount >= threshold;
    const bonusDrinks = eligible ? drinks : 0;

    const wallet = await tx.wallet.update({
      where: { userId: intent.userId },
      data: { balance: { increment: intent.amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'TOPUP',
        amount: intent.amount,
        balanceAfter: wallet.balance,
        note: 'Bakiye yükleme',
      },
    });

    if (bonusDrinks > 0) {
      await tx.paymentIntent.update({
        where: { id: intentId },
        data: { bonusDrinks },
      });
      const loyalty = await tx.loyaltyAccount.update({
        where: { userId: intent.userId },
        data: { freeDrinks: { increment: bonusDrinks } },
      });
      await tx.loyaltyEvent.create({
        data: {
          accountId: loyalty.id,
          type: 'TOPUP_BONUS',
          title: `Yükle Kazan — ${bonusDrinks} ikram kahve`,
        },
      });
    }
    return { balance: toMoney(wallet.balance), bonusDrinks };
  }
}

export async function markPaymentFailed(
  tx: Prisma.TransactionClient,
  intentId: string,
) {
  const updated = await tx.paymentIntent.updateMany({
    where: { id: intentId, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
  if (updated.count === 0) {
    const intent = await tx.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) throw AppError.notFound('Ödeme bulunamadı');
    if (intent.status !== 'FAILED') throw AppError.paymentNotPending();
  }
  return { ok: true, status: 'failed' };
}
