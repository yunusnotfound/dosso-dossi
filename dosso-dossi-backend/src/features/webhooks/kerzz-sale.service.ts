import type { Prisma } from '@prisma/client';
import { applyLoyalty } from '../loyalty/loyalty-apply.js';
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
  const userId = await resolveCustomer(tx, input);
  if (!userId) {
    return { ok: true, skipped: 'customer_unknown' };
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
  });
  return { ok: true, stampsEarned, rewardsEarned };
}

/// Müşteri eşleştirme: önce chargeId (QR ile ödedi), sonra qrCode
/// (yalnızca okutuldu — tüketilmiş token da geçerli, normal akış bu).
async function resolveCustomer(
  tx: Prisma.TransactionClient,
  input: SaleInput,
): Promise<string | null> {
  if (input.customer.chargeId) {
    const charge = await tx.posCharge.findUnique({
      where: { id: input.customer.chargeId },
    });
    if (charge) return charge.userId;
  }
  if (input.customer.qrCode) {
    const token = await tx.qrToken.findUnique({
      where: { code: input.customer.qrCode },
    });
    if (token) return token.userId;
  }
  return null;
}
