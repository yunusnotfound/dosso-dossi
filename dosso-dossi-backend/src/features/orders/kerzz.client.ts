import { logger } from '../../lib/logger.js';

/// Kerzz POS köprüsü — bu fazda stub. Gerçek entegrasyon
/// docs/KERZZ_POS_ENTEGRASYON.md netleşince yazılacak.
export function forwardOrderToKerzz(order: {
  number: number;
  branchId: string;
}): void {
  logger.info(
    `[Kerzz stub] Sipariş DD-${order.number} → ${order.branchId} POS'una iletildi (simülasyon)`,
  );
}
