import type { Locale } from "./site";

export type CatalogCategory = "coffee" | "thermos";
export type CatalogImage = {
  id: string;
  mediaId: string;
  url: string;
  altTr: string;
  altEn: string;
  sortOrder: number;
};
export type CatalogVariant = {
  id: string;
  sku: string;
  labelTr: string;
  labelEn: string;
  colorNameTr: string | null;
  colorNameEn: string | null;
  colorHex: string | null;
  weightGrams: number | null;
  volumeMl: number | null;
  priceMinor: number;
  stock: number;
  active: boolean;
  imageId: string | null;
};
export type CatalogGrind = {
  id: string;
  code: string;
  nameTr: string;
  nameEn: string;
  priceDeltaMinor: number;
  sortOrder: number;
  active: boolean;
};
export type CatalogProduct = {
  id: string;
  slug: string;
  type: "COFFEE" | "THERMOS";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  nameTr: string;
  nameEn: string;
  descriptionTr: string;
  descriptionEn: string;
  sortOrder: number;
  version: number;
  images: CatalogImage[];
  variants: CatalogVariant[];
  grindOptions: CatalogGrind[];
};
export type CatalogResult =
  | { available: true; products: CatalogProduct[] }
  | { available: false; products: [] };

/** A card represents an actual SKU, while details keep its complete parent product. */
export type CatalogItem = {
  id: string;
  product: CatalogProduct;
  variant: CatalogVariant;
  category: CatalogCategory;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  image: string | null;
  imageAlt: Record<Locale, string>;
  priceMinor: number;
  size: string;
  color?: Record<Locale, string> & { hex: string | null };
};

export function catalogItems(products: CatalogProduct[]): CatalogItem[] {
  return products
    .filter((product) => product.status === "PUBLISHED")
    .flatMap((product) =>
      product.variants.filter((variant) => variant.active).map((variant) => {
        const image = product.images.find((image) => image.mediaId === variant.imageId) ?? product.images[0];
        return {
          id: variant.id,
          product,
          variant,
          category: product.type === "COFFEE" ? "coffee" : "thermos",
          name: { tr: product.nameTr, en: product.nameEn },
          description: { tr: product.descriptionTr, en: product.descriptionEn },
          image: image?.url ?? null,
          imageAlt: { tr: image?.altTr || product.nameTr, en: image?.altEn || product.nameEn },
          priceMinor: variant.priceMinor,
          size: [variant.weightGrams ? `${variant.weightGrams} g` : "", variant.volumeMl ? `${variant.volumeMl} ml` : ""].filter(Boolean).join(" · "),
          ...(variant.colorNameTr || variant.colorNameEn ? {
            color: { tr: variant.colorNameTr ?? "", en: variant.colorNameEn ?? "", hex: variant.colorHex },
          } : {}),
        } satisfies CatalogItem;
      }),
    );
}

export function variantLabel(item: CatalogItem, locale: Locale): string {
  return [item.color?.[locale], item.size, locale === "tr" ? item.variant.labelTr : item.variant.labelEn]
    .filter((value, index, values) => value && values.indexOf(value) === index).join(" · ") || item.variant.sku;
}

export function minimumPriceMinor(item: CatalogItem): number {
  const grinds = item.product.grindOptions.filter((grind) => grind.active);
  return item.priceMinor + (grinds.length ? Math.min(...grinds.map((grind) => grind.priceDeltaMinor)) : 0);
}

export function formatPrice(priceMinor: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 2, minimumFractionDigits: 2,
  }).format(priceMinor / 100);
}

export type PreviewCartLine = { variantId: string; grindId: string | null; quantity: number };
export function cartLineKey(variantId: string, grindId: string | null): string {
  return `${variantId}:${grindId ?? "none"}`;
}
export function variantCartQuantity(lines: PreviewCartLine[], variantId: string): number {
  return lines.reduce((total, line) => total + (line.variantId === variantId ? line.quantity : 0), 0);
}
/** Grind options share their base SKU's stock. No stock is reserved by this preview. */
export function addPreviewQuantity(lines: PreviewCartLine[], item: CatalogItem, grindId: string | null, quantity: number): PreviewCartLine[] {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return lines;
  const activeGrinds = item.product.grindOptions.filter((grind) => grind.active);
  if (activeGrinds.length ? !activeGrinds.some((grind) => grind.id === grindId) : grindId !== null) return lines;
  const available = Math.max(0, item.variant.stock - variantCartQuantity(lines, item.id));
  const increment = Math.min(quantity, available);
  if (!increment) return lines;
  const index = lines.findIndex((line) => line.variantId === item.id && line.grindId === grindId);
  if (index === -1) return [...lines, { variantId: item.id, grindId, quantity: increment }];
  return lines.map((line, position) => position === index ? { ...line, quantity: line.quantity + increment } : line);
}

export function reconcilePreviewCart(lines: PreviewCartLine[], items: CatalogItem[]): PreviewCartLine[] {
  return lines.reduce<PreviewCartLine[]>((valid, line) => {
    const item = items.find((item) => item.id === line.variantId);
    return item ? addPreviewQuantity(valid, item, line.grindId, line.quantity) : valid;
  }, []);
}
