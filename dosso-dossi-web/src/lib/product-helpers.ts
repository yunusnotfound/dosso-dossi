import type { BrewingMethod, CatalogItem, CatalogProduct, ProductDetails } from "./catalog";
import type { Locale } from "./site";

export const brewingLabels: Record<BrewingMethod, Record<Locale, string>> = {
  ESPRESSO: { tr: "Espresso", en: "Espresso" }, FILTER: { tr: "Filtre / V60", en: "Filter / V60" },
  FRENCH_PRESS: { tr: "French press", en: "French press" }, MOKA_POT: { tr: "Moka pot", en: "Moka pot" },
  TURKISH: { tr: "Türk kahvesi", en: "Turkish coffee" }, COLD_BREW: { tr: "Cold brew", en: "Cold brew" },
};
export const roastLabels: Record<NonNullable<ProductDetails["roast"]>, Record<Locale, string>> = {
  LIGHT: { tr: "Açık", en: "Light" }, MEDIUM: { tr: "Orta", en: "Medium" },
  MEDIUM_DARK: { tr: "Orta koyu", en: "Medium dark" }, DARK: { tr: "Koyu", en: "Dark" },
};

export function productPath(locale: Locale, slug: string) {
  return `${locale === "en" ? "/en" : ""}/urun/${encodeURIComponent(slug)}`;
}
export function productSelectionPath(locale: Locale, item: CatalogItem, grindId: string | null = null, quantity = 1) {
  const query = new URLSearchParams({ variant: item.id });
  if (grindId) query.set("grind", grindId);
  if (quantity > 1) query.set("quantity", String(Math.min(99, Math.max(1, Math.floor(quantity)))));
  return `${productPath(locale, item.product.slug)}?${query}`;
}

/** Only shop, product and cart destinations are permitted after authentication. */
export function safeShopReturn(value: string | null): string | null {
  if (!value || value.length > 2000 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value, "https://dosso.invalid");
    if (url.origin !== "https://dosso.invalid" || !/^\/(?:en\/)?(?:alisveris|sepet|urun\/[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/)?$/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}
export function loginForSelection(locale: Locale, destination: string) {
  const safe = safeShopReturn(destination);
  return `${locale === "en" ? "/en" : ""}/hesabim${safe ? `?returnTo=${encodeURIComponent(safe)}` : ""}`;
}

export function resolveProductSelection(items: CatalogItem[], query: URLSearchParams) {
  const item = items.find((entry) => entry.id === query.get("variant")) ?? items[0];
  if (!item) return null;
  const grinds = item.product.grindOptions.filter((grind) => grind.active);
  const grind = grinds.find((entry) => entry.id === query.get("grind")) ?? grinds[0] ?? null;
  const raw = query.get("quantity") ?? "1";
  const quantity = /^\d{1,2}$/.test(raw) ? Math.min(99, Math.max(1, Number(raw))) : 1;
  return { item, grind, quantity };
}

/** Product facts remain opt-in: absent supplier information is never inferred. */
export function detailRows(product: CatalogProduct, locale: Locale): { label: string; value: string }[] {
  const details = product.details ?? {};
  const tr = locale === "tr";
  const rows = product.type === "COFFEE" ? [
    { label: tr ? "Köken" : "Origin", value: (tr ? details.originTr : details.originEn) ?? "" },
    { label: tr ? "Kavurma" : "Roast", value: details.roast ? roastLabels[details.roast]?.[locale] ?? "" : "" },
    { label: tr ? "Tat notları" : "Tasting notes", value: (tr ? details.tastingNotesTr : details.tastingNotesEn)?.join(" · ") ?? "" },
    { label: tr ? "Demleme" : "Brewing", value: details.brewingMethods?.map((method) => brewingLabels[method]?.[locale]).filter(Boolean).join(" · ") ?? "" },
  ] : [{ label: tr ? "Malzeme" : "Material", value: (tr ? details.materialTr : details.materialEn) ?? "" }];
  return rows.filter((row) => row.value.trim());
}

export type CoffeePreferences = { method: BrewingMethod | ""; roast: ProductDetails["roast"] | ""; maxPriceMinor: number | null; grindCode?: string; weightGrams?: number | null };
/** Exact declared metadata matching, not unsupported tasting predictions. */
export function findCoffees(items: CatalogItem[], preferences: CoffeePreferences): CatalogItem[] {
  return items.filter((item) => {
    if (item.category !== "coffee" || item.variant.stock <= 0) return false;
    const details = item.product.details ?? {};
    if (preferences.method && !details.brewingMethods?.includes(preferences.method)) return false;
    if (preferences.roast && details.roast !== preferences.roast) return false;
    const activeGrinds = item.product.grindOptions.filter((grind) => grind.active);
    if (preferences.grindCode && !activeGrinds.some(grind => grind.code === preferences.grindCode)) return false;
    if (preferences.weightGrams && item.variant.weightGrams !== preferences.weightGrams) return false;
    const applicableGrinds = preferences.grindCode ? activeGrinds.filter(grind => grind.code === preferences.grindCode) : activeGrinds;
    const price = item.priceMinor + (applicableGrinds.length ? Math.min(...applicableGrinds.map((grind) => grind.priceDeltaMinor)) : 0);
    return preferences.maxPriceMinor === null || price <= preferences.maxPriceMinor;
  }).sort((a, b) => a.product.sortOrder - b.product.sortOrder || a.priceMinor - b.priceMinor);
}
