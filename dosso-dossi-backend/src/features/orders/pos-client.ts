import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { advanceOrderStatus } from './order-status.service.js';

interface ForwardedOrder {
  id: string;
  number: number;
  branchId: string;
}

/// Şube POS'una sipariş iletimi. Gerçek Kerzz adaptörü bu arayüzü
/// uygulayacak; dev istemcisi loglar ve (istenirse) durumu zamanlayıcıyla
/// ilerleterek canlı takibi simüle eder.
export interface KerzzPosClient {
  /// Başarıda Order.forwardedAt işaretlenir; hata fırlatırsa sweep
  /// (aşağıda) daha sonra yeniden dener.
  forwardOrder(order: ForwardedOrder): Promise<void>;
}

const PREPARING_DELAY_MS = 8_000;
const READY_DELAY_MS = 20_000;

class DevKerzzPosClient implements KerzzPosClient {
  async forwardOrder(order: ForwardedOrder): Promise<void> {
    logger.info(
      `[Kerzz dev] Sipariş DD-${order.number} → ${order.branchId} POS'una iletildi (simülasyon)`,
    );
    await prisma.order.update({
      where: { id: order.id },
      data: { forwardedAt: new Date() },
    });

    if (!env.POS_DEV_AUTOADVANCE) return;
    const advance = (status: 'PREPARING' | 'READY', delay: number) => {
      const timer = setTimeout(() => {
        advanceOrderStatus(prisma, order.number, status, { strict: false }).catch(
          (err) =>
            logger.warn(
              `[Kerzz dev] DD-${order.number} ${status} ilerletilemedi: ${err}`,
            ),
        );
      }, delay);
      timer.unref(); // süreç kapanışını bekletmesin
    };
    advance('PREPARING', PREPARING_DELAY_MS);
    advance('READY', READY_DELAY_MS);
  }
}

export const kerzzPosClient: KerzzPosClient = new DevKerzzPosClient();

const SWEEP_INTERVAL_MS = 60_000;

/// Mini-outbox süpürücüsü: parası ödenmiş ama POS'a iletimi onaylanmamış
/// siparişleri periyodik yeniden dener. İletim "at ve unut" olsa bile
/// sipariş kalıcı olarak kaybolamaz. Açılışta bir kez + 60 sn'de bir.
export function startForwardSweep(): void {
  if (env.NODE_ENV === 'test') return;

  const sweep = async () => {
    try {
      const pending = await prisma.order.findMany({
        where: { status: 'RECEIVED', forwardedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      for (const order of pending) {
        logger.warn(`[Outbox] İletilmemiş sipariş yeniden deneniyor: DD-${order.number}`);
        await kerzzPosClient
          .forwardOrder(order)
          .catch((err) =>
            logger.error(`[Outbox] DD-${order.number} iletilemedi: ${err}`),
          );
      }
    } catch (err) {
      logger.error(`[Outbox] Süpürme hatası: ${err}`);
    }
  };

  void sweep();
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS).unref();
}
