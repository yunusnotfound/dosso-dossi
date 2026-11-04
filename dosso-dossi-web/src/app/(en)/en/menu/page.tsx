import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "en", path: "/menu",
  title: "Our menu",
  description: "Explore the Dosso Dossi Coffee menu. Find your favourite hot and iced coffees, refreshing drinks and sweet treats.",
});

export default function EnglishMenuPage() {
  return <WebsitePage locale="en" section="menu" />;
}
