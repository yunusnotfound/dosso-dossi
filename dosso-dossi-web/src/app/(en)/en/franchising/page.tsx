import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "en", path: "/franchising",
  title: "Franchising",
  description: "Imagine your own meeting place with Dosso Dossi Coffee. Contact our team to explore franchising and share your ideas.",
});

export default function EnglishFranchisePage() {
  return <WebsitePage locale="en" section="franchise" />;
}
