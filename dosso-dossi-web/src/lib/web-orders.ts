import type { Locale } from "./site";
import type { Address, CartLine } from "./web-commerce";
import { CommerceRequestError, commerceError } from "./web-commerce";

export type OrderStatus = "OPEN" | "CANCELLED" | "EXPIRED" | "COMPLETED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REVIEW";
export type FulfillmentStatus =
  | "UNFULFILLED"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED";
export type OrderAddress = Omit<
  Address,
  "id" | "version" | "isDefault" | "createdAt" | "updatedAt"
>;
export type OrderLine = Omit<
  CartLine,
  "availableQuantity" | "issue" | "slug" | "unitPriceMinor" | "lineTotalMinor"
> & { sku?: string; unitPriceMinor: number; lineTotalMinor: number };
export type PaymentConfig = {
  provider: "IYZICO";
  mode: "sandbox";
  configured: boolean;
  paymentPageUrl?: string | null;
};
export type WebOrder = {
  id: string;
  number: string;
  version: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  currency: "TRY";
  subtotalMinor: number;
  shippingFeeMinor: number;
  totalMinor: number;
  customer: { name: string; email: string };
  address: OrderAddress;
  lines: OrderLine[];
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  reservationExpiresAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  audits: {
    id: string;
    action: string;
    note: string | null;
    createdAt: string;
  }[];
  canCancel?: boolean;
  canPay?: boolean;
  canRefreshPayment?: boolean;
};
export type OrderQuote = {
  cartVersion: number;
  quoteHash: string;
  subtotalMinor: number;
  shippingFeeMinor: number;
  totalMinor: number;
  currency: "TRY";
  address: OrderAddress;
  lines: OrderLine[];
  payment: PaymentConfig;
  reservationMinutes: number;
};
export type OrderResponse = {
  customerId: string;
  order: WebOrder;
  payment?: PaymentConfig;
};
export function ordersPath(locale: Locale, id?: string) {
  return `${locale === "en" ? "/en" : ""}/hesabim/siparislerim${id ? `/${encodeURIComponent(id)}` : ""}`;
}
const labels = {
  tr: {
    OPEN: "Açık",
    CANCELLED: "İptal edildi",
    EXPIRED: "Süresi doldu",
    COMPLETED: "Tamamlandı",
    PENDING: "Ödeme bekleniyor",
    PAID: "Test ödemesi alındı",
    FAILED: "Ödeme başarısız",
    REVIEW: "Ödeme inceleniyor",
    UNFULFILLED: "Hazırlanmıyor",
    PREPARING: "Hazırlanıyor",
    SHIPPED: "Kargoya verildi",
    DELIVERED: "Teslim edildi",
  },
  en: {
    OPEN: "Open",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    COMPLETED: "Completed",
    PENDING: "Awaiting payment",
    PAID: "Test payment received",
    FAILED: "Payment failed",
    REVIEW: "Payment under review",
    UNFULFILLED: "Not yet prepared",
    PREPARING: "Preparing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
  },
};
export function orderLabel(
  value: OrderStatus | PaymentStatus | FulfillmentStatus,
  locale: Locale,
) {
  return labels[locale][value];
}
export function orderDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(date);
}
export function orderError(error: unknown, locale: Locale) {
  const en = locale === "en";
  if (error instanceof CommerceRequestError) {
    if (error.code === "PAYMENT_NOT_CONFIGURED")
      return en
        ? "Sandbox payment is not connected yet. Check your order details for its current status."
        : "Sandbox ödeme bağlantısı henüz hazır değil. Güncel durumu sipariş ayrıntılarından kontrol edin.";
    if (error.status === 503)
      return en
        ? "The service is temporarily unavailable. Check your orders before trying again."
        : "Hizmete şu anda ulaşılamıyor. Yeniden denemeden önce siparişlerinizden güncel durumu kontrol edin.";
    if (error.status === 502)
      return en
        ? "The payment result could not be confirmed. Check the result in your order before starting another payment."
        : "Ödeme sonucu doğrulanamadı. Yeni bir ödeme başlatmadan önce siparişinizden ödeme sonucunu kontrol edin.";
    if (error.status === 409)
      return en
        ? "The cart, stock or order has changed. Review the current details before trying again."
        : "Sepet, stok veya sipariş değişti. Yeniden denemeden önce güncel bilgileri kontrol edin.";
    if (
      error.code === "SHIPPING_NOT_CONFIGURED" ||
      error.code === "SHIPPING_DISABLED"
    )
      return en
        ? "Delivery is not available yet. Return to your bag to review the details."
        : "Kargo henüz kullanılamıyor. Ayrıntıları kontrol etmek için sepetinize dönün.";
  }
  return commerceError(error, locale);
}

/** Payment navigation is restricted to iyzico's hosted sandbox, never provider HTML. */
export function sandboxPaymentUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return null;
    const hosted =
      url.hostname === "sandbox-cpp.iyzipay.com" && url.pathname === "/";
    const legacy =
      url.hostname === "sandbox-api.iyzipay.com" &&
      /^\/checkoutform\/[A-Za-z0-9_/-]*$/.test(url.pathname);
    if (!hosted && !legacy) return null;
    const tokens = url.searchParams.getAll("token");
    if (tokens.length !== 1 || !/^[A-Za-z0-9_-]{8,256}$/.test(tokens[0]))
      return null;
    if (
      [...url.searchParams.keys()].some(
        (key) => key !== "token" && key !== "lang",
      )
    )
      return null;
    const languages = url.searchParams.getAll("lang");
    if (
      languages.length > 1 ||
      (languages.length === 1 && !["tr", "en"].includes(languages[0]))
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
