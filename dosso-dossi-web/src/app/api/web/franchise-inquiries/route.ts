import type { NextRequest } from "next/server";
import { backendOrigin, boundedBody, isTrustedOrigin } from "@/lib/web-admin-proxy";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!isTrustedOrigin(request.headers.get("origin")) || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "İstek kaynağı doğrulanamadı." }, { status: 403, headers });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "JSON gerekli." }, { status: 415, headers });
  try {
    const body = await boundedBody(request, 16384);
    const response = await fetch(new URL("/web/franchise-inquiries", backendOrigin()), { method: "POST", redirect: "error", headers: { "Content-Type": "application/json" }, body, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) return Response.json({ error: "Başvuru kaydedilemedi." }, { status: [400, 422, 429].includes(response.status) ? response.status : 503, headers });
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("receipt" in result) || typeof result.receipt !== "string" || !/^DD-FR-[A-F0-9]{16}$/.test(result.receipt)) throw new Error("Invalid response");
    return Response.json({ receipt: result.receipt }, { status: 201, headers });
  } catch (error) {
    if (error instanceof RangeError) return Response.json({ error: "Başvuru boyutu çok büyük." }, { status: 413, headers });
    if (error instanceof SyntaxError) return Response.json({ error: "Geçersiz başvuru." }, { status: 400, headers });
    return Response.json({ error: "Başvuru hizmetine ulaşılamıyor." }, { status: 503, headers });
  }
}
