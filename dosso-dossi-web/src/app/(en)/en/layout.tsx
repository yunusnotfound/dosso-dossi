import type { ReactNode } from "react";
import "../../globals.css";

import { siteMetadata } from "@/lib/site-seo";
export const metadata = siteMetadata("en");

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
