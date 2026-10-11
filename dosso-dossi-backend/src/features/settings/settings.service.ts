import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export const SETTING_DEFAULTS = {
  'loyalty.stampTarget': 5,
  'loyalty.topUpBonusThreshold': 1000,
  'loyalty.topUpBonusDrinks': 5,
  'loyalty.topUpBonusFirstOnly': true,
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
const money = z.number().min(0.01).max(100000).refine(
  (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7, 'En fazla iki ondalık basamak kullanın',
);
const validators = {
  'loyalty.stampTarget': z.number().int().min(1).max(100),
  'loyalty.topUpBonusThreshold': money,
  'loyalty.topUpBonusDrinks': z.number().int().min(0).max(100),
  'loyalty.topUpBonusFirstOnly': z.boolean(),
};
export const settingSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('loyalty.stampTarget'), value: validators['loyalty.stampTarget'] }),
  z.object({ key: z.literal('loyalty.topUpBonusThreshold'), value: money }),
  z.object({ key: z.literal('loyalty.topUpBonusDrinks'), value: validators['loyalty.topUpBonusDrinks'] }),
  z.object({ key: z.literal('loyalty.topUpBonusFirstOnly'), value: z.boolean() }),
]);
function safeValue(key: SettingKey, value: unknown): number | boolean {
  const parsed = validators[key].safeParse(value);
  if (parsed.success) return parsed.data;
  logger.warn('Geçersiz kayıtlı ayar için varsayılan kullanılıyor', { key });
  return SETTING_DEFAULTS[key];
}
const TTL_MS = 30_000;
let cache: Map<string, unknown> | null = null;
let loadedAt = 0;
let generation = 0;
async function load(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const version = generation;
  const rows = await prisma.setting.findMany();
  const map = new Map<string, unknown>(Object.entries(SETTING_DEFAULTS));
  for (const row of rows) {
    if (Object.hasOwn(SETTING_DEFAULTS, row.key)) map.set(row.key, safeValue(row.key as SettingKey, row.value));
  }
  if (version === generation) { cache = map; loadedAt = Date.now(); }
  return map;
}
export function invalidateSettingsCache(): void { cache = null; generation++; }
export async function getSetting<T>(key: SettingKey, tx?: Prisma.TransactionClient): Promise<T> {
  if (tx) {
    const row = await tx.setting.findUnique({ where: { key } });
    return (row ? safeValue(key, row.value) : SETTING_DEFAULTS[key]) as T;
  }
  return (await load()).get(key) as T;
}
export async function allSettings(): Promise<Record<string, unknown>> {
  return Object.fromEntries(await load());
}
export async function publicSettings() {
  const values = await allSettings();
  return {
    stampTarget: values['loyalty.stampTarget'],
    topupThreshold: values['loyalty.topUpBonusThreshold'],
    topupBonusDrinks: values['loyalty.topUpBonusDrinks'],
    topupFirstOnly: values['loyalty.topUpBonusFirstOnly'],
  };
}
export async function setSetting(req: Request, key: SettingKey, value: unknown): Promise<void> {
  const input = settingSchema.parse({ key, value });
  const { audit } = await import('../admin/audit.js');
  await prisma.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({ where: { key } });
    const after = await tx.setting.upsert({
      where: { key }, update: { value: input.value }, create: { key, value: input.value },
    });
    await audit(tx, req, {
      action: 'setting.update', entity: 'Setting', entityId: key,
      before: before?.value ?? SETTING_DEFAULTS[key], after: after.value, reason: 'Panel ayarı',
    });
  });
  invalidateSettingsCache();
}
