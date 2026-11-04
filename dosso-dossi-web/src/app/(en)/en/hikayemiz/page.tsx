import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "en", path: "/hikayemiz",
  title: "Our story",
  description: "Discover the Dosso Dossi Coffee world of coffee, art and music. Take a moment for good coffee and great company.",
});

export default function EnglishStoryPage() {
  return <WebsitePage locale="en" section="story" />;
}
