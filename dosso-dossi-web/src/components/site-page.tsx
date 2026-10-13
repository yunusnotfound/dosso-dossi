import { getCatalog, getStoreConfig } from "@/lib/backend";
import type { Locale, PageKind } from "@/lib/site";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { HomeContent } from "@/components/home/home-content";
import { ShopContent } from "@/components/shop/shop-content";

export async function SitePage({
  locale,
  page,
}: {
  locale: Locale;
  page: PageKind;
}) {
  const [store, catalog] = await Promise.all([getStoreConfig(), getCatalog()]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        {locale === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <SiteHeader
        locale={locale}
        page={page}
        brand={store?.name ?? "Dosso Dossi Coffee"}
      />
      <main id="main-content">
        {page === "home" ? (
          <HomeContent locale={locale} catalog={catalog} />
        ) : (
          <ShopContent locale={locale} catalog={catalog} />
        )}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
