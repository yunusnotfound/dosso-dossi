import assert from "node:assert/strict";
import test from "node:test";

const origin = new URL(process.env.WEB_PREVIEW_URL ?? "http://127.0.0.1:4000");
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
) {
  throw new Error("Customer boundary tests may only target a local preview.");
}
const endpoint = (path) => new URL(`/api/web/auth/${path}`, origin);
const headers = { Origin: origin.origin, "Content-Type": "application/json" };

test("all public mutations reject missing and foreign origins before touching accounts", async () => {
  for (const action of [
    "register",
    "login",
    "resend-verification",
    "verify-email",
    "forgot-password",
    "reset-password",
  ]) {
    for (const suppliedOrigin of [
      null,
      "null",
      "https://other.example",
      "http://127.0.0.1:4001",
    ]) {
      const response = await fetch(endpoint(action), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(suppliedOrigin ? { Origin: suppliedOrigin } : {}),
        },
        body: "{}",
      });
      assert.equal(response.status, 403, action);
      assert.equal((await response.json()).error.code, "INVALID_ORIGIN");
      assert.equal(response.headers.get("set-cookie"), null);
    }
  }
});

test("cross-site Fetch Metadata and non-JSON forms are rejected", async () => {
  const crossSite = await fetch(endpoint("login"), {
    method: "POST",
    headers: { ...headers, "Sec-Fetch-Site": "cross-site" },
    body: "{}",
  });
  assert.equal(crossSite.status, 403);
  for (const contentType of [
    "text/plain",
    "application/x-www-form-urlencoded",
    "application/json-pretend",
  ]) {
    const response = await fetch(endpoint("register"), {
      method: "POST",
      headers: { ...headers, "Content-Type": contentType },
      body: "{}",
    });
    assert.equal(response.status, 415);
  }
});

test("oversized and malformed JSON are rejected before backend work", async () => {
  const oversized = await fetch(endpoint("register"), {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "a".repeat(5000) }),
  });
  assert.equal(oversized.status, 413);
  const malformed = await fetch(endpoint("register"), {
    method: "POST",
    headers,
    body: "{",
  });
  assert.equal(malformed.status, 400);
});

test("admin cookies or client Authorization headers do not authenticate a customer", async () => {
  const response = await fetch(endpoint("session"), {
    headers: {
      Cookie: `dosso_web_admin=${"a".repeat(64)}`,
      Authorization: `Bearer ${"a".repeat(64)}`,
    },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("GET cannot consume verification/reset tokens or access other backend namespaces", async () => {
  for (const action of [
    "verify-email",
    "reset-password",
    "register",
    "admin/products",
    "me/wallet",
    "health",
  ]) {
    const response = await fetch(endpoint(action));
    assert.equal(response.status, 404, action);
  }
});

test("a customer cookie cannot authenticate the admin proxy", async () => {
  const response = await fetch(new URL("/api/web/admin/auth/session", origin), {
    headers: { Cookie: `dosso_web_customer=${"a".repeat(64)}` },
  });
  assert.equal(response.status, 401);
});
