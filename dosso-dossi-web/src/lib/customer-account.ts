import type { Locale } from "./site";

export type AccountView = "account" | "verify" | "reset";
export type Customer = {
  id: string;
  name: string;
  email: string;
  locale: Locale;
  emailVerifiedAt: string | null;
};
export type DeliveryResponse = { ok: true; delivery: "resend" | "preview" };

export function accountPath(locale: Locale, view: AccountView = "account") {
  const base = `${locale === "en" ? "/en" : ""}/hesabim`;
  return `${base}${view === "verify" ? "/dogrula" : view === "reset" ? "/sifre-yenile" : ""}`;
}

export class CustomerRequestError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
    this.name = "CustomerRequestError";
  }
}

export async function customerRequest<T>(
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/web/auth/${endpoint}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new CustomerRequestError("NETWORK_ERROR", 0);
  }
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => null);
  if (!response.ok) {
    throw new CustomerRequestError(
      typeof data?.error?.code === "string"
        ? data.error.code
        : "REQUEST_FAILED",
      response.status,
    );
  }
  return data as T;
}

export function accountError(error: unknown, locale: Locale): string {
  const en = locale === "en";
  if (!(error instanceof CustomerRequestError)) {
    return en
      ? "Something went wrong. Please try again."
      : "Bir sorun oluştu. Lütfen tekrar deneyin.";
  }
  if (error.status === 429) {
    return en
      ? "Too many attempts. Please wait a few minutes and try again."
      : "Çok fazla deneme yapıldı. Birkaç dakika bekleyip tekrar deneyin.";
  }
  if (error.code === "EMAIL_NOT_VERIFIED") {
    return en
      ? "Please verify your email before signing in. You can request a new link below."
      : "Giriş yapmadan önce e-posta adresinizi doğrulayın. Aşağıdan yeni bir bağlantı isteyebilirsiniz.";
  }
  if (
    error.status === 401 ||
    ["INVALID_CREDENTIALS", "AUTH_INVALID_CREDENTIALS"].includes(error.code)
  ) {
    return en
      ? "Your email or password is incorrect."
      : "E-posta adresi veya şifre hatalı.";
  }
  if (/TOKEN/.test(error.code) || error.status === 410) {
    return en
      ? "This link has expired, has already been used or is invalid. Please request a new one."
      : "Bu bağlantının süresi dolmuş, daha önce kullanılmış veya bağlantı geçersiz. Lütfen yeni bir bağlantı isteyin.";
  }
  if (error.status === 400 || error.status === 422) {
    return en
      ? "Please check your details. Passwords must be between 12 and 128 characters."
      : "Bilgilerinizi kontrol edin. Şifreniz 12–128 karakter uzunluğunda olmalı.";
  }
  if (error.status === 403) {
    return en
      ? "This request could not be completed. Refresh the page and try again."
      : "İşlem tamamlanamadı. Sayfayı yenileyip tekrar deneyin.";
  }
  return en
    ? "We cannot connect right now. Please try again shortly."
    : "Şu anda bağlantı kurulamıyor. Lütfen biraz sonra tekrar deneyin.";
}

export function readActionToken(fragment: string): string | null {
  const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");
  return token && /^[A-Za-z0-9_-]{64}$/.test(token) ? token : null;
}
