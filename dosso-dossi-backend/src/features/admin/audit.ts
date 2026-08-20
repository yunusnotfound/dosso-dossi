import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';

/// Panelden yapılan her yazmanın izi. Para ve sadakat düzeltmelerinde
/// `reason` zorunludur — çağıran servis boş bırakmamalıdır.
export interface AuditInput {
  action: string; // "order.cancel", "wallet.adjust"
  entity: string; // "Order", "Wallet"
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

/// İşlemin kendi transaction'ında yazılır: kayıt geri alınırsa iz de alınır,
/// yani "audit var ama işlem yok" durumu oluşmaz.
export async function audit(
  tx: Prisma.TransactionClient,
  req: Request,
  input: AuditInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: toJson(input.before),
      after: toJson(input.after),
      reason: input.reason ?? '',
      ip: req.ip ?? '',
    },
  });
}

/// Transaction dışı (salt okuma sonrası) iz düşmek için.
export async function auditStandalone(
  req: Request,
  input: AuditInput,
): Promise<void> {
  await audit(prisma, req, input);
}

/// Decimal/Date gibi Prisma tiplerini JSON'a çevirir; undefined → null.
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === 'bigint' || typeof v === 'object' ? serialize(v) : v,
    ),
  ) as Prisma.InputJsonValue;
}

function serialize(v: unknown): unknown {
  if (v === null) return null;
  // Prisma.Decimal ve Date toJSON/toString ile düzleşir
  if (typeof v === 'object' && 'toFixed' in (v as object)) return String(v);
  return v;
}
