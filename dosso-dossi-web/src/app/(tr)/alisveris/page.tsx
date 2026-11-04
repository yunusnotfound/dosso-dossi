import { publicPageMetadata } from "@/lib/site-seo";
import { SitePage } from "@/components/site-page";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  locale: "tr", path: "/alisveris",
  title: "Online mağaza",
  description: "Dosso Dossi paket kahveleri ve renkli termos koleksiyonu. Yeni online mağazamızı keşfedin.",
});

export default function ShopPage() {
  return <SitePage locale="tr" page="shop" />;
}
