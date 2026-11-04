import { Suspense } from "react";
import { HomeCollection } from "@/components/home/home-collection";
import { getCatalog } from "@/lib/backend";
import type { Locale, PageKind } from "@/lib/site";
import { SiteFooter } from "@/components/site-chrome";
import { WebsiteHeader } from "@/components/website/website-header";
import { HomeContent } from "@/components/home/home-content";
import { ShopContent } from "@/components/shop/shop-content";

export async function SitePage({
  locale,
  page,
}: {
  locale: Locale;
  page: PageKind;
}) {
  const catalog = page === "shop" ? await getCatalog() : null;
  return (
    <>
      <a className="skip-link" href="#main-content">
        {locale === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <WebsiteHeader locale={locale} active={page} />
      <main id="main-content">
        {page === "home" ? (
          <HomeContent locale={locale} collection={<Suspense fallback={<div className="collection-loading" role="status">{locale === "tr" ? "Koleksiyon yükleniyor…" : "Loading the collection…"}</div>}><CollectionSection locale={locale} /></Suspense>} />
        ) : (
          <ShopContent locale={locale} catalog={catalog!} />
        )}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

async function CollectionSection({ locale }: { locale: Locale }) {
  const catalog = await getCatalog();
  return <HomeCollection locale={locale} catalog={catalog} />;
}
