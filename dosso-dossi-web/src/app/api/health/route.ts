import { isWebBackendHealthy } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await isWebBackendHealthy();
  return Response.json(
    { ok, service: "web" },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    },
  );
}
