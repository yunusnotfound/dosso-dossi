import type { MetadataRoute } from "next";
import { localizedPath, publicPagePaths, publishedProductPaths, siteRelease } from "../../config/site-release.mjs";
import { getCatalog } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const release = siteRelease();
  if (!release.public) return [];
  const catalog = await getCatalog();
  if (!catalog.available) console.warn("sitemap: catalog unavailable; returning public static pages only");
  const paths = [...publicPagePaths, ...(catalog.available ? publishedProductPaths(catalog.products) : [])];
  return paths.flatMap((path) => (["tr", "en"] as const).map((locale) => ({
    url: `${release.origin}${localizedPath(path, locale)}`,
    alternates: { languages: { tr: `${release.origin}${localizedPath(path, "tr")}`, en: `${release.origin}${localizedPath(path, "en")}` } },
  })));
}
