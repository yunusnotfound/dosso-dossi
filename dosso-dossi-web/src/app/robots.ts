import type { MetadataRoute } from "next";
import { privatePaths, siteRelease } from "../../config/site-release.mjs";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const release = siteRelease();
  if (!release.public) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: privatePaths }, sitemap: `${release.origin}/sitemap.xml` };
}
