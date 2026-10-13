import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import type { Locale } from "@/lib/site";
import { CartContent } from "./cart-content";

export function CartPage({ locale }: { locale: Locale }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        {locale === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <SiteHeader
        locale={locale}
        page="shop"
        brand="Dosso Dossi Coffee"
        commerceView="cart"
      />
      <main id="main-content">
        <CartContent locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
