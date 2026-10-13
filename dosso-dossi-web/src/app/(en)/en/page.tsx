import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  description: "Dosso Dossi Coffee. Coffee, conversation and moments shared.",
};

export default function EnglishHomePage() {
  return <SitePage locale="en" page="home" />;
}
