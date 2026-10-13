import { Prisma, type PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError, ErrorCodes } from '../../lib/errors.js';
import type { ProductInput } from './catalog.schemas.js';

export const productInclude = {
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
  variants: { orderBy: { sku: 'asc' as const } },
  grindOptions: { orderBy: { sortOrder: 'asc' as const } },
};
type ProductRecord = Prisma.WebProductGetPayload<{ include: typeof productInclude }>;
export function serializeProduct(product: ProductRecord, publicOnly = false) {
  return {
    id: product.id, slug: product.slug, type: product.type, status: product.status,
    nameTr: product.nameTr, nameEn: product.nameEn, descriptionTr: product.descriptionTr, descriptionEn: product.descriptionEn,
    sortOrder: product.sortOrder, version: product.version,
    images: product.images.map(({ id, mediaId, media, altTr, altEn, sortOrder }) => ({ id, mediaId, url: `/web/media/${media.filename}`, altTr, altEn, sortOrder })),
    variants: product.variants.filter((item) => !publicOnly || item.active).map(({ productId: _productId, ...item }) => item),
    grindOptions: product.grindOptions.filter((item) => !publicOnly || item.active).map(({ productId: _productId, ...item }) => item),
  };
}
const bad = (message: string) => new AppError(ErrorCodes.VALIDATION_ERROR, 400, message);
const conflict = () => new AppError(ErrorCodes.IDEMPOTENCY_CONFLICT, 409, 'Ürün başka bir işlemde değiştirildi. Güncel ürünü yükleyip tekrar deneyin.');
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function saveProduct(database: PrismaClient, input: ProductInput, adminId: string | null, id?: string) {
  if (id && !input.version) throw bad('Düzenleme için ürün sürümü gerekli.');
  if (!id && [...input.variants, ...input.images, ...input.grindOptions].some((item) => item.id)) throw bad('Yeni ürün için mevcut alt kayıt kimliği gönderilemez.');
  try {
    return await database.$transaction(async (tx) => {
      const before = id ? await tx.webProduct.findUnique({ where: { id }, include: productInclude }) : null;
      if (id && !before) throw AppError.notFound('Ürün bulunamadı.');
      if (before && before.version !== input.version) throw conflict();
      for (const key of ['variants', 'images', 'grindOptions'] as const) {
        const owned = new Set(before?.[key].map((item) => item.id));
        if (input[key].some((item) => item.id && !owned.has(item.id))) throw bad('Alt kayıt kimliği bu ürüne ait değil.');
        if (key !== 'images' && [...owned].some((id) => !input[key].some((item) => item.id === id))) throw bad('Mevcut varyant ve öğütüm kayıtları silinemez; pasif olarak kaydedin.');
      }
      const mediaCount = await tx.webMedia.count({ where: { id: { in: input.images.map((item) => item.mediaId) } } });
      if (mediaCount !== input.images.length) throw bad('Galeride bulunamayan görsel var; yeniden yükleyin.');
      const oldVariants = before?.variants ?? [];
      const stockChanges = oldVariants.some((old) => {
        const updated = input.variants.find((item) => item.id === old.id);
        return updated ? updated.stock !== old.stock : old.stock > 0;
      }) || input.variants.some((item) => !item.id && item.stock > 0);
      if (before && stockChanges && !input.stockReason?.trim()) throw bad('Stok değişikliği için gerekçe gerekli.');
      const data = { slug: input.slug, type: input.type, status: input.status, nameTr: input.nameTr, nameEn: input.nameEn,
        descriptionTr: input.descriptionTr, descriptionEn: input.descriptionEn, sortOrder: input.sortOrder };
      let productId: string;
      if (before) {
        const updated = await tx.webProduct.updateMany({ where: { id: before.id, version: input.version }, data: { ...data, version: { increment: 1 } } });
        if (!updated.count) throw conflict();
        productId = before.id;
      } else productId = (await tx.webProduct.create({ data })).id;
      const imageIds = input.images.flatMap((item) => item.id ? [item.id] : []);
      await tx.webProductImage.deleteMany({ where: { productId, id: { notIn: imageIds } } });
      for (const item of input.images) {
        const { id: itemId, ...values } = item;
        if (itemId) await tx.webProductImage.update({ where: { id: itemId }, data: values });
        else await tx.webProductImage.create({ data: { ...values, productId } });
      }
      for (const item of input.variants) {
        const { id: itemId, ...values } = item;
        if (itemId) {
          // Stock is sellable inventory. Outstanding reservations can return on
          // cancellation; leave room below the database's inventory ceiling.
          const reserved = await tx.webOrderItem.aggregate({ where: { variantId: itemId, order: { stockReleasedAt: null, paymentStatus: { not: 'PAID' } } }, _sum: { quantity: true } });
          if (item.stock + (reserved._sum.quantity ?? 0) > 1_000_000) throw bad('Stok ve bekleyen sipariş rezervasyonlarının toplamı 1.000.000 adedi aşamaz.');
        }
        const record = itemId ? await tx.webProductVariant.update({ where: { id: itemId }, data: values }) : await tx.webProductVariant.create({ data: { ...values, productId } });
        const previous = oldVariants.find((old) => old.id === itemId)?.stock ?? 0;
        if (previous !== item.stock) await tx.webStockAdjustment.create({ data: { productId, variantId: record.id, sku: record.sku, adminId, previous, current: item.stock, reason: input.stockReason?.trim() || 'İlk ürün kaydı' } });
      }
      for (const item of input.grindOptions) {
        const { id: itemId, ...values } = item;
        if (itemId) await tx.webGrindOption.update({ where: { id: itemId }, data: values });
        else await tx.webGrindOption.create({ data: { ...values, productId } });
      }
      const after = serializeProduct(await tx.webProduct.findUniqueOrThrow({ where: { id: productId }, include: productInclude }));
      await tx.webCatalogAudit.create({ data: { productId, adminId, action: before ? 'UPDATE' : 'CREATE', ...(before ? { before: json(serializeProduct(before)) } : {}), after: json(after) } });
      return after;
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(ErrorCodes.IDEMPOTENCY_CONFLICT, 409, 'Slug, SKU veya seçenek kodu başka bir kayıtta kullanılıyor.');
    throw error;
  }
}
