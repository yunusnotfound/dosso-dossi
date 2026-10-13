import assert from "node:assert/strict";
import test from "node:test";
import {
  addPreviewQuantity,
  cartLineKey,
  catalogItems,
  formatPrice,
  minimumPriceMinor,
  reconcilePreviewCart,
  variantCartQuantity,
} from "../src/lib/catalog.ts";

function coffee(overrides = {}) {
  return {
    id: "coffee-product", slug: "coffee", type: "COFFEE", status: "PUBLISHED",
    nameTr: "Kahve", nameEn: "Coffee", descriptionTr: "", descriptionEn: "",
    sortOrder: 0, version: 1,
    images: [
      { id: "product-image-1", mediaId: "media-1", url: "/api/web/catalog-media/first.webp", altTr: "Bir", altEn: "One", sortOrder: 0 },
      { id: "product-image-2", mediaId: "media-2", url: "/api/web/catalog-media/second.webp", altTr: "İki", altEn: "Two", sortOrder: 1 },
    ],
    variants: [{ id: "sku-250", sku: "COFFEE-250", labelTr: "250 g", labelEn: "250 g", colorNameTr: null, colorNameEn: null, colorHex: null, weightGrams: 250, volumeMl: null, priceMinor: 35001, stock: 3, active: true, imageId: "media-2" }],
    grindOptions: [
      { id: "whole", code: "WHOLE", nameTr: "Çekirdek", nameEn: "Whole bean", priceDeltaMinor: 0, sortOrder: 0, active: true },
      { id: "espresso", code: "ESPRESSO", nameTr: "Espresso", nameEn: "Espresso", priceDeltaMinor: 750, sortOrder: 1, active: true },
      { id: "inactive", code: "INACTIVE", nameTr: "Kapalı", nameEn: "Inactive", priceDeltaMinor: 0, sortOrder: 2, active: false },
    ],
    ...overrides,
  };
}
const item = () => catalogItems([coffee()])[0];

test("catalog uses published active SKUs and their media relation, including zero stock", () => {
  const product = coffee();
  product.variants.push({ ...product.variants[0], id: "inactive-sku", active: false });
  product.variants.push({ ...product.variants[0], id: "sold-out-sku", stock: 0, imageId: null });
  const cards = catalogItems([coffee({ status: "DRAFT" }), coffee({ status: "ARCHIVED" }), product]);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].image, "/api/web/catalog-media/second.webp");
  assert.equal(cards[1].image, "/api/web/catalog-media/first.webp");
  assert.equal(cards[1].variant.stock, 0);
});

test("different grinds share the actual SKU stock and remain separate cart lines", () => {
  let lines = addPreviewQuantity([], item(), "whole", 2);
  lines = addPreviewQuantity(lines, item(), "espresso", 2);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => line.quantity), [2, 1]);
  assert.equal(variantCartQuantity(lines, "sku-250"), 3);
  assert.deepEqual(addPreviewQuantity(lines, item(), "whole", 1), lines);
  assert.notEqual(cartLineKey("sku-250", "whole"), cartLineKey("sku-250", "espresso"));
});

test("unavailable stock, inactive or unknown grind, missing required grind and invalid quantities are rejected", () => {
  const soldOut = item();
  soldOut.variant.stock = 0;
  assert.deepEqual(addPreviewQuantity([], soldOut, "whole", 1), []);
  for (const grind of ["inactive", "unknown", null]) assert.deepEqual(addPreviewQuantity([], item(), grind, 1), []);
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) assert.deepEqual(addPreviewQuantity([], item(), "whole", quantity), []);
});

test("a product without grind options accepts only a variant-only cart line", () => {
  const thermos = catalogItems([coffee({ type: "THERMOS", grindOptions: [] })])[0];
  assert.equal(addPreviewQuantity([], thermos, null, 1)[0].quantity, 1);
  assert.deepEqual(addPreviewQuantity([], thermos, "whole", 1), []);
});

test("refresh reconciles lower stock across grind lines and removes unpublished or deactivated products", () => {
  const lines = [
    { variantId: "sku-250", grindId: "whole", quantity: 2 },
    { variantId: "sku-250", grindId: "espresso", quantity: 1 },
  ];
  const updated = coffee();
  updated.variants[0].stock = 1;
  assert.deepEqual(reconcilePreviewCart(lines, catalogItems([updated])), [{ variantId: "sku-250", grindId: "whole", quantity: 1 }]);
  assert.deepEqual(reconcilePreviewCart(lines, []), []);
  updated.grindOptions[0].active = false;
  assert.deepEqual(reconcilePreviewCart(lines, catalogItems([updated])), [{ variantId: "sku-250", grindId: "espresso", quantity: 1 }]);
});

test("money stays in kuruş and card price includes the cheapest active grind", () => {
  assert.equal(formatPrice(35001, "tr"), "₺350,01");
  const paidGrind = item();
  paidGrind.product.grindOptions[0].priceDeltaMinor = 500;
  assert.equal(minimumPriceMinor(paidGrind), 35501);
  assert.equal(paidGrind.priceMinor + paidGrind.product.grindOptions[1].priceDeltaMinor, 35751);
});
