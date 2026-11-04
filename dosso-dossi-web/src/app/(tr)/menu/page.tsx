import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "tr", path: "/menu",
  title: "Menümüz",
  description: "Dosso Dossi Coffee menüsünü keşfedin. Sıcak ve soğuk kahveler, ferahlatan içecekler ve tatlılar arasından favorinizi bulun.",
});

export default function MenuPage() {
  return <WebsitePage locale="tr" section="menu" />;
}
