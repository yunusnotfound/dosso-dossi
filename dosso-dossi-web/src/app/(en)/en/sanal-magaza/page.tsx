import { publicPageMetadata } from "@/lib/site-seo";
import { VirtualStorePage } from "@/components/store3d/virtual-store-page";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  locale: "en", path: "/sanal-magaza",
  title: "Virtual store",
  description: "Explore the Dosso Dossi virtual store and discover our coffee and thermos collections.",
});

export default function VirtualStore() {
  return <VirtualStorePage locale="en" />;
}
