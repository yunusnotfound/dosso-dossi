import "server-only";
import type { CatalogProduct, CatalogResult } from "./catalog";

export type StoreConfig = {
  name: string;
  defaultLocale: "tr";
  locales: ["tr", "en"];
  currency: "TRY";
  shippingCountry: "TR";
};

// These are the only backend routes this initial frontend can call.
type BackendPath = "/web/config" | "/web/health" | "/web/catalog";

async function fetchBackend(path: BackendPath): Promise<unknown> {
  const base = new URL(process.env.BACKEND_URL ?? "http://127.0.0.1:3000");
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("BACKEND_URL must be an HTTP(S) origin without credentials.");
  }

  const response = await fetch(new URL(path, base), {
    cache: "no-store",
    signal: AbortSignal.timeout(path === "/web/catalog" ? 5_000 : 3_000),
    redirect: "error",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Web backend unavailable.");
  }

  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getStoreConfig(): Promise<StoreConfig | null> {
  try {
    const result = await fetchBackend("/web/config");
    if (!isRecord(result) || !isRecord(result.store)) return null;
    const store = result.store;
    if (
      typeof store.name !== "string" ||
      store.name.trim().length === 0 ||
      store.defaultLocale !== "tr" ||
      store.currency !== "TRY" ||
      store.shippingCountry !== "TR" ||
      !Array.isArray(store.locales) ||
      store.locales.length !== 2 ||
      store.locales[0] !== "tr" ||
      store.locales[1] !== "en"
    ) {
      return null;
    }
    return {
      name: store.name,
      defaultLocale: store.defaultLocale,
      locales: ["tr", "en"],
      currency: store.currency,
      shippingCountry: store.shippingCountry,
    };
  } catch {
    // The introductory pages remain readable while local services are starting.
    // This fallback does not claim that a catalog or checkout is available.
    return null;
  }
}

export async function isWebBackendHealthy(): Promise<boolean> {
  try {
    const result = await fetchBackend("/web/health");
    return isRecord(result) && result.ok === true && result.service === "web";
  } catch {
    return false;
  }
}

const isText = (value: unknown): value is string => typeof value === "string";
const isNullableText = (value: unknown) => value === null || isText(value);
const isUnsignedInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isOptionalMeasure = (value: unknown) => value === null || (isUnsignedInteger(value) && value > 0);

/** Reject incomplete responses rather than silently mixing database and sample data. */
function parseCatalogProduct(value: unknown): CatalogProduct | null {
  if (!isRecord(value) || !["id", "slug", "nameTr", "nameEn", "descriptionTr", "descriptionEn"].every((key) => isText(value[key])) ||
    !["COFFEE", "THERMOS"].includes(value.type as string) || value.status !== "PUBLISHED" ||
    !Number.isSafeInteger(value.sortOrder) || !isUnsignedInteger(value.version) ||
    !Array.isArray(value.images) || !Array.isArray(value.variants) || !Array.isArray(value.grindOptions)) return null;
  const images = [];
  for (const image of value.images) {
    if (!isRecord(image) || !["id", "mediaId", "url", "altTr", "altEn"].every((key) => isText(image[key])) ||
      !Number.isSafeInteger(image.sortOrder) || !/^\/web\/media\/[a-zA-Z0-9_-]+\.webp$/.test(image.url as string)) return null;
    images.push({ ...image, url: (image.url as string).replace("/web/media/", "/api/web/catalog-media/") });
  }
  for (const variant of value.variants) {
    if (!isRecord(variant) || !["id", "sku", "labelTr", "labelEn"].every((key) => isText(variant[key])) ||
      !["colorNameTr", "colorNameEn", "imageId"].every((key) => isNullableText(variant[key])) ||
      !(variant.colorHex === null || (isText(variant.colorHex) && /^#[\da-fA-F]{6}$/.test(variant.colorHex))) ||
      !isOptionalMeasure(variant.weightGrams) || !isOptionalMeasure(variant.volumeMl) ||
      !isUnsignedInteger(variant.priceMinor) || !isUnsignedInteger(variant.stock) || typeof variant.active !== "boolean") return null;
  }
  for (const grind of value.grindOptions) {
    if (!isRecord(grind) || !["id", "code", "nameTr", "nameEn"].every((key) => isText(grind[key])) ||
      !isUnsignedInteger(grind.priceDeltaMinor) || !Number.isSafeInteger(grind.sortOrder) || typeof grind.active !== "boolean") return null;
  }
  return { ...value, images } as CatalogProduct;
}

export async function getCatalog(): Promise<CatalogResult> {
  try {
    const response = await fetchBackend("/web/catalog");
    if (!isRecord(response) || !Array.isArray(response.products)) return { available: false, products: [] };
    const products = response.products.map(parseCatalogProduct);
    if (products.some((product) => product === null)) return { available: false, products: [] };
    return { available: true, products: products as CatalogProduct[] };
  } catch {
    return { available: false, products: [] };
  }
}
