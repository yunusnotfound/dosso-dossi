import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const id = z.string().min(1).max(80);
const nullableText = (max: number) => text(max).nullable().default(null);
const money = z.number().int().min(0).max(100_000_000);
const amount = z.number().int().min(1).max(100_000).nullable().default(null);
const variant = z.object({
  id: id.optional(), sku: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/),
  labelTr: text(120).default(''), labelEn: text(120).default(''),
  colorNameTr: nullableText(80), colorNameEn: nullableText(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
  weightGrams: amount, volumeMl: amount, priceMinor: money,
  stock: z.number().int().min(0).max(1_000_000), active: z.boolean(), imageId: id.nullable().default(null),
}).strict();
const grind = z.object({
  id: id.optional(), code: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/),
  nameTr: text(120).min(1), nameEn: text(120).min(1), priceDeltaMinor: money,
  sortOrder: z.number().int().min(0).max(10_000), active: z.boolean(),
}).strict();
export const productInput = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(['COFFEE', 'THERMOS']), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  nameTr: text(180).min(1), nameEn: text(180), descriptionTr: text(10000), descriptionEn: text(10000),
  sortOrder: z.number().int().min(0).max(10_000), version: z.number().int().min(1).optional(),
  images: z.array(z.object({ id: id.optional(), mediaId: id, altTr: text(250), altEn: text(250), sortOrder: z.number().int().min(0).max(10000) }).strict()).max(20),
  variants: z.array(variant).max(100), grindOptions: z.array(grind).max(30),
  stockReason: text(500).optional(),
}).strict().superRefine((value, ctx) => {
  const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  for (const key of ['variants', 'images', 'grindOptions'] as const) {
    const ids = value[key].flatMap((item) => item.id ? [item.id] : []);
    if (new Set(ids).size !== ids.length) fail([key], 'Aynı kayıt birden fazla gönderilemez.');
  }
  if (new Set(value.variants.map((item) => item.sku)).size !== value.variants.length) fail(['variants'], 'SKU benzersiz olmalı.');
  if (new Set(value.images.map((item) => item.mediaId)).size !== value.images.length) fail(['images'], 'Galeri görselleri benzersiz olmalı.');
  if (new Set(value.grindOptions.map((item) => item.code)).size !== value.grindOptions.length) fail(['grindOptions'], 'Öğütüm kodları benzersiz olmalı.');
  if (value.type === 'THERMOS' && value.grindOptions.length) fail(['grindOptions'], 'Termos için öğütüm tanımlanamaz.');
  value.variants.forEach((item, index) => {
    if (item.imageId && !value.images.some((image) => image.mediaId === item.imageId)) fail(['variants', index, 'imageId'], 'Varyant görseli ürün galerisinde olmalı.');
    if (value.type === 'COFFEE' && !item.weightGrams) fail(['variants', index, 'weightGrams'], 'Kahve gramajı gerekli.');
    if (value.type === 'COFFEE' && item.volumeMl) fail(['variants', index, 'volumeMl'], 'Kahve gramaj ile tanımlanmalı.');
    if (value.type === 'THERMOS' && item.weightGrams) fail(['variants', index, 'weightGrams'], 'Termos için gramaj seçeneği tanımlanamaz.');
  });
  if (value.status === 'PUBLISHED') {
    if (!value.nameEn) fail(['nameEn'], 'Yayın için İngilizce ürün adı gerekli.');
    if (!value.images.length) fail(['images'], 'Yayın için en az bir görsel gerekli.');
    if (!value.variants.some((item) => item.active)) fail(['variants'], 'Yayın için en az bir aktif varyant gerekli.');
  }
});
export type ProductInput = z.infer<typeof productInput>;
export const loginInput = z.object({ email: z.email().max(254).transform((v) => v.toLowerCase()), password: z.string().min(1).max(512) }).strict();
export const mediaInput = z.object({
  filename: text(180).min(1), mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  data: z.string().min(4).max(7_000_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
}).strict();
