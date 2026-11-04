import assert from "node:assert/strict";
import test from "node:test";

const origin = new URL(process.env.WEB_PREVIEW_URL ?? "http://127.0.0.1:4000");
if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) {
  throw new Error("Franchise boundary tests may only target a local preview.");
}
const endpoint = new URL("/api/web/franchise-inquiries", origin);
const headers = { Origin: origin.origin, "Content-Type": "application/json" };

async function expectRejected(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  const result = await response.json();
  assert.equal(typeof result.error, "string");
  assert.equal(result.receipt, undefined);
}

// Every POST below fails in the Next boundary before an upstream fetch.
// Do not add valid submissions: the local preview may use the real local web DB.
test("public franchise submissions reject absent and foreign origins", async () => {
  for (const suppliedOrigin of [undefined, "null", "https://foreign.example", "http://127.0.0.1:4001"]) {
    await expectRejected(await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", ...(suppliedOrigin ? { Origin: suppliedOrigin } : {}) }, body: "{}",
    }), 403);
  }
});
test("franchise Fetch Metadata rejects cross-site even with an allowed origin", async () => {
  await expectRejected(await fetch(endpoint, {
    method: "POST", headers: { ...headers, "Sec-Fetch-Site": "cross-site" }, body: "{}",
  }), 403);
});
test("franchise accepts only the exact JSON media type", async () => {
  for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "application/json-pretend", "application/jsonp", "multipart/form-data"]) {
    await expectRejected(await fetch(endpoint, {
      method: "POST", headers: { ...headers, "Content-Type": contentType }, body: "{}",
    }), 415);
  }
});
test("franchise rejects oversized known-length and streamed bodies before parsing", async () => {
  await expectRejected(await fetch(endpoint, {
    method: "POST", headers, body: JSON.stringify({ message: "x".repeat(17_000) }),
  }), 413);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(" ".repeat(9_000)));
      controller.enqueue(new TextEncoder().encode(" ".repeat(9_000)));
      controller.close();
    },
  });
  await expectRejected(await fetch(endpoint, { method: "POST", headers, body, duplex: "half" }), 413);
});
test("franchise rejects malformed and empty JSON without creating a receipt", async () => {
  for (const body of ["{", "", " "]) {
    await expectRejected(await fetch(endpoint, { method: "POST", headers, body }), 400);
  }
});
test("a GET cannot submit a franchise application", async () => {
  const response = await fetch(endpoint);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("set-cookie"), null);
});
