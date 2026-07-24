import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { advanceOrderStatus } from './order-status.service.js';

interface ForwardedOrder {
  number: number;
  branchId: string;
}

/// Şube POS'una sipariş iletimi. Gerçek Kerzz adaptörü bu arayüzü
/// uygulayacak; şimdilik dev istemcisi loglar ve (dev'de) sipariş
/// durumunu zamanlayıcıyla ilerleterek canlı takibi simüle eder.
export interface KerzzPosClient {
  forwardOrder(order: ForwardedOrder): void;
}

const PREPARING_DELAY_MS = 8_000;
const READY_DELAY_MS = 20_000;

class DevKerzzPosClient implements KerzzPosClient {
  forwardOrder(order: ForwardedOrder): void {
    logger.info(
      `[Kerzz dev] Sipariş DD-${order.number} → ${order.branchId} POS'una iletildi (simülasyon)`,
    );
    if (!env.POS_DEV_AUTOADVANCE) return;

    const advance = (status: 'PREPARING' | 'READY', delay: number) => {
      const timer = setTimeout(() => {
        advanceOrderStatus(order.number, status).catch((err) =>
          logger.warn(`[Kerzz dev] DD-${order.number} ${status} ilerletilemedi: ${err}`),
        );
      }, delay);
      timer.unref(); // süreç kapanışını bekletmesin
    };
    advance('PREPARING', PREPARING_DELAY_MS);
    advance('READY', READY_DELAY_MS);
  }
}

export const kerzzPosClient: KerzzPosClient = new DevKerzzPosClient();
