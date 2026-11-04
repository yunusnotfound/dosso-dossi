import assert from "node:assert/strict";
import test from "node:test";
import { catalogItems } from "../src/lib/catalog.ts";
import { safeShopReturn, loginForSelection, productSelectionPath, resolveProductSelection, findCoffees, detailRows } from "../src/lib/product-helpers.ts";

const product = (overrides = {}) => ({
  id: "coffee", slug: "deneme-kahve", type: "COFFEE", status: "PUBLISHED", nameTr: "Kahve", nameEn: "Coffee", descriptionTr: "", descriptionEn: "", sortOrder: 1, version: 1, images: [],
  variants: [{ id: "coffee-250", sku: "C250", labelTr: "250 g", labelEn: "250 g", colorNameTr: null, colorNameEn: null, colorHex: null, weightGrams: 250, volumeMl: null, priceMinor: 30000, stock: 3, active: true, imageId: null }],
  grindOptions: [{ id: "whole", code: "whole", nameTr: "Çekirdek", nameEn: "Whole", priceDeltaMinor: 0, sortOrder: 0, active: true }, { id: "filter", code: "filter", nameTr: "Filtre", nameEn: "Filter", priceDeltaMinor: 500, sortOrder: 1, active: true }],
  ...overrides,
});
test("product selection survives the login return URL including language, SKU, grind and quantity", () => {
  const item = catalogItems([product()])[0];
  const path = productSelectionPath("en", item, "filter", 3);
  const login = new URL(loginForSelection("en", path), "https://example.test");
  assert.equal(login.pathname, "/en/hesabim");
  assert.equal(login.searchParams.get("returnTo"), path);
  const url = new URL(safeShopReturn(login.searchParams.get("returnTo")), "https://example.test");
  const selection = resolveProductSelection([item], url.searchParams);
  assert.equal(selection.item.id, "coffee-250"); assert.equal(selection.grind.id, "filter"); assert.equal(selection.quantity, 3);
});
test("authentication return destinations reject external, protocol-relative, control-character and unrelated paths", () => {
  for (const value of ["https://evil.test/alisveris", "//evil.test/alisveris", "/\\evil.test/alisveris", "/api/web/auth/logout", "/yonetim", "/urun/foo\n", "/%2f%2fevil.test", "/urun/%2e%2e/yonetim"]) assert.equal(safeShopReturn(value), null, value);
  assert.equal(safeShopReturn("/alisveris?setCoffee=c&setThermos=t#set"), "/alisveris?setCoffee=c&setThermos=t#set");
});
test("selection ignores unknown and disabled options, bounds invalid quantities", () => {
  const p = product(); p.grindOptions.push({ ...p.grindOptions[0], id: "inactive", active: false });
  const items = catalogItems([p]);
  for (const quantity of ["-1", "0", "1.5", "999", "NaN"]) {
    const result = resolveProductSelection(items, new URLSearchParams({ variant: "missing", grind: "inactive", quantity }));
    assert.equal(result.item.id, "coffee-250"); assert.equal(result.grind.id, "whole"); assert.equal(result.quantity, 1);
  }
});
test("coffee finder only uses declared metadata and excludes thermoses, inactive SKUs and sold-out products", () => {
  const actual = product({ details: { roast: "MEDIUM", brewingMethods: ["FILTER"] } });
  const unknown = product({ id: "unknown", variants: [{ ...actual.variants[0], id: "unknown-sku" }] });
  const soldOut = product({ id: "sold", variants: [{ ...actual.variants[0], stock: 0 }] });
  const thermos = product({ id: "thermos", type: "THERMOS" });
  const items = catalogItems([actual, unknown, soldOut, thermos]);
  const prefs = { method: "FILTER", roast: "MEDIUM", maxPriceMinor: null };
  assert.deepEqual(findCoffees(items, prefs).map(item => item.product.id), ["coffee"]);
  assert.equal(findCoffees(items, { ...prefs, method: "TURKISH" }).length, 0);
  assert.equal(findCoffees(items, { ...prefs, grindCode: "filter", maxPriceMinor: 30000 }).length, 0);
  assert.equal(findCoffees(items, { ...prefs, grindCode: "filter", maxPriceMinor: 30500 }).length, 1);
  assert.equal(findCoffees(items, { ...prefs, weightGrams: 1000 }).length, 0);
});
test("product facts remain empty until real information is supplied and honor locale", () => {
  assert.deepEqual(detailRows(product(), "tr"), []);
  assert.deepEqual(detailRows(product({ details: { originTr: "Kolombiya", roast: "MEDIUM" } }), "en"), [{ label: "Roast", value: "Medium" }]);
});
