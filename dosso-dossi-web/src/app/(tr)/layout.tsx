import type { ReactNode } from "react";
import "../globals.css";

export { previewMetadata as metadata } from "@/lib/site";

export default function TurkishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
