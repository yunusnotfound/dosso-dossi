import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import {
  backendOrigin,
  boundedBody,
  isTrustedOrigin,
  orderListQuery,
} from "./web-admin-proxy";

const COOKIE = "dosso_web_customer";
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function allowed(method: string, path: string[]): boolean {
  if (path.length === 1) {
    if (["cart", "shipping"].includes(path[0])) return method === "GET";
    if (["addresses", "orders"].includes(path[0]))
      return ["GET", "POST"].includes(method);
  }
  if (path.length === 2) {
    if (path[0] === "orders" && ID.test(path[1])) return method === "GET";
    if (path[0] === "cart" && path[1] === "items") return method === "POST";
    if (path[0] === "cart" && path[1] === "address") return method === "PUT";
    if (path[0] === "addresses" && ID.test(path[1]))
      return ["PUT", "DELETE"].includes(method);
  }
  if (path[0] === "orders" && ID.test(path[1] ?? "")) {
    if (path.length === 3 && ["cancel", "payment"].includes(path[2]))
      return method === "POST";
    if (path.length === 4 && path[2] === "payment" && path[3] === "refresh")
      return method === "POST";
  }
  return (
    path.length === 3 &&
    path[0] === "cart" &&
    path[1] === "items" &&
    ID.test(path[2]) &&
    ["PATCH", "DELETE"].includes(method)
  );
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

/** Fixed customer routes; never forward browser credentials or user-selected hosts. */
export async function proxyWebCommerce(request: NextRequest, path: string[]) {
  if (!allowed(request.method, path))
    return failure(404, "NOT_FOUND", "İstenen işlem bulunamadı.");
  const mutation = request.method !== "GET";
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
  const authenticated = path[0] !== "shipping";
  const token = request.cookies.get(COOKIE)?.value;
  if (authenticated && !token)
    return failure(401, "UNAUTHORIZED", "Müşteri girişi gerekli.");
  let query = "";
  if (request.method === "GET" && path.length === 1 && path[0] === "orders") {
    try {
      query = orderListQuery(request.nextUrl.searchParams);
    } catch {
      return failure(400, "INVALID_QUERY", "Sipariş filtreleri geçerli değil.");
    }
  }
  let body: string | undefined;
  if (mutation) {
    try {
      body = await boundedBody(request, 8_192);
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
      new URL(`/web/${path.join("/")}${query}`, backendOrigin()),
      {
        method: request.method,
        body,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(path[0] === "orders" ? 25_000 : 15_000),
        headers: {
          Accept: "application/json",
          ...(mutation ? { "Content-Type": "application/json" } : {}),
          ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    const result =
      response.status === 204
        ? new NextResponse(null, { status: 204, headers })
        : NextResponse.json(await response.json(), {
            status: response.status,
            headers,
          });
    if (authenticated && response.status === 401) {
      result.cookies.set(COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    if (response.headers.has("retry-after"))
      result.headers.set("Retry-After", response.headers.get("retry-after")!);
    return result;
  } catch {
    return failure(
      503,
      "WEB_UNAVAILABLE",
      "Mağaza hizmetine ulaşılamadı. Lütfen yeniden deneyin.",
    );
  }
}
