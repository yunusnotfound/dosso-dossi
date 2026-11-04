import type { NextConfig } from "next";
import { localizedPath, privatePaths, publicPagePaths, securityHeaders, siteRelease } from "./config/site-release.mjs";

const release = siteRelease();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  experimental: { agentUpgrade: "security" },
  turbopack: { root: __dirname },
  async redirects() {
    return [
      { source: "/franchise-basvuru", destination: "/franchising#franchise-form", permanent: true },
      { source: "/ceo-dan-mesaj", destination: "/hikayemiz#vizyon", permanent: true },
      { source: "/en/franchise-basvuru", destination: "/en/franchising#franchise-form", permanent: true },
      { source: "/en/ceo-dan-mesaj", destination: "/en/hikayemiz#vizyon", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          ...securityHeaders(process.env.NODE_ENV === "development"),
        ],
      },
      ...(release.public ? [...publicPagePaths, "/urun/:slug"].flatMap((path) => ["tr", "en"].map((locale) => ({
        source: localizedPath(path, locale as "tr" | "en"),
        headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
      }))) : []),
      ...privatePaths.map((path) => ({
        source: `${path}/:path*`,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      })),
    ];
  },
};

export default nextConfig;
