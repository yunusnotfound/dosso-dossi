import type { Metadata } from "next";
import { CartPage } from "@/components/commerce/cart-page";
export const metadata: Metadata = {
  title: "My bag",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <CartPage locale="en" />;
}
