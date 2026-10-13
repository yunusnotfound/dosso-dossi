import type { PaymentIntent, Prisma } from '@prisma/client';
import { env } from '../../../config/env.js';
import { AppError, ErrorCodes } from '../../../lib/errors.js';
import { dec, toMoney } from '../../../lib/money.js';
import { prisma } from '../../../lib/prisma.js';
import { assertActiveUser } from '../../../lib/active-user.js';
import { lockUsers } from '../../../lib/financial-locks.js';
import { lockFinancialRequest } from '../../../lib/idempotency.js';
import { paymentProvider } from './payment-provider-factory.js';
import { PaymentProviderError, type PaymentBuyer } from './payment-provider.js';
import { getSetting } from '../../settings/settings.service.js';
import { journalMetadata, loyaltyState } from '../../loyalty/loyalty-journal.js';
import { logger } from '../../../lib/logger.js';

export interface TopUpResult {
  balance: number;
  amount: number;
  bonusDrinks: number;
  paymentId: string;
  status: 'succeeded' | 'pending' | 'failed' | 'expired';
  redirectUrl?: string;
  checkoutExpired?: boolean;
  idempotencyKeys: string[];
}

export interface TopUpContext {
  buyer?: Omit<PaymentBuyer, 'gsmNumber'>;
  buyerIp?: string;
  session?: { tokenVersion: number; familyId?: string };
}

export function getPaymentConfiguration() {
  let enabled = false;
  try { paymentProvider.assertReady(); enabled = true; } catch { /* credentials not installed yet */ }
  return { provider: env.PAYMENT_PROVIDER, enabled, requiresBillingDetails: env.PAYMENT_PROVIDER === 'iyzico' };
}

/** An idempotency key is attached before any external call; no retry creates a second checkout. */
export async function startTopUp(
  userId: string,
  amount: number,
  idempotencyKey?: string,
  savedCardId?: string,
  context: TopUpContext = {},
): Promise<TopUpResult> {
  const money = dec(amount);
  if (!money.gt(0) || money.gt(100_000)) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Geçerli bir yükleme tutarı girin');
  if (env.PAYMENT_PROVIDER === 'iyzico' && !idempotencyKey) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Yükleme için işlem anahtarı gerekli');
  }
  // A missing configuration must never create an intent or fall back to simulated money.
  paymentProvider.assertReady();
  const prepared = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [userId]);
    await assertActiveUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (context.session) {
      if (user.tokenVersion !== context.session.tokenVersion) throw AppError.unauthorized();
      if (context.session.familyId && !await tx.refreshToken.findFirst({
        where: { userId, familyId: context.session.familyId, familyRevokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true },
      })) throw AppError.unauthorized();
    }
    // Billing details are transmitted once to iyzico, never persisted in our intent/retry body.
    const request = await lockFinancialRequest(tx, userId, 'topup', idempotencyKey, { amount, savedCardId });
    if (request?.resourceId) return { intentId: request.resourceId, created: false, phone: user.phone };
    if (env.PAYMENT_PROVIDER === 'iyzico') {
      const pending = await tx.paymentIntent.findFirst({ where: {
        userId, provider: 'iyzico', status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      }, orderBy: { createdAt: 'desc' } });
      if (pending) {
        if (!pending.amount.equals(money)) throw new AppError(ErrorCodes.PAYMENT_IN_PROGRESS, 409,
          'Devam eden yüklemenin sonucunu kontrol edin.', { paymentId: pending.id });
        if (request) await tx.financialRequest.update({ where: { id: request.id }, data: { resourceId: pending.id } });
        return { intentId: pending.id, created: false, phone: user.phone };
      }
      if (!context.buyer || !context.buyerIp) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Ödeme için fatura bilgilerini tamamlayın');
      if (savedCardId) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Kartınızı iyzico ödeme sayfasında seçin');
    }
    const intent = await tx.paymentIntent.create({ data: { userId, amount: money, provider: env.PAYMENT_PROVIDER } });
    if (request) await tx.financialRequest.update({ where: { id: request.id }, data: { resourceId: intent.id } });
    return { intentId: intent.id, created: true, phone: user.phone };
  });
  if (!prepared.created) return getTopUpResult(userId, prepared.intentId);

  try {
    const payment = await paymentProvider.createPayment({
      intentId: prepared.intentId, userId, amount,
      buyer: context.buyer ? { ...context.buyer, gsmNumber: `+90${prepared.phone}` } : undefined,
      buyerIp: context.buyerIp,
    });
    // Do not overwrite a token bound by an early, verified webhook.
    await prisma.paymentIntent.updateMany({
      where: { id: prepared.intentId, OR: [{ providerRef: null }, { providerRef: payment.providerRef }] },
      data: { providerRef: payment.providerRef, redirectUrl: payment.redirectUrl, expiresAt: payment.expiresAt },
    });
    if (payment.status === 'failed') await prisma.paymentIntent.updateMany({
      where: { id: prepared.intentId, status: 'PENDING' }, data: { status: 'FAILED' },
    });
    if (payment.status === 'succeeded') {
      if (env.PAYMENT_PROVIDER !== 'dev') throw new PaymentProviderError();
      await confirmTopUp(prepared.intentId);
    }
  } catch (error) {
    if (error instanceof PaymentProviderError && error.definitiveFailure) await prisma.paymentIntent.updateMany({
      where: { id: prepared.intentId, status: 'PENDING', providerRef: null }, data: { status: 'FAILED' },
    });
    throw error;
  }
  return serializeTopUp(userId, await prisma.paymentIntent.findUniqueOrThrow({ where: { id: prepared.intentId } }));
}

async function serializeTopUp(userId: string, intent: PaymentIntent): Promise<TopUpResult> {
  const [wallet, requests] = await Promise.all([
    prisma.wallet.findUniqueOrThrow({ where: { userId } }),
    prisma.financialRequest.findMany({ where: { userId, scope: 'topup', resourceId: intent.id }, select: { key: true } }),
  ]);
  const status = intent.status.toLowerCase() as TopUpResult['status'];
  return {
    paymentId: intent.id, amount: toMoney(intent.amount), status,
    idempotencyKeys: requests.map((request) => request.key),
    balance: toMoney(wallet.balance), bonusDrinks: status === 'succeeded' ? intent.bonusDrinks : 0,
    checkoutExpired: status === 'pending' && !!intent.expiresAt && intent.expiresAt <= new Date(),
    ...(status === 'pending' && intent.redirectUrl && (!intent.expiresAt || intent.expiresAt > new Date()) ? { redirectUrl: intent.redirectUrl } : {}),
  };
}

/** Owner-only status reads recover missed callbacks by querying the provider. */
export async function getTopUpResult(userId: string, paymentId: string): Promise<TopUpResult> {
  let intent = await prisma.paymentIntent.findFirst({ where: { id: paymentId, userId } });
  if (!intent) throw AppError.notFound('Ödeme bulunamadı');
  if (intent.status === 'PENDING') {
    try { await reconcileTopUp(intent.id); } catch { /* remain pending; a timeout is not a decline */ }
    intent = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: paymentId } });
  }
  return serializeTopUp(userId, intent);
}

export async function getPendingTopUp(userId: string): Promise<{ payment: TopUpResult | null }> {
  const intent = await prisma.paymentIntent.findFirst({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
  return { payment: intent ? await getTopUpResult(userId, intent.id) : null };
}

/** Notification bodies are only hints. Settlement uses an authenticated, signed retrieve response. */
export async function reconcileTopUp(intentId: string, notifiedToken?: string, force = false): Promise<void> {
  const initial = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!initial || initial.provider !== 'iyzico') throw AppError.notFound('Ödeme bulunamadı');
  if (initial.status === 'SUCCEEDED') return;
  if (paymentProvider.name !== 'iyzico' || !paymentProvider.retrievePayment) throw new PaymentProviderError();
  paymentProvider.assertReady();
  const token = initial.providerRef ?? notifiedToken;
  if (initial.providerRef && notifiedToken && initial.providerRef !== notifiedToken) throw AppError.invalidSignature();
  if (!token) {
    // No checkout link was ever delivered. Permit a fresh attempt after the init request is certainly over.
    if (initial.createdAt.getTime() < Date.now() - 5 * 60_000) await prisma.paymentIntent.updateMany({
      where: { id: intentId, status: 'PENDING', providerRef: null }, data: { status: 'EXPIRED' },
    });
    return;
  }
  if (!force) {
    const lease = await prisma.paymentIntent.updateMany({
      where: { id: intentId, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 10_000) } }] },
      data: { lastCheckedAt: new Date() },
    });
    if (!lease.count) return;
  }
  const result = await paymentProvider.retrievePayment({ intentId, providerRef: token });
  if (result.providerRef !== token || result.conversationId !== intentId) throw AppError.invalidSignature();
  // Every field present must match, including fraud-review responses. Partial signed
  // declines can omit amount/payment IDs, but can never cause a credit.
  if ((result.basketId !== undefined && result.basketId !== intentId) ||
      (result.currency !== undefined && result.currency !== 'TRY') ||
      (result.amount !== undefined && !initial.amount.equals(dec(result.amount))) ||
      (result.paidAmount !== undefined && !initial.amount.equals(dec(result.paidAmount)))) throw AppError.invalidSignature();
  if (result.status === 'succeeded') {
    if (!result.paymentId || result.basketId !== intentId || result.currency !== 'TRY' ||
        result.amount === undefined || result.paidAmount === undefined ||
        !initial.amount.equals(dec(result.amount)) || !initial.amount.equals(dec(result.paidAmount))) throw AppError.invalidSignature();
  }
  if (result.status === 'succeeded') {
    const item = result.itemTransactions[0];
    if (result.fraudStatus !== 1 || result.itemTransactions.length !== 1 || !item || item.itemId !== intentId ||
        !initial.amount.equals(dec(item.price)) || !initial.amount.equals(dec(item.paidPrice))) throw AppError.invalidSignature();
  }
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [initial.userId]);
    const current = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
    if (current.providerRef && current.providerRef !== token) throw AppError.invalidSignature();
    if (current.providerPaymentId && result.paymentId && current.providerPaymentId !== result.paymentId) throw AppError.invalidSignature();
    if (current.status === 'SUCCEEDED') return;
    await tx.paymentIntent.update({ where: { id: intentId }, data: {
      providerRef: token, lastCheckedAt: new Date(),
      ...(result.paymentId ? { providerPaymentId: result.paymentId } : {}),
      ...(result.itemTransactions.length ? { providerTransactions: result.itemTransactions as Prisma.InputJsonValue } : {}),
    } });
    if (result.status === 'succeeded') await confirmTopUpTx(tx, intentId, true);
    else if (result.status === 'failed') await tx.paymentIntent.updateMany({ where: { id: intentId, status: 'PENDING' }, data: { status: 'FAILED' } });
  });
}

/** Bounded recovery while the customer is offline; no timer expires a potentially charged checkout. */
export function startPaymentSweep(): () => void {
  if (env.PAYMENT_PROVIDER !== 'iyzico') return () => {};
  let running = false;
  const tick = async () => {
    if (running || !getPaymentConfiguration().enabled) return;
    running = true;
    try {
      const pending = await prisma.paymentIntent.findMany({
        where: { provider: 'iyzico', status: 'PENDING' }, orderBy: [{ lastCheckedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }], take: 20,
        select: { id: true },
      });
      await Promise.allSettled(pending.map(async ({ id }) => {
        try { await reconcileTopUp(id); } catch { logger.warn('Ödeme sonucu henüz doğrulanamadı', { paymentId: id }); }
      }));
    } catch { logger.warn('Ödeme kontrolü tamamlanamadı'); }
    finally { running = false; }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
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
  verifiedIyzico = false,
): Promise<{ balance: number; bonusDrinks: number }> {
  {
    const pending = await tx.paymentIntent.findUnique({ where: { id: intentId } });
    if (!pending) throw AppError.notFound('Ödeme bulunamadı');
    await lockUsers(tx, [pending.userId]);
    // Blocking spending does not cancel a charge already accepted by the bank.
    // Recognize that liability while all spending/account access guards remain active.
    if (pending.provider === 'iyzico' && !verifiedIyzico) throw AppError.forbidden();
    if (!verifiedIyzico) await assertActiveUser(tx, pending.userId);
    const claimed = await tx.paymentIntent.updateMany({
      where: { id: intentId, status: verifiedIyzico ? { in: ['PENDING', 'FAILED', 'EXPIRED'] } : 'PENDING' },
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

    // Yalnız gerçek, başarılı yüklemeler kampanya hakkını tüketir.
    // Eski panel düzeltmeleri TOPUP diye kaydedilmiş olsa da hak kaybettirmez.
    const previousTopUps = await tx.paymentIntent.count({
      where: { userId: intent.userId, status: 'SUCCEEDED', id: { not: intent.id } },
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
        paymentIntentId: intent.id,
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
