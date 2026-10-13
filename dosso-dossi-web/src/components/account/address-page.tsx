"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site";
import { addressesPath } from "@/lib/web-commerce";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AddressContent } from "./address-content";

export function AddressPage({ locale: initialLocale }: { locale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  function changeLocale(next: Locale) {
    setLocale(next);
    window.history.replaceState(window.history.state, "", addressesPath(next));
    document.documentElement.lang = next;
    document.title = `${next === "tr" ? "Teslimat adreslerim" : "Delivery addresses"} | Dosso Dossi Coffee`;
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        {locale === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <SiteHeader
        locale={locale}
        page="shop"
        brand="Dosso Dossi Coffee"
        commerceView="addresses"
        onAccountLocaleChange={changeLocale}
      />
      <main id="main-content">
        <AddressContent locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
