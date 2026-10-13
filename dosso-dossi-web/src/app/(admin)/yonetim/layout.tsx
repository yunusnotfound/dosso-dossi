import type { ReactNode } from "react";
import "../../globals.css";

export const metadata = {
  title: "Web mağazası yönetimi | Dosso Dossi Coffee",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
