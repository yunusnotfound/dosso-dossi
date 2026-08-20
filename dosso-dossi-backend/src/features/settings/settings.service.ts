import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';

/// Panelden yönetilen çalışma zamanı ayarları. Koddaki sabitler burada
/// varsayılan olarak durur; DB'de kayıt varsa o kazanır.
///
/// Kampanya kuralı "ilk yüklemeye özel" olduğu için eşik + ikram sayısının
/// yanında ONLY_FIRST bayrağı da ayar: kural değişirse kod değişmesin.
export const SETTING_DEFAULTS = {
  'loyalty.stampTarget': 5,
  'loyalty.topUpBonusThreshold': 1000,
  'loyalty.topUpBonusDrinks': 5,
  'loyalty.topUpBonusFirstOnly': true,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

const TTL_MS = 30_000;
let cache: Map<string, unknown> | null = null;
let loadedAt = 0;

async function load(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await prisma.setting.findMany();
  const map = new Map<string, unknown>(Object.entries(SETTING_DEFAULTS));
  for (const r of rows) map.set(r.key, r.value);
  cache = map;
  loadedAt = Date.now();
  return map;
}

export function invalidateSettingsCache(): void {
  cache = null;
}

export async function getSetting<T>(key: SettingKey): Promise<T> {
  const map = await load();
  return map.get(key) as T;
}

export async function allSettings(): Promise<Record<string, unknown>> {
  return Object.fromEntries(await load());
}

/// Ayar değişikliği audit'li: sadakat/para kurallarını değiştiriyor.
export async function setSetting(
  req: Request,
  key: SettingKey,
  value: unknown,
): Promise<void> {
  const { audit } = await import('../admin/audit.js');
  await prisma.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({ where: { key } });
    const after = await tx.setting.upsert({
      where: { key },
      update: { value: value as never },
      create: { key, value: value as never },
    });
    await audit(tx, req, {
      action: 'setting.update',
      entity: 'Setting',
      entityId: key,
      before: before?.value ?? SETTING_DEFAULTS[key],
      after: after.value,
      reason: 'Panel ayarı',
    });
  });
  invalidateSettingsCache();
}
