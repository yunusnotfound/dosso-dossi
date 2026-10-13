import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { backendOrigin, boundedBody, isTrustedOrigin } from "./web-admin-proxy";

const COOKIE = "dosso_web_customer";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const publicActions = new Set([
  "register",
  "login",
  "resend-verification",
  "verify-email",
  "forgot-password",
  "reset-password",
]);
const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function failure(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

function setSession(
  response: NextResponse,
  token: string,
  maxAge = SESSION_SECONDS,
): void {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/** Customer cookies and backend paths are independent of the mobile and admin realms. */
export async function proxyWebCustomer(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const action = path[0];
  const mutation = request.method === "POST";
  if (
    path.length !== 1 ||
    !(mutation
      ? publicActions.has(action) || action === "logout"
      : request.method === "GET" && action === "session")
  ) {
    return failure(404, "NOT_FOUND", "İstenen işlem bulunamadı.");
  }
  if (
    mutation &&
    (!isTrustedOrigin(request.headers.get("origin")) ||
      request.headers.get("sec-fetch-site") === "cross-site")
  ) {
    return failure(
      403,
      "INVALID_ORIGIN",
      "İşlem yalnız web sitesinden yapılabilir.",
    );
  }
  if (
    mutation &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  ) {
    return failure(415, "INVALID_CONTENT_TYPE", "JSON içerik gerekli.");
  }
  const authenticated = action === "session" || action === "logout";
  const token = request.cookies.get(COOKIE)?.value;
  if (authenticated && !token)
    return failure(401, "UNAUTHORIZED", "Müşteri girişi gerekli.");
  let body: string | undefined;
  if (mutation) {
    try {
      body = await boundedBody(request, 4_096);
    } catch (error) {
      return error instanceof RangeError
        ? failure(
            413,
            "PAYLOAD_TOO_LARGE",
            "Gönderilen veri boyutu sınırı aşıyor.",
          )
        : failure(400, "INVALID_JSON", "Gönderilen veri okunamadı.");
    }
  }
  try {
    const response = await fetch(
      new URL(`/web/auth/${action}`, backendOrigin()),
      {
        method: request.method,
        body,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: "application/json",
          ...(mutation ? { "Content-Type": "application/json" } : {}),
          ...(authenticated && token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
      },
    );
    if (action === "logout" && response.ok) {
      const result = new NextResponse(null, { status: 204, headers });
      setSession(result, "", 0);
      return result;
    }
    const data = await response.json();
    if (action === "login" && response.ok) {
      if (
        typeof data.token !== "string" ||
        !/^[A-Za-z0-9_-]{64}$/.test(data.token) ||
        !data.customer?.emailVerifiedAt
      ) {
        throw new Error("Invalid customer session response");
      }
      // Only this allowlisted public profile is visible to browser JavaScript.
      const { id, name, email, locale, emailVerifiedAt } = data.customer;
      const result = NextResponse.json(
        { customer: { id, name, email, locale, emailVerifiedAt } },
        { headers },
      );
      setSession(result, data.token);
      return result;
    }
    const result = NextResponse.json(data, {
      status: response.status,
      headers,
    });
    if (
      (authenticated && response.status === 401) ||
      (action === "reset-password" && response.ok)
    ) {
      setSession(result, "", 0);
    }
    if (response.headers.has("retry-after"))
      result.headers.set("Retry-After", response.headers.get("retry-after")!);
    return result;
  } catch {
    return failure(
      503,
      "WEB_UNAVAILABLE",
      "Hesap hizmetine ulaşılamadı. Lütfen yeniden deneyin.",
    );
  }
}
