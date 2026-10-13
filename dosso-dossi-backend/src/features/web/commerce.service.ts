import { Prisma, type PrismaClient, type WebDeliveryAddress, type WebProductVariant, type WebStoreSettings } from '@dosso-dossi/web-prisma';
import { AppError, ErrorCodes } from '../../lib/errors.js';
import { productInclude } from './catalog.service.js';
import type { AddressInput, ShippingInput } from './commerce.schemas.js';

type Tx = Prisma.TransactionClient;
const conflict = () => new AppError(ErrorCodes.IDEMPOTENCY_CONFLICT, 409, 'Bilgiler başka bir işlemde değişti. Güncel bilgileri yükleyip tekrar deneyin.');
const invalid = (message: string) => new AppError(ErrorCodes.VALIDATION_ERROR, 400, message);
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const variantLabel = (variant: WebProductVariant, locale: 'tr' | 'en') =>
  (locale === 'tr' ? variant.labelTr : variant.labelEn) || [locale === 'tr' ? variant.colorNameTr : variant.colorNameEn,
    variant.weightGrams ? `${variant.weightGrams} g` : null, variant.volumeMl ? `${variant.volumeMl} ml` : null].filter(Boolean).join(' · ');

async function transaction<T>(database: PrismaClient, work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await database.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
      if (attempt >= 2) throw conflict();
    }
  }
}
async function customerTransaction<T>(database: PrismaClient, customerId: string, work: (tx: Tx) => Promise<T>) {
  return transaction(database, async (tx) => {
    // All cart/address writes for one account share this lock, including first
    // cart creation and selecting/deleting an address concurrently.
    await tx.$queryRaw`SELECT "id" FROM "WebCustomer" WHERE "id"=${customerId} FOR UPDATE`;
    const customer = await tx.webCustomer.findUnique({ where: { id: customerId }, select: { active: true, emailVerifiedAt: true } });
    if (!customer?.active || !customer.emailVerifiedAt) throw AppError.unauthorized();
    return work(tx);
  });
}
export function serializeShipping(store: Pick<WebStoreSettings, 'shippingVersion' | 'shippingEnabled' | 'shippingFeeMinor' | 'freeShippingThresholdMinor'> | null) {
  return { version: store?.shippingVersion ?? 1, enabled: store?.shippingEnabled ?? true, feeMinor: store?.shippingFeeMinor ?? null,
    freeShippingThresholdMinor: store?.freeShippingThresholdMinor ?? null, country: 'TR' as const, currency: 'TRY' as const };
}
export async function readShipping(database: PrismaClient | Tx) {
  return serializeShipping(await database.webStoreSettings.findUnique({ where: { id: 'store' } }));
}
export async function saveShipping(database: PrismaClient, input: ShippingInput, adminId: string) {
  return transaction(database, async (tx) => {
    const store = await tx.webStoreSettings.upsert({ where: { id: 'store' }, create: { id: 'store' }, update: {} });
    if (store.shippingVersion !== input.version) throw conflict();
    const updated = await tx.webStoreSettings.updateMany({ where: { id: 'store', shippingVersion: input.version }, data: {
      shippingEnabled: input.enabled, shippingFeeMinor: input.feeMinor, freeShippingThresholdMinor: input.freeShippingThresholdMinor,
      shippingVersion: { increment: 1 },
    } });
    if (updated.count !== 1) throw conflict();
    const shipping = await readShipping(tx);
    await tx.webShippingAudit.create({ data: { adminId, before: json(serializeShipping(store)), after: json(shipping) } });
    return shipping;
  });
}
export const serializeAddress = ({ customerId: _customerId, ...address }: WebDeliveryAddress) => address;
export async function listAddresses(database: PrismaClient, customerId: string) {
  const addresses = await database.webDeliveryAddress.findMany({ where: { customerId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  return addresses.map(serializeAddress);
}
async function clearDefault(tx: Tx, customerId: string, exceptId?: string) {
  await tx.webDeliveryAddress.updateMany({ where: { customerId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { isDefault: false, version: { increment: 1 } } });
}
async function ensureDefault(tx: Tx, customerId: string) {
  if (await tx.webDeliveryAddress.findFirst({ where: { customerId, isDefault: true } })) return;
  const first = await tx.webDeliveryAddress.findFirst({ where: { customerId }, orderBy: { createdAt: 'asc' } });
  if (first) await tx.webDeliveryAddress.update({ where: { id: first.id }, data: { isDefault: true, version: { increment: 1 } } });
}
export async function createAddress(database: PrismaClient, customerId: string, input: AddressInput) {
  return customerTransaction(database, customerId, async (tx) => {
    const count = await tx.webDeliveryAddress.count({ where: { customerId } });
    if (count >= 10) throw invalid('En fazla 10 teslimat adresi kaydedebilirsiniz.');
    const isDefault = count === 0 || input.isDefault;
    if (isDefault) await clearDefault(tx, customerId);
    return serializeAddress(await tx.webDeliveryAddress.create({ data: { ...input, customerId, isDefault } }));
  });
}
export async function updateAddress(database: PrismaClient, customerId: string, id: string, input: AddressInput & {version: number}) {
  return customerTransaction(database, customerId, async (tx) => {
    const current = await tx.webDeliveryAddress.findFirst({ where: { id, customerId } });
    if (!current) throw AppError.notFound('Adres bulunamadı.');
    if (current.version !== input.version) throw conflict();
    if (input.isDefault) await clearDefault(tx, customerId, id);
    const { version: _version, ...values } = input;
    await tx.webDeliveryAddress.update({ where: { id }, data: { ...values, version: { increment: 1 } } });
    await ensureDefault(tx, customerId);
    await tx.webCart.updateMany({ where: { customerId, deliveryAddressId: id }, data: { version: { increment: 1 } } });
    return serializeAddress(await tx.webDeliveryAddress.findUniqueOrThrow({ where: { id } }));
  });
}
export async function deleteAddress(database: PrismaClient, customerId: string, id: string, version: number) {
  await customerTransaction(database, customerId, async (tx) => {
    const current = await tx.webDeliveryAddress.findFirst({ where: { id, customerId } });
    if (!current) throw AppError.notFound('Adres bulunamadı.');
    if (current.version !== version) throw conflict();
    await tx.webDeliveryAddress.delete({ where: { id } });
    await ensureDefault(tx, customerId);
    await tx.webCart.updateMany({ where: { customerId, deliveryAddressId: id }, data: { deliveryAddressId: null, version: { increment: 1 } } });
  });
}

export async function cartSnapshot(tx: Tx, customerId: string) {
  const cart = await tx.webCart.findUnique({ where: { customerId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
  const items = cart?.items ?? [];
  const products = await tx.webProduct.findMany({ where: { id: { in: [...new Set(items.map((item) => item.productId))] } }, include: productInclude });
  const totals = new Map<string, number>();
  items.forEach((item) => totals.set(item.variantId, (totals.get(item.variantId) ?? 0) + item.quantity));
  const lines = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    const grind = item.grindId ? product?.grindOptions.find((candidate) => candidate.id === item.grindId) : null;
    const requiresGrind = product?.type === 'COFFEE' && product.grindOptions.some((candidate) => candidate.active);
    const selectable = Boolean(product?.status === 'PUBLISHED' && variant?.active &&
      (item.grindId ? product.type === 'COFFEE' && grind?.active : !requiresGrind));
    const issue = !selectable ? 'UNAVAILABLE' as const : (totals.get(item.variantId) ?? 0) > variant!.stock ? 'INSUFFICIENT_STOCK' as const : null;
    const unitPriceMinor = selectable ? variant!.priceMinor + (grind?.priceDeltaMinor ?? 0) : null;
    const image = product?.images.find((candidate) => candidate.mediaId === variant?.imageId) ?? product?.images[0];
    return { id: item.id, variantId: item.variantId, grindId: item.grindId || null, quantity: item.quantity,
      productId: product?.id ?? null, slug: product?.slug ?? null, nameTr: product?.nameTr ?? item.nameTr, nameEn: product?.nameEn ?? item.nameEn,
      variantLabelTr: variant ? variantLabel(variant, 'tr') : item.variantLabelTr, variantLabelEn: variant ? variantLabel(variant, 'en') : item.variantLabelEn,
      grindNameTr: grind?.nameTr ?? item.grindNameTr, grindNameEn: grind?.nameEn ?? item.grindNameEn,
      imageUrl: image ? `/web/media/${image.media.filename}` : null, unitPriceMinor,
      lineTotalMinor: unitPriceMinor === null ? null : unitPriceMinor * item.quantity,
      availableQuantity: selectable ? Math.max(0, Math.min(99, variant!.stock - ((totals.get(item.variantId) ?? 0) - item.quantity))) : 0, issue,
    };
  });
  const shipping = await readShipping(tx);
  const configured = shipping.feeMinor !== null;
  const subtotalMinor = lines.reduce((sum, line) => sum + (line.lineTotalMinor ?? 0), 0);
  const selectedAddress = cart?.deliveryAddressId ? await tx.webDeliveryAddress.findFirst({ where: { id: cart.deliveryAddressId, customerId }, select: { id: true } }) : null;
  const hasItems = lines.length > 0;
  const linesValid = lines.every((line) => line.issue === null);
  const canQuote = linesValid && shipping.enabled && configured;
  const shippingFeeMinor = !hasItems ? 0 : !canQuote ? null : shipping.freeShippingThresholdMinor !== null && subtotalMinor >= shipping.freeShippingThresholdMinor ? 0 : shipping.feeMinor;
  const valid = hasItems && linesValid && shipping.enabled && configured && Boolean(selectedAddress);
  const totalMinor = !hasItems ? 0 : valid && shippingFeeMinor !== null ? subtotalMinor + shippingFeeMinor : null;
  return { customerId, version: cart?.version ?? 0, lines, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), subtotalMinor,
    selectedAddressId: selectedAddress?.id ?? null, shipping: { enabled: shipping.enabled, configured, feeMinor: shipping.feeMinor,
      freeShippingThresholdMinor: shipping.freeShippingThresholdMinor, country: shipping.country, currency: shipping.currency },
    shippingFeeMinor, totalMinor, freeShippingRemainingMinor: hasItems && canQuote && shipping.freeShippingThresholdMinor !== null ? shipping.feeMinor === 0 ? 0 : Math.max(0, shipping.freeShippingThresholdMinor - subtotalMinor) : null, valid };
}
export async function readCart(database: PrismaClient, customerId: string) {
  return database.$transaction((tx) => cartSnapshot(tx, customerId), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
async function writableCart(tx: Tx, customerId: string, version: number) {
  const cart = await tx.webCart.upsert({ where: { customerId }, create: { customerId }, update: {} });
  if (cart.version !== version) throw conflict();
  await tx.webCart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
  return cart;
}
async function selection(tx: Tx, variantId: string, grindId: string | null) {
  const variant = await tx.webProductVariant.findUnique({ where: { id: variantId }, include: { product: { include: productInclude } } });
  if (!variant?.active || variant.product.status !== 'PUBLISHED') throw AppError.productUnavailable();
  const product = variant.product;
  const grind = grindId ? product.grindOptions.find((candidate) => candidate.id === grindId && candidate.active) : null;
  if ((grindId && (product.type !== 'COFFEE' || !grind)) || (!grindId && product.type === 'COFFEE' && product.grindOptions.some((candidate) => candidate.active))) throw AppError.productUnavailable('Geçerli bir öğütüm seçeneği seçin.');
  return { variant, product, grind };
}
async function assertStock(tx: Tx, cartId: string, variantId: string, stock: number, quantity: number, exceptId?: string) {
  const other = await tx.webCartItem.aggregate({ where: { cartId, variantId, ...(exceptId ? { id: { not: exceptId } } : {}) }, _sum: { quantity: true } });
  if ((other._sum.quantity ?? 0) + quantity > stock) throw AppError.productUnavailable('Seçilen seçeneklerin toplam adedi mevcut stoğu aşıyor.');
}
export async function addCartItem(database: PrismaClient, customerId: string, input: {version: number; variantId: string; grindId: string | null; quantity: number}) {
  return customerTransaction(database, customerId, async (tx) => {
    const cart = await writableCart(tx, customerId, input.version);
    const { product, variant, grind } = await selection(tx, input.variantId, input.grindId);
    const existing = await tx.webCartItem.findUnique({ where: { cartId_variantId_grindId: { cartId: cart.id, variantId: input.variantId, grindId: input.grindId ?? '' } } });
    const quantity = (existing?.quantity ?? 0) + input.quantity;
    if (quantity > 99) throw invalid('Bir sepet satırında en fazla 99 adet olabilir.');
    if (!existing && await tx.webCartItem.count({ where: { cartId: cart.id } }) >= 100) throw invalid('Sepette en fazla 100 farklı seçenek bulunabilir.');
    await assertStock(tx, cart.id, variant.id, variant.stock, quantity, existing?.id);
    if (existing) await tx.webCartItem.update({ where: { id: existing.id }, data: { quantity } });
    else await tx.webCartItem.create({ data: { cartId: cart.id, productId: product.id, variantId: variant.id, grindId: input.grindId ?? '', quantity,
      nameTr: product.nameTr, nameEn: product.nameEn, variantLabelTr: variantLabel(variant, 'tr'), variantLabelEn: variantLabel(variant, 'en'), grindNameTr: grind?.nameTr, grindNameEn: grind?.nameEn } });
    return cartSnapshot(tx, customerId);
  });
}
export async function changeCartItem(database: PrismaClient, customerId: string, id: string, input: {version: number; quantity: number}) {
  return customerTransaction(database, customerId, async (tx) => {
    const cart = await writableCart(tx, customerId, input.version);
    const item = await tx.webCartItem.findFirst({ where: { id, cartId: cart.id } });
    if (!item) throw AppError.notFound('Sepet satırı bulunamadı.');
    // Reductions must remain possible after stock falls or a selection is
    // disabled. The returned live snapshot stays invalid until fully corrected.
    if (input.quantity >= item.quantity) {
      const { variant } = await selection(tx, item.variantId, item.grindId || null);
      await assertStock(tx, cart.id, variant.id, variant.stock, input.quantity, item.id);
    }
    await tx.webCartItem.update({ where: { id }, data: { quantity: input.quantity } });
    return cartSnapshot(tx, customerId);
  });
}
export async function removeCartItem(database: PrismaClient, customerId: string, id: string, version: number) {
  return customerTransaction(database, customerId, async (tx) => {
    const cart = await writableCart(tx, customerId, version);
    const removed = await tx.webCartItem.deleteMany({ where: { id, cartId: cart.id } });
    if (removed.count !== 1) throw AppError.notFound('Sepet satırı bulunamadı.');
    return cartSnapshot(tx, customerId);
  });
}
export async function selectCartAddress(database: PrismaClient, customerId: string, input: {version: number; addressId: string | null}) {
  return customerTransaction(database, customerId, async (tx) => {
    const cart = await writableCart(tx, customerId, input.version);
    if (input.addressId && !await tx.webDeliveryAddress.findFirst({ where: { id: input.addressId, customerId }, select: { id: true } })) throw AppError.notFound('Adres bulunamadı.');
    await tx.webCart.update({ where: { id: cart.id }, data: { deliveryAddressId: input.addressId } });
    return cartSnapshot(tx, customerId);
  });
}
