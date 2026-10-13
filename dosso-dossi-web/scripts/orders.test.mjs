import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import ts from "typescript";

// Run the real client helpers after TypeScript transpilation, with their sole
// runtime dependency embedded so Node needs no Next alias/module resolver.
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const commerceUrl = moduleUrl(
  compile(
    await fs.readFile(
      new URL("../src/lib/web-commerce.ts", import.meta.url),
      "utf8",
    ),
  ),
);
const orderSource = compile(
  await fs.readFile(
    new URL("../src/lib/web-orders.ts", import.meta.url),
    "utf8",
  ),
).replaceAll('from "./web-commerce"', `from ${JSON.stringify(commerceUrl)}`);
const { sandboxPaymentUrl, orderError } = await import(moduleUrl(orderSource));
const { CommerceRequestError } = await import(commerceUrl);

test("checkout navigation accepts only validated hosted sandbox destinations", () => {
  for (const value of [
    "https://sandbox-cpp.iyzipay.com/?token=abc_123-test&lang=tr",
    "https://sandbox-api.iyzipay.com/checkoutform/test/path?token=abc_123-test&lang=en",
  ]) {
    assert.equal(sandboxPaymentUrl(value), value);
  }
});
test("checkout rejects live hosts, credentials, fragments, alternate ports and schemes", () => {
  for (const value of [
    "https://cpp.iyzipay.com/?token=abc123456",
    "https://sandbox-cpp.iyzipay.com.foreign.example/?token=abc123456",
    "https://foreign.example/?token=abc123456",
    "http://sandbox-cpp.iyzipay.com/?token=abc123456",
    "https://user:secret@sandbox-cpp.iyzipay.com/?token=abc123456",
    "https://sandbox-cpp.iyzipay.com:444/?token=abc123456",
    "https://sandbox-cpp.iyzipay.com/?token=abc123456#redirect",
    "javascript:alert(1)",
    "/checkout",
    null,
  ])
    assert.equal(sandboxPaymentUrl(value), null, String(value));
});
test("checkout rejects arbitrary paths, missing/repeated tokens and redirect query parameters", () => {
  for (const value of [
    "https://sandbox-cpp.iyzipay.com/other?token=abc123456",
    "https://sandbox-api.iyzipay.com/payment?token=abc123456",
    "https://sandbox-cpp.iyzipay.com/",
    "https://sandbox-cpp.iyzipay.com/?token=abc123456&token=abc123456",
    "https://sandbox-cpp.iyzipay.com/?token=abc123456&next=https://foreign.example",
    "https://sandbox-cpp.iyzipay.com/?token=abc123456&lang=de",
  ])
    assert.equal(sandboxPaymentUrl(value), null, value);
});
test("network/service failure never claims an order was saved or payment was not taken", () => {
  for (const locale of ["tr", "en"]) {
    const message = orderError(
      new CommerceRequestError("WEB_UNAVAILABLE", 503),
      locale,
    );
    assert.doesNotMatch(
      message,
      /siparişiniz kayıtlı|ödeme alınmadı|order is saved|no payment was taken/i,
    );
  }
});
test("ambiguous payment response directs the customer to check before another payment", () => {
  assert.match(
    orderError(new CommerceRequestError("PAYMENT_NOT_PENDING", 502), "tr"),
    /yeni.*ödeme|yeniden.*ödeme/i,
  );
  assert.match(
    orderError(new CommerceRequestError("PAYMENT_NOT_PENDING", 502), "en"),
    /another payment|new payment/i,
  );
});
