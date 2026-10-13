export type Admin = { id: string; email: string; name: string; role: string };
export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ProductType = "COFFEE" | "THERMOS";
export type ProductImage = { id?: string; mediaId: string; url: string; altTr: string; altEn: string; sortOrder: number };
export type ProductVariant = {
  id?: string; sku: string; labelTr: string; labelEn: string;
  colorNameTr: string | null; colorNameEn: string | null; colorHex: string | null;
  weightGrams: number | null; volumeMl: number | null; priceMinor: number;
  stock: number; active: boolean; imageId: string | null;
};
export type GrindOption = { id?: string; code: string; nameTr: string; nameEn: string; priceDeltaMinor: number; sortOrder: number; active: boolean };
export type AdminProduct = {
  id: string; slug: string; type: ProductType; status: ProductStatus;
  nameTr: string; nameEn: string; descriptionTr: string; descriptionEn: string;
  sortOrder: number; version: number; images: ProductImage[];
  variants: ProductVariant[]; grindOptions: GrindOption[];
};
export type VariantDraft = Omit<ProductVariant, "priceMinor" | "stock" | "weightGrams" | "volumeMl"> & {
  key: string; price: string; stock: string; weight: string; volume: string;
};
export type GrindDraft = Omit<GrindOption, "priceDeltaMinor"> & { key: string; price: string };
export type ProductDraft = Omit<AdminProduct, "id" | "version" | "variants" | "grindOptions" | "sortOrder"> & {
  id?: string; version?: number; sortOrder: string; variants: VariantDraft[]; grindOptions: GrindDraft[]; stockReason: string;
};
export type ProductPayload = Omit<AdminProduct, "id" | "version" | "images"> & { version?: number; stockReason: string; images: Omit<ProductImage, "url">[] };

let draftSequence = 0;
export function draftKey() { return `draft-${++draftSequence}`; }
export function moneyInput(minor: number) { return `${Math.floor(minor / 100)},${String(minor % 100).padStart(2, "0")}`; }
export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, cents = ""] = normalized.split(".");
  const result = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}
export function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR").replaceAll("ı", "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function newVariant(type: ProductType): VariantDraft {
  return { key: draftKey(), sku: "", labelTr: "", labelEn: "", colorNameTr: null, colorNameEn: null, colorHex: null, weight: type === "COFFEE" ? "250" : "", volume: "", price: "", stock: "0", active: true, imageId: null };
}
export function newProduct(): ProductDraft {
  return { slug: "", type: "COFFEE", status: "DRAFT", nameTr: "", nameEn: "", descriptionTr: "", descriptionEn: "", sortOrder: "0", images: [], variants: [newVariant("COFFEE")], grindOptions: [], stockReason: "" };
}
export function toDraft(product: AdminProduct): ProductDraft {
  return { ...product, images: product.images.map(image => ({ ...image })), sortOrder: String(product.sortOrder), stockReason: "", variants: product.variants.map(variant => {
    const { priceMinor, stock, weightGrams, volumeMl, ...rest } = variant;
    return { ...rest, key: variant.id || draftKey(), price: moneyInput(priceMinor), stock: String(stock), weight: weightGrams === null ? "" : String(weightGrams), volume: volumeMl === null ? "" : String(volumeMl) };
  }), grindOptions: product.grindOptions.map(grind => { const { priceDeltaMinor, ...rest } = grind; return { ...rest, key: grind.id || draftKey(), price: moneyInput(priceDeltaMinor) }; }) };
}
export function stockChanged(draft: ProductDraft, original?: AdminProduct) {
  if (!original) return false;
  return draft.variants.some(variant => {
    const old = original.variants.find(item => item.id === variant.id);
    return old ? String(old.stock) !== variant.stock.trim() : variant.stock !== "0";
  });
}
export function prepareProduct(draft: ProductDraft, original?: AdminProduct): { payload?: ProductPayload; errors: string[] } {
  const errors: string[] = [];
  if (!draft.nameTr.trim() || !draft.nameEn.trim()) errors.push("Türkçe ve İngilizce ürün adlarını doldurun.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug) || draft.slug.length > 120) errors.push("Ürün adresi en fazla 120 karakter, küçük İngilizce harf, rakam ve tire içermelidir.");
  if (!/^\d{1,5}$/.test(draft.sortOrder) || Number(draft.sortOrder) > 10000) errors.push("Sıralama değeri 0–10.000 arasında tam sayı olmalıdır.");
  if (!draft.variants.length) errors.push("En az bir ürün varyantı ekleyin.");
  if (draft.variants.length > 100) errors.push("En fazla 100 varyant eklenebilir.");
  if (draft.images.length > 20) errors.push("En fazla 20 ürün görseli eklenebilir.");
  if (draft.grindOptions.length > 30) errors.push("En fazla 30 öğütüm seçeneği eklenebilir.");
  if (draft.status === "PUBLISHED" && !draft.images.length) errors.push("Yayımlamak için en az bir ürün görseli yükleyin.");
  if (draft.status === "PUBLISHED" && !draft.variants.some(variant => variant.active)) errors.push("Yayımlamak için en az bir aktif varyant gerekir.");
  if (stockChanged(draft, original) && !draft.stockReason.trim()) errors.push("Stok değişiklik nedenini yazın.");
  const skus = new Set<string>();
  const variants = draft.variants.map((variant, index): ProductVariant => {
    const position = `${index + 1}. varyant`;
    const price = parseMoney(variant.price);
    if (price === null || price <= 0 || price > 100000000) errors.push(`${position}: Fiyat 0–1.000.000 ₺ arasında, sıfırdan büyük ve en fazla iki ondalıklı olmalıdır.`);
    if (!/^\d{1,7}$/.test(variant.stock) || Number(variant.stock) > 1000000) errors.push(`${position}: Stok 0–1.000.000 arasında tam sayı olmalıdır.`);
    const sku = variant.sku.trim();
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(sku) || skus.has(sku.toLowerCase())) errors.push(`${position}: Benzersiz bir stok kodu (SKU) girin; İngilizce harf, rakam, tire ve alt çizgi kullanın.`);
    skus.add(sku.toLowerCase());
    if (!variant.labelTr.trim() || !variant.labelEn.trim()) errors.push(`${position}: Türkçe ve İngilizce varyant adlarını doldurun.`);
    if (draft.type === "COFFEE" && (!/^[1-9]\d{0,5}$/.test(variant.weight) || Number(variant.weight) > 100000)) errors.push(`${position}: 1–100.000 g arasında bir gramaj girin.`);
    if (draft.type === "THERMOS" && (!variant.colorNameTr?.trim() || !variant.colorNameEn?.trim() || !/^#[a-fA-F0-9]{6}$/.test(variant.colorHex || ""))) errors.push(`${position}: İki dilde renk adı ve geçerli bir renk kodu (#RRGGBB) girin.`);
    if (variant.volume && (!/^[1-9]\d{0,5}$/.test(variant.volume) || Number(variant.volume) > 100000)) errors.push(`${position}: Hacim 1–100.000 ml arasında tam sayı olmalıdır.`);
    return { ...(variant.id ? { id: variant.id } : {}), sku, labelTr: variant.labelTr.trim(), labelEn: variant.labelEn.trim(), colorNameTr: draft.type === "THERMOS" ? variant.colorNameTr?.trim() || null : null, colorNameEn: draft.type === "THERMOS" ? variant.colorNameEn?.trim() || null : null, colorHex: draft.type === "THERMOS" ? variant.colorHex : null, weightGrams: draft.type === "COFFEE" ? Number(variant.weight) : null, volumeMl: draft.type === "THERMOS" && variant.volume ? Number(variant.volume) : null, priceMinor: price || 0, stock: Number(variant.stock), active: variant.active, imageId: variant.imageId };
  });
  const codes = new Set<string>();
  const grindOptions = (draft.type === "COFFEE" ? draft.grindOptions : []).map((grind, index): GrindOption => {
    const price = parseMoney(grind.price);
    if (!grind.nameTr.trim() || !grind.nameEn.trim()) errors.push(`${index + 1}. öğütüm seçeneği: Her iki dilde ad girin.`);
    if (!/^[a-z0-9_-]{1,60}$/.test(grind.code) || codes.has(grind.code.toLowerCase())) errors.push(`${index + 1}. öğütüm seçeneği: Benzersiz, küçük İngilizce harf/rakam/tire içeren bir kod girin.`);
    codes.add(grind.code.toLowerCase());
    if (price === null || price > 100000000) errors.push(`${index + 1}. öğütüm seçeneği: Ek ücret 0–1.000.000 ₺ arasında, en fazla iki ondalıklı olmalıdır.`);
    return { ...(grind.id ? { id: grind.id } : {}), code: grind.code, nameTr: grind.nameTr.trim(), nameEn: grind.nameEn.trim(), priceDeltaMinor: price || 0, sortOrder: index, active: grind.active };
  });
  if (errors.length) return { errors };
  return { errors, payload: { slug: draft.slug, type: draft.type, status: draft.status, nameTr: draft.nameTr.trim(), nameEn: draft.nameEn.trim(), descriptionTr: draft.descriptionTr.trim(), descriptionEn: draft.descriptionEn.trim(), sortOrder: Number(draft.sortOrder), ...(draft.version !== undefined ? { version: draft.version } : {}), images: draft.images.map(({ url: _url, ...image }, index) => ({ ...image, sortOrder: index })), variants, grindOptions, stockReason: draft.stockReason.trim() } };
}

export function mediaUrl(url: string) {
  if (url.startsWith("/images/")) return url;
  const file = url.split("/").at(-1)?.split("?")[0];
  return file && /^[a-zA-Z0-9_.-]+\.(webp|png|jpe?g)$/i.test(file) ? `/api/web/catalog-media/${file}` : "";
}
export const statusLabels: Record<ProductStatus, string> = { DRAFT: "Taslak", PUBLISHED: "Yayında", ARCHIVED: "Arşivde" };
export function formatPrice(minor: number) { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(minor / 100); }

export class AdminApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/web/admin${path}`, { ...options, credentials: "same-origin", cache: "no-store", headers: { ...(options?.body ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.error === "string" ? body.error : body?.error?.message || body?.message;
    throw new AdminApiError(detail || (response.status === 401 ? "Oturumunuz sona erdi. Lütfen tekrar giriş yapın." : "İşlem tamamlanamadı. Lütfen yeniden deneyin."), response.status);
  }
  return body as T;
}
