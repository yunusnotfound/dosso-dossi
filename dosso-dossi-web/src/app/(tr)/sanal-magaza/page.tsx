import { publicPageMetadata } from "@/lib/site-seo";
import { VirtualStorePage } from "@/components/store3d/virtual-store-page";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  locale: "tr", path: "/sanal-magaza",
  title: "Sanal mağaza",
  description: "Dosso Dossi sanal mağazasını gezin, kahve ve termos koleksiyonunu keşfedin.",
});

export default function VirtualStore() {
  return <VirtualStorePage locale="tr" />;
}
