import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareShipping,
  shippingDraft,
  shippingMoney,
} from "../src/lib/admin-shipping.ts";

test("shipping price converts either decimal separator to exact kuruş", () => {
  for (const [input, expected] of [
    ["12,50", 1250],
    ["12.50", 1250],
    ["0,01", 1],
    ["0.29", 29],
    ["49,9", 4990],
    ["1000000", 100000000],
  ])
    assert.equal(shippingMoney(input), expected);
});
test("an unset shipping fee remains distinct from explicitly free shipping", () => {
  assert.equal(shippingMoney("  "), null);
  assert.equal(shippingMoney("0"), 0);
  assert.equal(
    prepareShipping(
      { enabled: true, fee: "", freeShipping: false, threshold: "" },
      1,
    ).payload.feeMinor,
    null,
  );
  assert.equal(
    prepareShipping(
      { enabled: true, fee: "0", freeShipping: false, threshold: "" },
      1,
    ).payload.feeMinor,
    0,
  );
});
test("shipping prices reject malformed, signed, exponential and fractional-kuruş inputs", () => {
  for (const input of [
    "NaN",
    "Infinity",
    "1e2",
    "-1",
    "+1",
    "1.001",
    "1,001",
    "1,000.00",
    "1.000,00",
    "1000000.01",
    "1.",
    ".5",
  ])
    assert.equal(shippingMoney(input), "invalid", input);
});
test("free shipping needs a positive threshold and a configured standard fee", () => {
  for (const draft of [
    { enabled: true, fee: "", freeShipping: true, threshold: "500" },
    { enabled: true, fee: "49", freeShipping: true, threshold: "0" },
    { enabled: true, fee: "49", freeShipping: true, threshold: "" },
  ])
    assert.ok(prepareShipping(draft, 2).error);
  assert.deepEqual(
    prepareShipping(
      { enabled: true, fee: "49,90", freeShipping: true, threshold: "500,01" },
      2,
    ).payload,
    {
      version: 2,
      enabled: true,
      feeMinor: 4990,
      freeShippingThresholdMinor: 50001,
      country: "TR",
      currency: "TRY",
    },
  );
});
test("turning the free threshold off clears it without losing a paused tariff", () => {
  const settings = {
    version: 3,
    enabled: false,
    feeMinor: 4950,
    freeShippingThresholdMinor: 65000,
    country: "TR",
    currency: "TRY",
  };
  const draft = shippingDraft(settings);
  assert.deepEqual(prepareShipping(draft, 3).payload, settings);
  draft.freeShipping = false;
  assert.deepEqual(prepareShipping(draft, 3).payload, {
    ...settings,
    freeShippingThresholdMinor: null,
  });
  assert.ok(prepareShipping(draft, 0).error);
});
