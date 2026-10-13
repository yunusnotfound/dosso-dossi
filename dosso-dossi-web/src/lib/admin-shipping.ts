import type { ShippingSettings } from "./web-commerce";

export type ShippingDraft = {
  enabled: boolean;
  fee: string;
  freeShipping: boolean;
  threshold: string;
};
export type ShippingEditorState = {
  settings: ShippingSettings;
  draft: ShippingDraft;
};

export function shippingDraft(settings: ShippingSettings): ShippingDraft {
  const money = (minor: number | null) =>
    minor === null
      ? ""
      : `${Math.floor(minor / 100)},${String(minor % 100).padStart(2, "0")}`;
  return {
    enabled: settings.enabled,
    fee: money(settings.feeMinor),
    freeShipping: settings.freeShippingThresholdMinor !== null,
    threshold: money(settings.freeShippingThresholdMinor),
  };
}

// Parse the two decimal components independently, avoiding floating point
// multiplication and treating an empty field as unconfigured rather than free.
export function shippingMoney(value: string): number | null | "invalid" {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) return "invalid";
  const [whole, cents = ""] = normalized.split(".");
  const minor = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor <= 100_000_000
    ? minor
    : "invalid";
}

export function prepareShipping(
  draft: ShippingDraft,
  version: number,
): { payload?: ShippingSettings; error?: string } {
  const fee = shippingMoney(draft.fee);
  if (fee === "invalid")
    return {
      error:
        "Kargo ücreti 0–1.000.000 TL arasında, en fazla iki ondalıklı olmalıdır.",
    };
  const threshold = draft.freeShipping ? shippingMoney(draft.threshold) : null;
  if (
    draft.freeShipping &&
    (threshold === null || threshold === "invalid" || threshold <= 0)
  )
    return {
      error:
        "Ücretsiz kargo eşiği 0–1.000.000 TL arasında, sıfırdan büyük ve en fazla iki ondalıklı olmalıdır.",
    };
  if (fee === null && threshold !== null)
    return {
      error:
        "Ücretsiz kargo eşiği için önce standart kargo ücretini belirleyin.",
    };
  if (!Number.isSafeInteger(version) || version < 1)
    return { error: "Ayarların güncel sürümünü yükleyip yeniden deneyin." };
  return {
    payload: {
      version,
      enabled: draft.enabled,
      feeMinor: fee,
      freeShippingThresholdMinor: threshold as number | null,
      country: "TR",
      currency: "TRY",
    },
  };
}
