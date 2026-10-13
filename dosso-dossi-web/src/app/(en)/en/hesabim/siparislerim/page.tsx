import type { Metadata } from "next";
import { OrdersPage } from "@/components/orders/orders-page";

export const metadata: Metadata = {
  title: "My orders",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <OrdersPage locale="en" />;
}
