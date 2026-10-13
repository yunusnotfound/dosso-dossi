import type { NextRequest } from "next/server";
import { proxyWebCustomer } from "@/lib/web-customer-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, { params }: Context) {
  return proxyWebCustomer(request, (await params).path);
}
export { handle as GET, handle as POST };
