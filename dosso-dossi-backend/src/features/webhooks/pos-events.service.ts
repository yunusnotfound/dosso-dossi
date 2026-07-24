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

/// Handler, olay satırıyla AYNI transaction içinde çalışır.
type PosEventHandler = (
  tx: Prisma.TransactionClient,
) => Promise<Record<string, unknown>>;

/// Tüm POS/ödeme olaylarının idempotency omurgası.
///
/// Atomiklik garantisi: handler'ın yan etkileri ile olayın PROCESSED
/// işaretlenmesi tek transaction'dır. Süreç ortada çökerse ikisi birden
/// geri sarılır → satır RECEIVED kalır ve bir sonraki deneme GÜVENLE
/// yeniden işler (yarım iş için sahte "başarılı" yanıtı dönemez).
/// Eşzamanlı iki deneme, satır kilidi + guard'lı updateMany ile çözülür:
/// yalnız biri işler, diğeri saklanan yanıtı döner.
export async function runPosEvent(
  key: PosEventKey,
  handler: PosEventHandler,
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
      if (existing.status === 'FAILED' || existing.status === 'RECEIVED') {
        // FAILED → yeniden denenebilir; RECEIVED → önceki deneme yarıda
        // kalmış (çökme) ya da şu an işleniyor — aşağıdaki guard çözer.
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

  const eventId = event.id;
  try {
    const response = await prisma.$transaction(async (tx) => {
      // Satırı sahiplen: eşzamanlı ikinci deneme burada kilitte bekler,
      // ilki commit edince count 0 alır ve işi tekrarlamaz.
      const claimed = await tx.posEvent.updateMany({
        where: { id: eventId, status: { in: ['RECEIVED', 'FAILED'] } },
        data: { processedAt: new Date(), error: null },
      });
      if (claimed.count === 0) return null;

      const res = await handler(tx);
      await tx.posEvent.update({
        where: { id: eventId },
        data: {
          status: res['skipped'] ? 'SKIPPED' : 'PROCESSED',
          response: res as Prisma.InputJsonValue,
        },
      });
      return res;
    });

    if (response === null) {
      const done = await prisma.posEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      return {
        duplicate: true,
        response: (done.response ?? { ok: true }) as Record<string, unknown>,
      };
    }
    return { duplicate: false, response };
  } catch (err) {
    // İş geri sarıldı; olay bilgilendirme amaçlı FAILED işaretlenir
    await prisma.posEvent
      .update({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          error:
            err instanceof AppError ? `${err.code}: ${err.message}` : String(err),
          processedAt: new Date(),
        },
      })
      .catch(() => {});
    throw err;
  }
}
