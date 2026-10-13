import { z } from 'zod';

const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const version = z.number().int().min(0).max(2_147_483_646);
const quantity = z.number().int().min(1).max(99);
const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Kontrol karakterleri kullanılamaz.');
export const cartAddInput = z.object({ version, variantId: id, grindId: id.nullable().default(null), quantity }).strict();
export const cartQuantityInput = z.object({ version, quantity }).strict();
export const cartVersionInput = z.object({ version }).strict();
export const cartAddressInput = z.object({ version, addressId: id.nullable() }).strict();

export function normalizeTurkishPhone(value: string): string {
  const stripped = value.trim().replace(/[\s()-]/g, '');
  if (/^0090/.test(stripped)) return `+${stripped.slice(2)}`;
  if (/^90\d{10}$/.test(stripped)) return `+${stripped}`;
  if (/^0\d{10}$/.test(stripped)) return `+90${stripped.slice(1)}`;
  if (/^\d{10}$/.test(stripped)) return `+90${stripped}`;
  return stripped;
}
const addressFields = {
  title: text(1, 60), recipientName: text(2, 120),
  phone: z.string().max(32).transform(normalizeTurkishPhone).pipe(z.string().regex(/^\+90[2-5]\d{9}$/, 'Geçerli bir Türkiye telefon numarası gerekli.')),
  country: z.literal('TR'), provinceCode: z.string().regex(/^(0[1-9]|[1-7][0-9]|8[01])$/),
  district: text(2, 100), neighborhood: text(2, 120), addressLine: z.string().transform((value) => value.replace(/\r?\n/g, ' ')).pipe(text(10, 500)),
  postalCode: z.string().trim().regex(/^(?:\d{5})?$/).default(''), isDefault: z.boolean(),
};
const checkPostal = (value: {postalCode: string; provinceCode: string}, ctx: z.RefinementCtx) => {
  if (value.postalCode && !value.postalCode.startsWith(value.provinceCode)) ctx.addIssue({ code: 'custom', path: ['postalCode'], message: 'Posta kodu seçilen ile ait olmalı.' });
};
export const addressCreateInput = z.object(addressFields).strict().superRefine(checkPostal);
export const addressUpdateInput = z.object({ ...addressFields, version: version.min(1) }).strict().superRefine(checkPostal);
export const addressVersionInput = z.object({ version: version.min(1) }).strict();
export type AddressInput = z.infer<typeof addressCreateInput>;
const money = z.number().int().min(0).max(100_000_000);
export const shippingInput = z.object({
  version: version.min(1), enabled: z.boolean(), feeMinor: money.nullable(),
  freeShippingThresholdMinor: money.min(1).nullable(), country: z.literal('TR'), currency: z.literal('TRY'),
}).strict().superRefine((value, ctx) => {
  if (value.feeMinor === null && value.freeShippingThresholdMinor !== null) ctx.addIssue({ code: 'custom', path: ['freeShippingThresholdMinor'], message: 'Ücretsiz kargo eşiği için kargo ücreti tanımlanmalı.' });
});
export type ShippingInput = z.infer<typeof shippingInput>;
