import type { Prisma } from '@prisma/client';
import { env } from '../../../config/env.js';
import { AppError } from '../../../lib/errors.js';
import { dec, toMoney } from '../../../lib/money.js';
import { prisma } from '../../../lib/prisma.js';
import { assertActiveUser } from '../../../lib/active-user.js';
import { lockUsers } from '../../../lib/financial-locks.js';
import { lockFinancialRequest, saveFinancialResult } from '../../../lib/idempotency.js';
import { paymentProvider } from './dev-payment-provider.js';
import { getSetting } from '../../settings/settings.service.js';
import { journalMetadata, loyaltyState } from '../../loyalty/loyalty-journal.js';

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
  idempotencyKey?: string,
  savedCardId?: string,
): Promise<TopUpResult> {
  const money = dec(amount);
  const prepared = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [userId]);
    await assertActiveUser(tx, userId);
    const request = await lockFinancialRequest(tx, userId, 'topup', idempotencyKey, { amount, savedCardId });
    if (request?.response) {
      return { cached: request.response as unknown as TopUpResult, intentId: '', created: false, requestId: request.id };
    }
    if (request?.resourceId) {
      return { intentId: request.resourceId, created: false, requestId: request.id };
    }
    const intent = await tx.paymentIntent.create({
      data: { userId, amount: money, provider: env.PAYMENT_PROVIDER },
    });
    if (request) await tx.financialRequest.update({ where: { id: request.id }, data: { resourceId: intent.id } });
    return { intentId: intent.id, created: true, requestId: request?.id };
  });
  if (prepared.cached) return prepared.cached;
  // The durable intent is already attached to the client key. A retry never charges again.
  if (!prepared.created) return getTopUpResult(userId, prepared.intentId);
  const intentId = prepared.intentId;

  const payment = await paymentProvider.createPayment({
    intentId,
    userId,
    amount,
  });
  await prisma.paymentIntent.update({
    where: { id: intentId },
    data: { providerRef: payment.providerRef, redirectUrl: payment.redirectUrl },
  });

  if (payment.status === 'failed') {
    await prisma.paymentIntent.update({
      where: { id: intentId },
      data: { status: 'FAILED' },
    });
    throw AppError.paymentNotPending('Ödeme sağlayıcı tarafından reddedildi');
  }
  if (payment.status === 'pending') {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    return {
      balance: toMoney(wallet.balance),
      bonusDrinks: 0,
      paymentId: intentId,
      status: 'pending',
      redirectUrl: payment.redirectUrl,
    };
  }

  const confirmed = await confirmTopUp(intentId);
  const result: TopUpResult = { ...confirmed, paymentId: intentId, status: 'succeeded' };
  await saveFinancialResult(prisma, prepared.requestId, result, intentId);
  return result;
}

/** Only the owner may reconcile an ambiguous top-up response. No provider call occurs here. */
export async function getTopUpResult(userId: string, paymentId: string): Promise<TopUpResult> {
  const intent = await prisma.paymentIntent.findFirst({ where: { id: paymentId, userId } });
  if (!intent) throw AppError.notFound('Ödeme bulunamadı');
  if (intent.status === 'FAILED' || intent.status === 'EXPIRED') throw AppError.paymentNotPending();
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return {
    paymentId: intent.id,
    status: intent.status === 'SUCCEEDED' ? 'succeeded' : 'pending',
    balance: toMoney(wallet.balance),
    bonusDrinks: intent.bonusDrinks,
    ...(intent.redirectUrl ? { redirectUrl: intent.redirectUrl } : {}),
  };
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
    const pending = await tx.paymentIntent.findUnique({ where: { id: intentId } });
    if (!pending) throw AppError.notFound('Ödeme bulunamadı');
    await lockUsers(tx, [pending.userId]);
    await assertActiveUser(tx, pending.userId);
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
    const firstOnly = await getSetting<boolean>('loyalty.topUpBonusFirstOnly', tx);
    const threshold = await getSetting<number>('loyalty.topUpBonusThreshold', tx);
    const drinks = await getSetting<number>('loyalty.topUpBonusDrinks', tx);
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
      const before = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId: intent.userId } });
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
          metadata: journalMetadata({ kind: 'grant', before: loyaltyState(before), freeDrinks: bonusDrinks }),
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
