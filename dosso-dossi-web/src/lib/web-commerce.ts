import type { Locale } from "./site";

export class CommerceRequestError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
    this.name = "CommerceRequestError";
  }
}

export async function commerceRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: Record<string, unknown>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/web/${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      ...(options.body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(options.body),
          }),
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new CommerceRequestError("NETWORK_ERROR", 0);
  }
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => null);
  if (!response.ok) {
    throw new CommerceRequestError(
      typeof data?.error?.code === "string"
        ? data.error.code
        : "REQUEST_FAILED",
      response.status,
    );
  }
  return data as T;
}

export function commerceError(error: unknown, locale: Locale): string {
  const en = locale === "en";
  if (error instanceof CommerceRequestError) {
    if (error.status === 401)
      return en
        ? "Your session has ended. Sign in to continue."
        : "Oturumunuz sona erdi. Devam etmek için giriş yapın.";
    if (error.status === 409)
      return en
        ? "Your cart or the product availability has changed. Review the latest details and try again."
        : "Sepetiniz veya ürünün durumu değişti. Güncel bilgileri kontrol edip tekrar deneyin.";
    if (error.status === 429)
      return en
        ? "Please wait a moment before trying again."
        : "Tekrar denemeden önce lütfen biraz bekleyin.";
    if (error.status === 400 || error.status === 422)
      return en
        ? "Please check your details and the available quantity."
        : "Bilgilerinizi ve ürünün mevcut adedini kontrol edin.";
    if (error.status === 404)
      return en
        ? "This item is no longer available. Refresh to see the latest details."
        : "Bu kayıt artık kullanılamıyor. Güncel bilgileri görmek için yenileyin.";
  }
  return en
    ? "We could not connect. Please try again."
    : "Bağlantı kurulamadı. Lütfen tekrar deneyin.";
}

export function cartPath(locale: Locale) {
  return `${locale === "en" ? "/en" : ""}/sepet`;
}

export function addressesPath(locale: Locale) {
  return `${locale === "en" ? "/en" : ""}/hesabim/adreslerim`;
}

export type Address = {
  id: string;
  version: number;
  title: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  district: string;
  neighborhood: string;
  addressLine: string;
  postalCode: string;
  country: "TR";
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
export type AddressInput = Omit<
  Address,
  "id" | "version" | "createdAt" | "updatedAt"
>;
export type ShippingSettings = {
  version: number;
  enabled: boolean;
  feeMinor: number | null;
  freeShippingThresholdMinor: number | null;
  country: "TR";
  currency: "TRY";
};
export type CartLine = {
  id: string;
  variantId: string;
  grindId: string | null;
  quantity: number;
  productId: string | null;
  slug: string | null;
  nameTr: string;
  nameEn: string;
  variantLabelTr: string;
  variantLabelEn: string;
  grindNameTr: string | null;
  grindNameEn: string | null;
  imageUrl: string | null;
  unitPriceMinor: number | null;
  lineTotalMinor: number | null;
  availableQuantity: number;
  issue: null | "UNAVAILABLE" | "INSUFFICIENT_STOCK";
};
export type Cart = {
  customerId: string;
  version: number;
  lines: CartLine[];
  itemCount: number;
  subtotalMinor: number | null;
  selectedAddressId: string | null;
  shipping: Omit<ShippingSettings, "version"> & { configured: boolean };
  shippingFeeMinor: number | null;
  totalMinor: number | null;
  freeShippingRemainingMinor: number | null;
  valid: boolean;
};

/** Backend media stays on the allowlisted same-origin public media proxy. */
export function commerceImageUrl(value: string | null): string | null {
  const filename = value?.match(
    /^\/web\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp)$/i,
  )?.[1];
  return filename ? `/api/web/catalog-media/${filename}` : null;
}
