import { publicPageMetadata } from "@/lib/site-seo";
import { SitePage } from "@/components/site-page";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  locale: "tr", path: "/",
  title: "Dosso Dossi Coffee",
  description: "Dosso Dossi Coffee. Kahve, sohbet ve birlikte paylaştığımız anlar.",
});

export default function HomePage() {
  return <SitePage locale="tr" page="home" />;
}
