import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "tr", path: "/mobil",
  title: "Mobil",
  description: "Dosso Dossi Coffee mobil uygulamasını keşfedin. Kahve molanızın dijital dünyasına, uygulama ekranlarına ve özelliklerine yakından bakın.",
});

export default function MobilePage() {
  return <WebsitePage locale="tr" section="mobile" />;
}
