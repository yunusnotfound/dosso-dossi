import type { Metadata } from "next";
import { AccountPage } from "@/components/account/account-page";

export const metadata: Metadata = {
  title: "Verify email",
  referrer: "no-referrer",
};

export default function Page() {
  return <AccountPage locale="en" view="verify" />;
}
