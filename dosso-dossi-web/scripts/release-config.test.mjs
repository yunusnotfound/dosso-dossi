import test from "node:test";
import assert from "node:assert/strict";
import { localizedPath, privatePaths, publicPagePaths, publishedProductPaths, securityHeaders, siteRelease } from "../config/site-release.mjs";

test("production alone never enables indexing", () => {
  assert.equal(siteRelease({ NODE_ENV: "production" }).public, false);
  assert.equal(siteRelease({ WEB_VISIBILITY: "preview", WEB_ORIGIN: "https://coffee.example.com" }).public, false);
});
test("public publication requires an explicit HTTPS public origin", () => {
  for (const origin of [undefined, "http://coffee.example.com", "https://localhost", "https://127.0.0.1", "https://coffee.test", "https://user:secret@coffee.example.com", "https://coffee.example.com/path"]) {
    assert.throws(() => siteRelease({ WEB_VISIBILITY: "public", WEB_ORIGIN: origin }));
  }
  assert.deepEqual(siteRelease({ WEB_VISIBILITY: "public", WEB_ORIGIN: "https://coffee.example.com/" }), { public: true, origin: "https://coffee.example.com" });
  assert.throws(() => siteRelease({ WEB_VISIBILITY: "publci" }));
});
test("sitemap allowlist cannot accidentally publish private routes", () => {
  for (const path of publicPagePaths) for (const locale of ["tr", "en"]) {
    const localized = localizedPath(path, locale);
    assert.ok(!privatePaths.some((privatePath) => localized === privatePath || localized.startsWith(`${privatePath}/`)));
  }
  assert.equal(localizedPath("/", "en"), "/en");
});
test("framing is enforced while the broader policy is report-only and WASM compatible", () => {
  const headers = Object.fromEntries(securityHeaders(false).map(({ key, value }) => [key, value]));
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy-Report-Only"], /wasm-unsafe-eval/);
  assert.doesNotMatch(headers["Content-Security-Policy-Report-Only"], / 'unsafe-eval'/);
});
test("product sitemap excludes drafts, archived products and products without an active SKU", () => {
  const product = { slug: "kenya-coffee", status: "PUBLISHED", variants: [{ active: true, stock: 0 }] };
  assert.deepEqual(publishedProductPaths([
    product,
    { ...product, status: "DRAFT" },
    { ...product, status: "ARCHIVED" },
    { ...product, variants: [{ active: false }] },
    { ...product, slug: "../hesabim" },
  ]), ["/urun/kenya-coffee"]);
});
