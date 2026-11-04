import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "en", path: "/subeler",
  title: "Our locations",
  description: "Find your nearest Dosso Dossi Coffee. Browse our locations by city, view store addresses and get directions.",
});

export default function EnglishBranchesPage() {
  return <WebsitePage locale="en" section="branches" />;
}
