import assert from "node:assert/strict";
import test from "node:test";

const origin = new URL(process.env.WEB_PREVIEW_URL ?? "http://127.0.0.1:4000");
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
) {
  throw new Error("Order checks may only target the local preview.");
}
const endpoint = (path) => new URL(`/api/web/${path}`, origin);
const json = { Origin: origin.origin, "Content-Type": "application/json" };
const mutations = [
  ["POST", "orders"],
  ["POST", "orders/example/cancel"],
  ["POST", "orders/example/payment"],
  ["POST", "orders/example/payment/refresh"],
  ["PATCH", "admin/orders/example"],
];

test("all order/payment/admin mutations require same-origin JSON", async () => {
  for (const [method, path] of mutations) {
    const foreign = await fetch(endpoint(path), {
      method,
      headers: { ...json, Origin: "https://foreign.example" },
      body: "{}",
    });
    assert.equal(foreign.status, 403, path);
    const cross = await fetch(endpoint(path), {
      method,
      headers: { ...json, "Sec-Fetch-Site": "cross-site" },
      body: "{}",
    });
    assert.equal(cross.status, 403, path);
    const form = await fetch(endpoint(path), {
      method,
      headers: { ...json, "Content-Type": "application/x-www-form-urlencoded" },
      body: "version=1",
    });
    assert.equal(form.status, 415, path);
  }
});

test("customer orders require customer cookie, never admin or browser bearer", async () => {
  for (const path of ["orders", "orders/quote", "orders/example"]) {
    const response = await fetch(endpoint(path), {
      headers: {
        Cookie: `dosso_web_admin=${"a".repeat(64)}`,
        Authorization: `Bearer ${"a".repeat(64)}`,
      },
    });
    assert.equal(response.status, 401, path);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
  for (const [method, path] of mutations.filter(
    ([, path]) => !path.startsWith("admin/"),
  )) {
    assert.equal(
      (await fetch(endpoint(path), { method, headers: json, body: "{}" }))
        .status,
      401,
      path,
    );
  }
});

test("customer cookie cannot list or change administrator orders", async () => {
  for (const [method, path] of [
    ["GET", "admin/orders"],
    ["GET", "admin/orders/example"],
    ["PATCH", "admin/orders/example"],
  ]) {
    const response = await fetch(endpoint(path), {
      method,
      headers: { ...json, Cookie: `dosso_web_customer=${"a".repeat(64)}` },
      ...(method === "PATCH" ? { body: "{}" } : {}),
    });
    assert.equal(response.status, 401, path);
  }
});

test("order payloads are bounded before reaching backend including admin actions", async () => {
  for (const [method, path] of mutations) {
    const cookie = path.startsWith("admin/")
      ? "dosso_web_admin"
      : "dosso_web_customer";
    const headers = { ...json, Cookie: `${cookie}=${"a".repeat(64)}` };
    const large = await fetch(endpoint(path), {
      method,
      headers,
      body: JSON.stringify({ note: "x".repeat(9000) }),
    });
    assert.equal(large.status, 413, path);
    const broken = await fetch(endpoint(path), { method, headers, body: "{" });
    assert.equal(broken.status, 400, path);
  }
});

test("order query allows only bounded, single-value pagination and status", async () => {
  for (const path of ["orders", "admin/orders"]) {
    const cookie = path.startsWith("admin/")
      ? "dosso_web_admin"
      : "dosso_web_customer";
    for (const query of [
      "page=0",
      "page=1000000",
      "limit=51",
      "page=1&page=2",
      "status=PAID",
      "customerId=someone",
      "url=https://foreign.example",
      "limit=1e2",
    ]) {
      const response = await fetch(endpoint(`${path}?${query}`), {
        headers: { Cookie: `${cookie}=${"a".repeat(64)}` },
      });
      assert.equal(response.status, 400, `${path}?${query}`);
    }
  }
});

test("unlisted payment, refund and mobile routes remain inaccessible", async () => {
  for (const [method, path] of [
    ["POST", "orders/example/paid"],
    ["POST", "orders/example/refund"],
    ["DELETE", "orders/example"],
    ["PUT", "orders"],
    ["POST", "admin/orders"],
    ["POST", "admin/orders/example/payment"],
    ["POST", "payments/iyzico/callback"],
    ["GET", "orders/example/payment/refresh"],
  ]) {
    const response = await fetch(endpoint(path), {
      method,
      ...(method === "GET" ? {} : { headers: json, body: "{}" }),
    });
    assert.equal(response.status, 404, `${method} ${path}`);
  }
});
