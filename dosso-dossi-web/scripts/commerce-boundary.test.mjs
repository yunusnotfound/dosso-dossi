import assert from "node:assert/strict";
import test from "node:test";

const origin = new URL(process.env.WEB_PREVIEW_URL ?? "http://127.0.0.1:4000");
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
) {
  throw new Error("Commerce tests may only target the local preview.");
}
const endpoint = (path) => new URL(`/api/web/${path}`, origin);
const headers = { Origin: origin.origin, "Content-Type": "application/json" };
const mutations = [
  ["POST", "cart/items"],
  ["PATCH", "cart/items/example"],
  ["DELETE", "cart/items/example"],
  ["PUT", "cart/address"],
  ["POST", "addresses"],
  ["PUT", "addresses/example"],
  ["DELETE", "addresses/example"],
];

test("every cart/address mutation checks origin including DELETE", async () => {
  for (const [method, path] of mutations) {
    for (const supplied of [undefined, "https://foreign.example", "null"]) {
      const response = await fetch(endpoint(path), {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(supplied ? { Origin: supplied } : {}),
        },
        body: "{}",
      });
      assert.equal(response.status, 403, `${method} ${path}`);
    }
  }
});

test("private reads/mutations ignore browser Authorization and administrator cookie", async () => {
  for (const path of ["cart", "addresses"]) {
    const response = await fetch(endpoint(path), {
      headers: {
        Cookie: `dosso_web_admin=${"a".repeat(64)}`,
        Authorization: `Bearer ${"a".repeat(64)}`,
      },
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
  for (const [method, path] of mutations) {
    const response = await fetch(endpoint(path), {
      method,
      headers,
      body: "{}",
    });
    assert.equal(response.status, 401);
  }
});

test("cross-site metadata and ambiguous JSON media types are refused", async () => {
  const cross = await fetch(endpoint("addresses"), {
    method: "POST",
    headers: { ...headers, "Sec-Fetch-Site": "cross-site" },
    body: "{}",
  });
  assert.equal(cross.status, 403);
  for (const contentType of [
    "text/plain",
    "application/x-www-form-urlencoded",
    "application/json-invalid",
  ]) {
    const response = await fetch(endpoint("addresses"), {
      method: "POST",
      headers: { ...headers, "Content-Type": contentType },
      body: "{}",
    });
    assert.equal(response.status, 415);
  }
});

test("address payload stream is bounded and must contain valid JSON", async () => {
  const authenticatedHeaders = {
    ...headers,
    Cookie: `dosso_web_customer=${"a".repeat(64)}`,
  };
  const large = await fetch(endpoint("addresses"), {
    method: "POST",
    headers: authenticatedHeaders,
    body: JSON.stringify({ addressLine: "x".repeat(9000) }),
  });
  assert.equal(large.status, 413);
  const malformed = await fetch(endpoint("addresses"), {
    method: "POST",
    headers: authenticatedHeaders,
    body: "{",
  });
  assert.equal(malformed.status, 400);
});

test("fixed allowlist cannot access arbitrary backend namespaces or write shipping", async () => {
  for (const [method, path] of [
    ["GET", "me/wallet"],
    ["GET", "orders/example/refund"],
    ["GET", "cart/items/example"],
    ["POST", "shipping"],
    ["PUT", "cart"],
    ["POST", "addresses/example"],
    ["PUT", "cart/items/example"],
    ["GET", "addresses/example/history"],
  ]) {
    const response = await fetch(endpoint(path), {
      method,
      ...(method === "GET" ? {} : { headers, body: "{}" }),
    });
    assert.equal(response.status, 404, `${method} ${path}`);
  }
});

test("customer session cannot change admin shipping, admin mutation checks origin", async () => {
  const customer = await fetch(endpoint("admin/shipping"), {
    method: "PUT",
    headers: { ...headers, Cookie: `dosso_web_customer=${"a".repeat(64)}` },
    body: "{}",
  });
  assert.equal(customer.status, 401);
  const foreign = await fetch(endpoint("admin/shipping"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://foreign.example",
    },
    body: "{}",
  });
  assert.equal(foreign.status, 403);
});
