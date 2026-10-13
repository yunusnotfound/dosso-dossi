import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Online mağaza",
  description:
    "Dosso Dossi paket kahveleri ve renkli termos koleksiyonu. Yeni online mağazamızı keşfedin.",
};

export default function ShopPage() {
  return <SitePage locale="tr" page="shop" />;
}
