import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "tr", path: "/franchising",
  title: "Franchising",
  description: "Dosso Dossi Coffee ile kendi buluşma noktanızı hayal edin. Franchising hakkında bilgi almak ve fikrinizi paylaşmak için ekibimizle iletişime geçin.",
});

export default function FranchisePage() {
  return <WebsitePage locale="tr" section="franchise" />;
}
