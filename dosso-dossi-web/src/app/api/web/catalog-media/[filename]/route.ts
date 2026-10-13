import { backendOrigin } from "@/lib/web-admin-proxy";

export const runtime = "nodejs";
const filenamePattern = /^[a-zA-Z0-9_-]{1,100}\.webp$/;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!filenamePattern.test(filename))
    return new Response(null, { status: 404 });
  try {
    const upstream = await fetch(
      new URL(`/web/media/${filename}`, backendOrigin()),
      {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!upstream.ok)
      return new Response(null, {
        status: upstream.status === 404 ? 404 : 503,
      });
    if (!upstream.headers.get("content-type")?.startsWith("image/webp"))
      return new Response(null, { status: 502 });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
