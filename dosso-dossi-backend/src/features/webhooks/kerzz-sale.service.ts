import type { Prisma } from '@prisma/client';
import { lockUsers } from '../../lib/financial-locks.js';
import { applyLoyalty } from '../loyalty/loyalty-apply.js';
import { chargePurchases } from '../loyalty/loyalty-journal.js';
import type { SaleInput } from './webhooks.schemas.js';

/// Kasadaki satışı işler: müşteriyi bulur, satırlardaki damga kazandıran
/// ürünlerden damga hesaplar, sadakat kuralını uygular.
/// runPosEvent'in transaction'ı içinde çalışır (idempotency ile atomik).
/// Müşteri eşleşmezse hata DEĞİL skip döner — POS tarafında retry
/// fırtınası yaratılmaz (idempotency defteri SKIPPED olarak işaretler).
export async function processSale(
  tx: Prisma.TransactionClient,
  input: SaleInput,
) {
  const initial = await resolveCustomer(tx, input);
  if (!initial) {
    return { ok: true, skipped: 'customer_unknown' };
  }
  // Refund and sale events may arrive together. Both take the user lock before
  // re-reading the charge, so either loyalty is reversed or the late sale skips.
  await lockUsers(tx, [initial.userId]);
  const customer = await resolveCustomer(tx, input);
  if (!customer) return { ok: true, skipped: 'customer_unknown' };
  const { userId, charge } = customer;
  if (charge?.status === 'VOIDED') return { ok: true, skipped: 'charge_voided' };
  if (charge && charge.branchId !== input.branchId) return { ok: true, skipped: 'charge_branch_mismatch' };
  if (charge) {
    const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    if ((await chargePurchases(tx, account.id, { id: charge.id, qrCode: charge.qrToken.code })).length > 0) {
      return { ok: true, skipped: 'charge_sale_already_recorded' };
    }
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
  });
  const multipliers = new Map(products.map((p) => [p.id, p.stampMultiplier]));
  const stampsEarned = input.items.reduce(
    (sum, item) => sum + (multipliers.get(item.productId) ?? 0) * item.quantity,
    0,
  );
  if (stampsEarned === 0) {
    return { ok: true, stampsEarned: 0, rewardsEarned: 0 };
  }

  const { rewardsEarned } = await applyLoyalty(tx, userId, {
    stampsEarned,
    sourceTitle: `Kasadan satış ${input.saleId}`,
    chargeId: charge?.id,
  });
  return { ok: true, stampsEarned, rewardsEarned };
}

/// Müşteri eşleştirme: önce chargeId (QR ile ödedi), sonra qrCode
/// (yalnızca okutuldu — tüketilmiş token da geçerli, normal akış bu).
async function resolveCustomer(
  tx: Prisma.TransactionClient,
  input: SaleInput,
) {
  if (input.customer.chargeId) {
    const charge = await tx.posCharge.findUnique({
      where: { id: input.customer.chargeId },
      include: { qrToken: true },
    });
    return charge ? { userId: charge.userId, charge } : null;
  }
  if (input.customer.qrCode) {
    const token = await tx.qrToken.findUnique({
      where: { code: input.customer.qrCode },
      include: { charge: { include: { qrToken: true } } },
    });
    if (token) return { userId: token.userId, charge: token.charge };
  }
  return null;
}
