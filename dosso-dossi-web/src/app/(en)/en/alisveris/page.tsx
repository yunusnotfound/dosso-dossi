import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Online store",
  description:
    "Explore Dosso Dossi packaged coffee and our colourful thermos collection in the new online store.",
};

export default function EnglishShopPage() {
  return <SitePage locale="en" page="shop" />;
}
