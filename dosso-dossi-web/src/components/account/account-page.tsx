"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site";
import { accountPath, type AccountView } from "@/lib/customer-account";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AccountContent } from "./account-content";

export function AccountPage({
  locale: initialLocale,
  view = "account",
}: {
  locale: Locale;
  view?: AccountView;
}) {
  const [locale, setLocale] = useState(initialLocale);
  function changeLocale(next: Locale) {
    setLocale(next);
    const mode = new URLSearchParams(window.location.search).get("islem");
    const search =
      view === "account" && (mode === "sifre" || mode === "dogrulama")
        ? `?islem=${mode}`
        : "";
    window.history.replaceState(
      window.history.state,
      "",
      accountPath(next, view) + search,
    );
    document.documentElement.lang = next;
    document.title = `${next === "tr" ? "Hesabım" : "My account"} | Dosso Dossi Coffee`;
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
        accountView={view}
        onAccountLocaleChange={changeLocale}
      />
      <main id="main-content">
        <AccountContent locale={locale} view={view} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
