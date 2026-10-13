import assert from "node:assert/strict";
import test from "node:test";

const origin = new URL(process.env.WEB_PREVIEW_URL ?? "http://127.0.0.1:4000");
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
) {
  throw new Error(
    "Boundary checks may only target an explicitly local preview.",
  );
}
const endpoint = (path) => new URL(`/api/web/admin/${path}`, origin);

for (const suppliedOrigin of [
  undefined,
  "null",
  "https://other.example",
  "http://127.0.0.1:4001",
]) {
  test(`login rejects missing/foreign Origin: ${suppliedOrigin ?? "missing"}`, async () => {
    const response = await fetch(endpoint("auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(suppliedOrigin ? { Origin: suppliedOrigin } : {}),
      },
      body: "{}",
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "INVALID_ORIGIN");
    assert.equal(response.headers.get("set-cookie"), null);
  });
}

test("login rejects cross-site Fetch Metadata even with a spoofed Origin", async () => {
  const response = await fetch(endpoint("auth/login"), {
    method: "POST",
    headers: {
      Origin: origin.origin,
      "Sec-Fetch-Site": "cross-site",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(response.status, 403);
});

test("same-origin form cannot bypass the JSON-only mutation boundary", async () => {
  const response = await fetch(endpoint("products"), {
    method: "POST",
    headers: { Origin: origin.origin, "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(response.status, 415);
});

test("session and catalog management require the HttpOnly admin cookie", async () => {
  for (const path of ["auth/session", "products"]) {
    const response = await fetch(endpoint(path), {
      headers: { Authorization: "Bearer browser-supplied-mobile-token" },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "UNAUTHORIZED");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("proxy cannot access mobile admin or arbitrary backend routes", async () => {
  for (const path of [
    "admin/users",
    "health",
    "auth/register",
    "media/unlisted-file",
  ]) {
    const response = await fetch(endpoint(path));
    assert.equal(response.status, 404);
  }
});

test("public media proxy rejects HTML, SVG and path-like names", async () => {
  for (const name of [
    "secret.svg",
    "index.html",
    "photo.png",
    "bad%2Fname.webp",
  ]) {
    const response = await fetch(
      new URL(`/api/web/catalog-media/${name}`, origin),
    );
    assert.equal(response.status, 404);
  }
});
