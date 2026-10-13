import type { Metadata } from "next";
import { AccountPage } from "@/components/account/account-page";

export const metadata: Metadata = {
  title: "Reset password",
  referrer: "no-referrer",
};

export default function Page() {
  return <AccountPage locale="en" view="reset" />;
}
