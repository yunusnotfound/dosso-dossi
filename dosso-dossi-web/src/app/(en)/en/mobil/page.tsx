import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "en", path: "/mobil",
  title: "Mobile",
  description: "Explore the Dosso Dossi Coffee mobile app. Take a closer look at the app screens, features and the digital world of your coffee break.",
});

export default function EnglishMobilePage() {
  return <WebsitePage locale="en" section="mobile" />;
}
