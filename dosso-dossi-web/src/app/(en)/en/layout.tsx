import type { ReactNode } from "react";
import "../../globals.css";

export { previewMetadata as metadata } from "@/lib/site";

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
