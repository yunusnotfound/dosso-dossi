import { env } from '../../../config/env.js';
import { AppError } from '../../../lib/errors.js';
import { dec, toMoney } from '../../../lib/money.js';
import { prisma } from '../../../lib/prisma.js';
import { paymentProvider } from './dev-payment-provider.js';

// CEO kampanyası: tek seferde 1.000 ₺+ yükleme → 5 ikram kahve
const TOPUP_BONUS_THRESHOLD = 1000;
const TOPUP_BONUS_DRINKS = 5;

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

/// Onayı işler; paymentId ile idempotent. Hem startTopUp (dev, anında)
/// hem /webhooks/payment/confirmation buradan geçer.
export async function confirmTopUp(
  intentId: string,
): Promise<{ balance: number; bonusDrinks: number }> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentIntent.updateMany({
      where: { id: intentId, status: 'PENDING' },
      data: { status: 'SUCCEEDED', confirmedAt: new Date() },
    });
    const intent = await tx.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw AppError.notFound('Ödeme bulunamadı');

    const amount = Number(intent.amount);
    const bonusDrinks = amount >= TOPUP_BONUS_THRESHOLD ? TOPUP_BONUS_DRINKS : 0;

    if (claimed.count === 0) {
      // Daha önce sonuçlanmış: SUCCEEDED ise idempotent yanıt, değilse hata
      if (intent.status !== 'SUCCEEDED') throw AppError.paymentNotPending();
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: intent.userId },
      });
      return { balance: toMoney(wallet.balance), bonusDrinks };
    }

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
  });
}

export async function markPaymentFailed(intentId: string) {
  const updated = await prisma.paymentIntent.updateMany({
    where: { id: intentId, status: 'PENDING' },
    data: { status: 'FAILED' },
  });
  if (updated.count === 0) {
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) throw AppError.notFound('Ödeme bulunamadı');
    if (intent.status !== 'FAILED') throw AppError.paymentNotPending();
  }
  return { ok: true, status: 'failed' };
}
