import "server-only";
import type { Metadata } from "next";
import type { Locale } from "./site";
import { localizedPath, siteRelease } from "../../config/site-release.mjs";

export const privateRobots = { index: false, follow: false, noarchive: true };

export function siteMetadata(locale: Locale): Metadata {
  const release = siteRelease();
  return {
    metadataBase: new URL(release.origin),
    title: { default: "Dosso Dossi Coffee", template: "%s | Dosso Dossi Coffee" },
    applicationName: "Dosso Dossi Coffee",
    // New/private routes stay closed unless their page explicitly opts in.
    robots: privateRobots,
    openGraph: { type: "website", siteName: "Dosso Dossi Coffee", locale: locale === "tr" ? "tr_TR" : "en_GB" },
  };
}

export function publicPageMetadata({ locale, path, title, description, image = "/images/editorial/thermos-quartet-v1.webp" }: {
  locale: Locale; path: string; title: string; description: string; image?: string;
}): Metadata {
  const release = siteRelease();
  const canonical = localizedPath(path, locale);
  const languages = { tr: localizedPath(path, "tr"), en: localizedPath(path, "en"), "x-default": localizedPath(path, "tr") };
  return {
    title: title === "Dosso Dossi Coffee" ? { absolute: title } : title,
    description,
    robots: release.public ? { index: true, follow: true } : privateRobots,
    alternates: { canonical, languages },
    openGraph: { type: "website", siteName: "Dosso Dossi Coffee", title, description, url: canonical, locale: locale === "tr" ? "tr_TR" : "en_GB", alternateLocale: locale === "tr" ? "en_GB" : "tr_TR", images: [{ url: image, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
