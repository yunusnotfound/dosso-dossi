import type { Metadata } from "next";
import { AddressPage } from "@/components/account/address-page";

export const metadata: Metadata = {
  title: "Teslimat adreslerim",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AddressPage locale="tr" />;
}
