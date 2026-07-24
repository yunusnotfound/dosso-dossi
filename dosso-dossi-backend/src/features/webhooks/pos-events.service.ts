import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

interface PosEventKey {
  source: string; // "kerzz" | "payment" | "simulator"
  eventType: string; // "charge" | "charge_void" | "sale" | "order_status" | "payment_confirmation"
  externalId: string;
  payload: unknown;
}

export interface PosEventResult {
  /// Aynı externalId daha önce işlendiyse true; yanıt ilk işlemin aynısıdır.
  duplicate: boolean;
  response: Record<string, unknown>;
}

/// Tüm POS/ödeme olaylarının idempotency omurgası. Olay önce deftere
/// yazılır; aynı (source, eventType, externalId) ikinci kez gelirse
/// handler HİÇ çalıştırılmaz, saklanan yanıt aynen döner.
/// Handler AppError fırlatırsa olay FAILED işaretlenir ve hata yükselir;
/// aynı externalId FAILED durumdayken yeniden denenebilir.
export async function runPosEvent(
  key: PosEventKey,
  handler: () => Promise<Record<string, unknown>>,
): Promise<PosEventResult> {
  let event;
  try {
    event = await prisma.posEvent.create({
      data: {
        source: key.source,
        eventType: key.eventType,
        externalId: key.externalId,
        payload: key.payload as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const existing = await prisma.posEvent.findUniqueOrThrow({
        where: {
          source_eventType_externalId: {
            source: key.source,
            eventType: key.eventType,
            externalId: key.externalId,
          },
        },
      });
      if (existing.status === 'FAILED') {
        // Başarısız olay yeniden denenebilir
        event = existing;
      } else {
        logger.info(
          `[PosEvent] Duplicate ${key.source}/${key.eventType}/${key.externalId} — saklanan yanıt dönüldü`,
        );
        return {
          duplicate: true,
          response: (existing.response ?? { ok: true }) as Record<
            string,
            unknown
          >,
        };
      }
    } else {
      throw err;
    }
  }

  try {
    const response = await handler();
    await prisma.posEvent.update({
      where: { id: event.id },
      data: {
        status: response['skipped'] ? 'SKIPPED' : 'PROCESSED',
        response: response as Prisma.InputJsonValue,
        processedAt: new Date(),
        error: null,
      },
    });
    return { duplicate: false, response };
  } catch (err) {
    await prisma.posEvent.update({
      where: { id: event.id },
      data: {
        status: 'FAILED',
        error: err instanceof AppError ? `${err.code}: ${err.message}` : String(err),
        processedAt: new Date(),
      },
    });
    throw err;
  }
}
