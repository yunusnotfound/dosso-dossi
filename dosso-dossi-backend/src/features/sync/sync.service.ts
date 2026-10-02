import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';

export type SyncDomain =
  | 'menu'
  | 'branches'
  | 'campaigns'
  | 'loyalty'
  | 'wallet'
  | 'orders';

export type SyncRevisions = Record<SyncDomain, string>;

// Alan adı tüm işlemleri, "Alan:işlem" yalnız belirtilen işlemi kapsar.
// İptal siparişin yanında bakiye ve damgaları da değiştirir; normal durum
// ilerletmeleri ise yalnız sipariş görünümünü yenilemelidir.
const sources: Record<SyncDomain, readonly string[]> = {
  menu: ['Product', 'Category', 'ProductOption', 'BranchProduct'],
  branches: ['Branch', 'BranchProduct'],
  campaigns: ['Campaign', 'CampaignStory', 'PromoCode', 'Setting'],
  loyalty: ['LoyaltyAccount', 'Setting', 'Order:order.cancel'],
  wallet: ['Wallet', 'PosCharge', 'Order:order.cancel'],
  orders: ['Order'],
};

const entities = [
  ...new Set(Object.values(sources).flat().map((source) => source.split(':')[0]!)),
];

/// Panel değişikliklerinin herkese açık, opak yenileme işaretleri.
/// Audit kaydı asıl değişiklikle aynı transaction'da yazıldığı için yalnız
/// tamamlanmış işlemler görünür; tek sorgu tüm alanları aynı DB anında okur.
/// Sayı, geç tamamlanan/eski kimlikli işlemleri de yakalar. Silme ve toplu
/// işlemler audit'te kaldığından bunlar da sürümü değiştirir.
///
/// Bellekte sayaç tutulmaz: farklı sunucular ve yeniden başlatmalar aynı
/// sonucu üretir. Müşteri kimliği, audit içeriği ve ham sayaçlar dışa çıkmaz.
/// Audit kullanmayan doğrudan SQL/seed değişiklikleri bu sözleşmenin dışında;
/// istemci açılışta ve ön plana döndüğünde ayrıca verileri yenilemelidir.
export async function getSyncRevisions(): Promise<SyncRevisions> {
  const groups = await prisma.auditLog.groupBy({
    by: ['entity', 'action'],
    where: { entity: { in: entities } },
    _count: { _all: true },
    _max: { id: true },
    orderBy: [{ entity: 'asc' }, { action: 'asc' }],
  });

  return Object.fromEntries(
    Object.entries(sources).map(([domain, domainSources]) => {
      const state = groups
        .filter(
          (group) =>
            domainSources.includes(group.entity) ||
            domainSources.includes(`${group.entity}:${group.action}`),
        )
        .map((group) => [
          group.entity,
          group.action,
          group._count._all,
          group._max.id,
        ]);
      const revision = createHash('sha256')
        .update(JSON.stringify(['panel-sync-v1', domain, state]))
        .digest('hex');
      return [domain, revision];
    }),
  ) as SyncRevisions;
}
