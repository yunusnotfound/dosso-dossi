import type { Prisma } from '@prisma/client';
import { assertActiveUser } from '../../lib/active-user.js';
import { AppError } from '../../lib/errors.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { dec, toMoney } from '../../lib/money.js';
import { journalMetadata, loyaltyState, reverseChargeLoyalty } from '../loyalty/loyalty-journal.js';
import type { ChargeInput } from './pos.schemas.js';

/// Kod ekranda geçerliyken kasanın isteği birkaç saniye gecikebilir;
/// süresi yeni dolmuş token bu pencere içinde hâlâ kabul edilir.
const QR_CHARGE_GRACE_MS = 15_000;

/// Kasiyer hatası iptali için izin verilen süre.
const VOID_WINDOW_MS = 15 * 60_000;

/// Tara & Öde: kasada okutulan kodu tek adımda tahsil eder (authorize+capture).
/// runPosEvent'in transaction'ı içinde çalışır; reddedilirse her şey geri
/// sarılır — token tüketilmemiş kalır, müşteri aynı kodla yeniden deneyebilir.
export async function chargeQrCode(
  tx: Prisma.TransactionClient,
  input: ChargeInput,
) {
  {
    const branch = await tx.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw AppError.notFound('Şube bulunamadı');

    const token = await tx.qrToken.findUnique({
      where: { code: input.code },
      include: { user: true },
    });
    if (!token || token.consumedAt) throw AppError.invalidQr();
    if (token.expiresAt.getTime() < Date.now() - QR_CHARGE_GRACE_MS) {
      throw AppError.invalidQr('Kodun süresi doldu, müşteri yenilesin');
    }

    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${token.userId} FOR UPDATE`;
    await assertActiveUser(tx, token.userId);

    // Çifte okutma yarışı: tüketimi atomik yap
    const consumed = await tx.qrToken.updateMany({
      where: {
        id: token.id, consumedAt: null,
        // A request may wait on the user lock past the allowed grace window.
        expiresAt: { gte: new Date(Date.now() - QR_CHARGE_GRACE_MS) },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) throw AppError.invalidQr();

    const debited = await tx.wallet.updateMany({
      where: { userId: token.userId, balance: { gte: dec(input.amount) } },
      data: { balance: { decrement: dec(input.amount) } },
    });
    if (debited.count === 0) throw AppError.insufficientBalance();
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { userId: token.userId },
    });

    const charge = await tx.posCharge.create({
      data: {
        userId: token.userId,
        qrTokenId: token.id,
        branchId: branch.id,
        amount: dec(input.amount),
        saleRef: input.saleRef ?? '',
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'QR_PAYMENT',
        amount: dec(-input.amount),
        balanceAfter: wallet.balance,
        chargeId: charge.id,
        note: `Tara & Öde — ${branch.name}`,
      },
    });

    return {
      ok: true,
      chargeId: charge.id,
      amount: toMoney(input.amount),
      // Kasiyer teyidi için ad; bakiye bilgisi kasaya sızdırılmaz
      customerName: token.user.name || 'Dosso müşterisi',
    };
  }
}

/// Kasiyer hatası iptali: tam iade. Kısmi iade gerçek Kerzz adaptörüne bırakıldı.
export async function voidCharge(
  tx: Prisma.TransactionClient,
  chargeId: string,
) {
  {
    const initial = await tx.posCharge.findUnique({ where: { id: chargeId } });
    if (!initial) throw AppError.notFound('İşlem bulunamadı');
    await lockUsers(tx, [initial.userId]);
    const charge = await tx.posCharge.findUniqueOrThrow({
      where: { id: chargeId }, include: { qrToken: true },
    });
    if (
      charge.status !== 'APPROVED' ||
      charge.createdAt.getTime() < Date.now() - VOID_WINDOW_MS
    ) {
      throw AppError.voidNotAllowed();
    }

    const voided = await tx.posCharge.updateMany({
      where: { id: charge.id, status: 'APPROVED' },
      data: { status: 'VOIDED', voidedAt: new Date() },
    });
    if (voided.count === 0) throw AppError.voidNotAllowed();

    const wallet = await tx.wallet.update({
      where: { userId: charge.userId },
      data: { balance: { increment: charge.amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'REFUND',
        amount: charge.amount,
        balanceAfter: wallet.balance,
        chargeId: charge.id,
        note: `Tara & Öde iadesi`,
      },
    });

    const loyalty = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId: charge.userId } });
    const reversal = await reverseChargeLoyalty(tx, loyalty, { id: charge.id, qrCode: charge.qrToken.code });
    if (reversal.purchaseEventIds.length > 0) {
      await tx.loyaltyAccount.update({ where: { id: loyalty.id }, data: reversal.state });
      await tx.loyaltyEvent.create({
        data: {
          accountId: loyalty.id, type: 'ADJUSTMENT',
          title: 'Tara & Öde iadesi — sadakat geri alındı',
          metadata: reversal.mode === 'journal'
            ? journalMetadata({
              kind: 'void', chargeId: charge.id, purchaseEventIds: reversal.purchaseEventIds,
              before: loyaltyState(loyalty), after: reversal.state,
            })
            : journalMetadata({
              kind: 'checkpoint', before: loyaltyState(loyalty), after: reversal.state,
              reason: `QR void ${charge.id}: ${reversal.mode}`,
            }),
        },
      });
    }

    return { ok: true, chargeId: charge.id, refunded: toMoney(charge.amount) };
  }
}
