import { publicPageMetadata } from "@/lib/site-seo";
import { SitePage } from "@/components/site-page";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  locale: "en", path: "/",
  title: "Dosso Dossi Coffee",
  description: "Dosso Dossi Coffee. Coffee, conversation and moments shared.",
});

export default function EnglishHomePage() {
  return <SitePage locale="en" page="home" />;
}
