/** Explicit publication is separate from NODE_ENV: a production preview stays private. */
export function siteRelease(environment = process.env) {
  const visibility = environment.WEB_VISIBILITY ?? "preview";
  if (!["preview", "public"].includes(visibility)) throw new Error("WEB_VISIBILITY must be preview or public.");
  const configured = environment.WEB_ORIGIN?.trim();
  let origin;
  if (configured) {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("WEB_ORIGIN must be an HTTP(S) origin without a path or credentials.");
    }
    origin = url.origin;
    if (visibility === "public" && (url.protocol !== "https:" || !url.hostname.includes(".") || /(^|\.)(localhost|local|test|invalid)$/.test(url.hostname) || /^[\d.:\[\]]+$/.test(url.hostname))) {
      throw new Error("Public indexing requires a real HTTPS WEB_ORIGIN.");
    }
  }
  if (visibility === "public" && !origin) throw new Error("WEB_ORIGIN is required for public indexing.");
  return { public: visibility === "public", origin: origin ?? "http://127.0.0.1:4000" };
}

export const publicPagePaths = ["/", "/alisveris", "/hikayemiz", "/menu", "/mobil", "/subeler", "/franchising", "/sanal-magaza"];
export const privatePaths = ["/api", "/yonetim", "/hesabim", "/en/hesabim", "/sepet", "/en/sepet"];

export function publishedProductPaths(products) {
  return products.filter((product) => product.status === "PUBLISHED" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)
    && product.variants?.some((variant) => variant.active === true)).map((product) => `/urun/${product.slug}`);
}

export function localizedPath(path, locale) {
  return locale === "en" ? `/en${path === "/" ? "" : path}` : path;
}

export function securityHeaders(development = false) {
  // Framing is enforced now. The fuller policy is observed before enforcement;
  // Next hydration/style tags and Three/Rapier WASM remain compatible.
  const policy = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "font-src 'self' data:", `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "media-src 'self' blob:", "worker-src 'self' blob:", "frame-src 'none'", "form-action 'self'",
  ].join("; ");
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    { key: "Content-Security-Policy-Report-Only", value: policy },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
}
