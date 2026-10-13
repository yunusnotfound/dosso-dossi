import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import type { Locale } from "@/lib/site";
import { OrdersContent } from "./orders-content";

export function OrdersPage({
  locale,
  orderId,
}: {
  locale: Locale;
  orderId?: string;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        {locale === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <SiteHeader
        locale={locale}
        page="shop"
        brand="Dosso Dossi Coffee"
        commerceView="orders"
        orderId={orderId}
      />
      <main id="main-content">
        <OrdersContent locale={locale} orderId={orderId} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
