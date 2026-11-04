import type { ReactNode } from "react";
import "../globals.css";

import { siteMetadata } from "@/lib/site-seo";
export const metadata = siteMetadata("tr");

export default function TurkishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
