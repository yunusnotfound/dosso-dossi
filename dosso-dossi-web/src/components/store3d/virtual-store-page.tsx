import { SiteFooter } from "@/components/site-chrome";
import { getCatalog } from "@/lib/backend";
import type { Locale } from "@/lib/site";
import { StoreExperience } from "./store-experience";

export async function VirtualStorePage({ locale }: { locale: Locale }) {
  const catalog = await getCatalog();

  return (
    <>
      <a className="skip-link" href="#main-content">
        {locale === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <main id="main-content">
        <StoreExperience locale={locale} catalog={catalog} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
