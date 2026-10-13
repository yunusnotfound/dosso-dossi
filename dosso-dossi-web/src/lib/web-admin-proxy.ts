import "server-only";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "dosso_web_admin";
const SESSION_SECONDS = 12 * 60 * 60;
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const noStore = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export function backendOrigin(): URL {
  const origin = new URL(process.env.BACKEND_URL ?? "http://127.0.0.1:3000");
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("Invalid backend origin");
  }
  return origin;
}

/** Only bounded order-list filters may cross the backend boundary. */
export function orderListQuery(input: URLSearchParams): string {
  const result = new URLSearchParams();
  for (const [key, value] of input) {
    if (result.has(key)) throw new RangeError("Repeated query parameter");
    const valid =
      key === "page"
        ? /^[1-9]\d{0,5}$/.test(value) && Number(value) <= 100_000
        : key === "limit"
          ? /^[1-9]\d?$/.test(value) && Number(value) <= 50
          : key === "status"
            ? ["OPEN", "CANCELLED", "EXPIRED", "COMPLETED"].includes(value)
            : key === "paymentStatus"
              ? ["PENDING", "PAID", "FAILED", "REVIEW"].includes(value)
              : key === "fulfillmentStatus"
                ? ["UNFULFILLED", "PREPARING", "SHIPPED", "DELIVERED"].includes(
                    value,
                  )
                : key === "q" &&
                  value.trim().length >= 1 &&
                  value.length <= 100;
    if (!valid) throw new RangeError("Invalid order filter");
    result.set(key, value);
  }
  return result.size ? `?${result.toString()}` : "";
}

function error(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: noStore },
  );
}

export function isTrustedOrigin(origin: string | null): boolean {
  // Next normalizes loopback request URLs to localhost. Use the configured public
  // origin instead of its internal URL (or untrusted forwarded host headers).
  const configured =
    process.env.WEB_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:4000"
      : undefined);
  if (!origin || !configured) return false;
  try {
    const expected = new URL(configured);
    return (
      ["http:", "https:"].includes(expected.protocol) &&
      !expected.username &&
      !expected.password &&
      expected.pathname === "/" &&
      !expected.search &&
      !expected.hash &&
      origin === expected.origin
    );
  } catch {
    return false;
  }
}

function allowedRoute(method: string, path: string[]): boolean {
  if (path.length === 1 && path[0] === "orders") return method === "GET";
  if (path.length === 2 && path[0] === "orders" && ID.test(path[1]))
    return ["GET", "PATCH"].includes(method);
  if (path.length === 1 && path[0] === "shipping")
    return ["GET", "PUT"].includes(method);
  if (path.length === 2 && path[0] === "auth") {
    return (
      (method === "POST" && ["login", "logout"].includes(path[1])) ||
      (method === "GET" && path[1] === "session")
    );
  }
  if (path.length === 1 && path[0] === "products")
    return ["GET", "POST"].includes(method);
  if (path.length === 2 && path[0] === "products" && ID.test(path[1]))
    return ["GET", "PUT"].includes(method);
  if (
    path.length === 3 &&
    path[0] === "products" &&
    ID.test(path[1]) &&
    path[2] === "history"
  )
    return method === "GET";
  return path.length === 1 && path[0] === "media" && method === "POST";
}

/** Count the stream as well as Content-Length; chunked uploads cannot bypass the cap. */
export async function boundedBody(
  request: NextRequest,
  limit: number,
): Promise<string> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limit)
    throw new RangeError("body too large");
  if (!request.body) return "{}";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RangeError("body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks).toString("utf8");
  JSON.parse(body || "{}");
  return body || "{}";
}

function setSession(
  response: NextResponse,
  value: string,
  maxAge = SESSION_SECONDS,
): void {
  response.cookies.set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

/** Fixed web-admin allowlist: browser input can never choose a backend host or mobile endpoint. */
export async function proxyWebAdmin(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const method = request.method;
  if (!allowedRoute(method, path))
    return error(404, "NOT_FOUND", "İstenen işlem bulunamadı.");
  const mutation = method !== "GET";
  if (mutation) {
    const origin = request.headers.get("origin");
    // Login is checked too, preventing an attacker from binding a victim to another account.
    if (
      !isTrustedOrigin(origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return error(
        403,
        "INVALID_ORIGIN",
        "İşlem yalnız yönetim panelinden yapılabilir.",
      );
    }
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    ) {
      return error(415, "INVALID_CONTENT_TYPE", "JSON içerik gerekli.");
    }
  }
  const login = path.join("/") === "auth/login";
  const logout = path.join("/") === "auth/logout";
  const token = request.cookies.get(COOKIE)?.value;
  if (!login && !token)
    return error(401, "UNAUTHORIZED", "Yönetici girişi gerekli.");
  let query = "";
  if (method === "GET" && path.length === 1 && path[0] === "orders") {
    try {
      query = orderListQuery(request.nextUrl.searchParams);
    } catch {
      return error(400, "INVALID_QUERY", "Sipariş filtreleri geçerli değil.");
    }
  }
  let body: string | undefined;
  if (mutation) {
    try {
      body = await boundedBody(
        request,
        path[0] === "media"
          ? 7_100_000
          : ["shipping", "orders"].includes(path[0])
            ? 8_192
            : 1_000_000,
      );
    } catch (cause) {
      return cause instanceof RangeError
        ? error(
            413,
            "PAYLOAD_TOO_LARGE",
            "Dosya veya ürün verisi izin verilen boyutu aşıyor.",
          )
        : error(400, "INVALID_JSON", "Gönderilen veri okunamadı.");
    }
  }
  try {
    const response = await fetch(
      new URL(`/web/admin/${path.join("/")}${query}`, backendOrigin()),
      {
        method,
        body,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(path[0] === "media" ? 20_000 : 10_000),
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(!login && token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (logout && response.ok) {
      const result = new NextResponse(null, { status: 204, headers: noStore });
      setSession(result, "", 0);
      return result;
    }
    const data = await response.json();
    if (login && response.ok) {
      if (typeof data.token !== "string" || !data.admin)
        throw new Error("Invalid login response");
      // The opaque backend token never appears in the response body or browser JS.
      const result = NextResponse.json(
        { admin: data.admin },
        { headers: noStore },
      );
      setSession(result, data.token);
      return result;
    }
    const result = NextResponse.json(data, {
      status: response.status,
      headers: noStore,
    });
    if (response.status === 401) setSession(result, "", 0);
    if (response.headers.has("retry-after"))
      result.headers.set("Retry-After", response.headers.get("retry-after")!);
    return result;
  } catch {
    return error(
      503,
      "WEB_UNAVAILABLE",
      "Web mağazası sunucusuna ulaşılamadı. Lütfen yeniden deneyin.",
    );
  }
}
