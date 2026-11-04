import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "tr", path: "/subeler",
  title: "Şubelerimiz",
  description: "Size en yakın Dosso Dossi Coffee şubesini bulun. Şehirleri keşfedin, şube adreslerini inceleyin ve yol tarifi alın.",
});

export default function BranchesPage() {
  return <WebsitePage locale="tr" section="branches" />;
}
