import { publicPageMetadata } from "@/lib/site-seo";
import { WebsitePage } from "@/components/website/website-page";

export const metadata = publicPageMetadata({
  locale: "tr", path: "/hikayemiz",
  title: "Hikâyemiz",
  description: "Dosso Dossi Coffee'nin kahve, sanat ve müzikle buluşan dünyasını keşfedin. İyi kahve ve güzel buluşmalar için bir mola verin.",
});

export default function StoryPage() {
  return <WebsitePage locale="tr" section="story" />;
}
