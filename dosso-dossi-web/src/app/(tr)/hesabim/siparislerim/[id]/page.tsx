import type { Metadata } from "next";
import { OrdersPage } from "@/components/orders/orders-page";

export const metadata: Metadata = {
  title: "Test siparişi",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrdersPage locale="tr" orderId={id} />;
}
