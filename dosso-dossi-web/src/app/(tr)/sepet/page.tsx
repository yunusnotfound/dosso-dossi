import type { Metadata } from "next";
import { CartPage } from "@/components/commerce/cart-page";
export const metadata: Metadata = {
  title: "Sepetim",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <CartPage locale="tr" />;
}
