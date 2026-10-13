import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  description:
    "Dosso Dossi Coffee. Kahve, sohbet ve birlikte paylaştığımız anlar.",
};

export default function HomePage() {
  return <SitePage locale="tr" page="home" />;
}
