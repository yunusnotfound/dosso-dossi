import type { Metadata } from "next";

export type Locale = "tr" | "en";
export type PageKind = "home" | "shop";

export const previewMetadata: Metadata = {
  title: {
    default: "Dosso Dossi Coffee",
    template: "%s | Dosso Dossi Coffee",
  },
  robots: { index: false, follow: false, noarchive: true },
};

export function pagePath(locale: Locale, page: PageKind): string {
  const prefix = locale === "en" ? "/en" : "";
  return page === "shop" ? `${prefix}/alisveris` : prefix || "/";
}
