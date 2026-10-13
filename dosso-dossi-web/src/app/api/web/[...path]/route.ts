import type { NextRequest } from "next/server";
import { proxyWebCommerce } from "@/lib/web-commerce-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, { params }: Context) {
  return proxyWebCommerce(request, (await params).path);
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
