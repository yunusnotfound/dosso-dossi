import type { NextRequest } from "next/server";
import { proxyWebAdmin } from "@/lib/web-admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, { params }: Context) {
  return proxyWebAdmin(request, (await params).path);
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH };
