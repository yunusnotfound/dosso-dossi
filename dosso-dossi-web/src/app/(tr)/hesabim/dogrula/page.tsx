import type { Metadata } from "next";
import { AccountPage } from "@/components/account/account-page";

export const metadata: Metadata = {
  title: "E-posta doğrulama",
  referrer: "no-referrer",
};

export default function Page() {
  return <AccountPage locale="tr" view="verify" />;
}
