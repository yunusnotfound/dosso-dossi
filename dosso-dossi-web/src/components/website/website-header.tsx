"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { pagePath, type Locale } from "@/lib/site";
import s from "./website-header.module.css";

export type WebsiteSection = "shop" | "menu" | "story" | "mobile" | "branches" | "franchise";
const segments: Record<WebsiteSection, string> = { shop: "alisveris", menu: "menu", story: "hikayemiz", mobile: "mobil", branches: "subeler", franchise: "franchising" };
export function websitePath(locale: Locale, section: WebsiteSection | "home") { return section === "home" ? pagePath(locale, "home") : `${locale === "en" ? "/en" : ""}/${segments[section]}`; }
const copy = {
  tr: { tagline: "İYİ KAHVE. GÜZEL BİR BULUŞMA.", home: "Ana sayfa", navigation: "Ana gezinme", languages: "Dil seçimi", account: "Hesabım", cart: "Sepetim", shop: "Mağaza", menu: "Şube menüsü", story: "Hikâyemiz", mobile: "Mobil", branches: "Şubeler", franchise: "Franchising", open: "Menüyü aç", close: "Kapat", search: "Ürün ara", placeholder: "Kahve veya termos ara", searchHint: "Online mağazada paket kahveleri ve termosları keşfet.", coffees: "Paket kahveler", thermoses: "Termos koleksiyonu" },
  en: { tagline: "GOOD COFFEE. GREAT COMPANY.", home: "Home", navigation: "Main navigation", languages: "Select language", account: "My account", cart: "Shopping bag", shop: "Shop", menu: "Café menu", story: "Our story", mobile: "Mobile", branches: "Locations", franchise: "Franchising", open: "Open menu", close: "Close", search: "Search products", placeholder: "Search coffee or thermoses", searchHint: "Discover packaged coffees and thermoses in our online store.", coffees: "Packaged coffees", thermoses: "Thermos collection" },
};
function Icon({ type }: { type: "search" | "account" | "cart" }) { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{type === "search" ? <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></> : type === "account" ? <><circle cx="12" cy="7.5" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></> : <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></>}</svg>; }

export function WebsiteHeader({ locale, active, languagePaths, onLocaleChange, accountActive, cartActive }: {
  locale: Locale; active: WebsiteSection | "home"; languagePaths?: Record<Locale, string>; onLocaleChange?: (locale: Locale) => void; accountActive?: boolean; cartActive?: boolean;
}) {
  const t = copy[locale], prefix = locale === "en" ? "/en" : "", router = useRouter();
  const [panel, setPanel] = useState<"menu" | "search" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (panel) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close(); }, [panel]);
  const sections: WebsiteSection[] = ["shop", "menu", "story", "mobile", "branches", "franchise"];
  function close() { setPanel(null); opener.current?.focus(); }
  function brand() { return <Link href={prefix || "/"} className={s.brand} aria-label={`Dosso Dossi Coffee — ${t.home}`} onClick={() => setPanel(null)}><Image src="/images/brand/logo.png" alt="" width={52} height={52} priority/><span>DOSSO DOSSI<small>COFFEE</small></span></Link>; }
  const languages = <nav className={s.languages} aria-label={t.languages}>{(["tr", "en"] as const).map(language => <Link key={language} href={languagePaths?.[language] ?? websitePath(language, active)} hrefLang={language} lang={language} aria-label={language === "tr" ? "Türkçe" : "English"} aria-current={locale === language ? "page" : undefined} onNavigate={event => {
    if (onLocaleChange) { event.preventDefault(); onLocaleChange(language); return; }
    if (languagePaths?.[language]?.includes("/urun/")) { event.preventDefault(); const current = new URLSearchParams(window.location.search), next = new URLSearchParams(); for (const key of ["variant", "grind", "quantity"]) if (current.has(key)) next.set(key, current.get(key)!); router.push(`${languagePaths[language]}${next.size ? `?${next}` : ""}`); }
  }}>{language.toUpperCase()}</Link>)}</nav>;
  return <>
    <div className={s.topStrip}><div className={s.topInner}><p>{t.tagline}</p>{languages}</div></div>
    <header className={s.header}><div className={s.inner}>
      <button className={s.menuToggle} aria-label={t.open} aria-expanded={panel === "menu"} onClick={e => { opener.current = e.currentTarget; setPanel("menu"); }}><span/><span/></button>
      {brand()}
      <nav className={s.navigation} aria-label={t.navigation}>{sections.map(section => <Link key={section} href={websitePath(locale, section)} aria-current={active === section && !accountActive && !cartActive ? "page" : undefined}>{t[section]}</Link>)}</nav>
      <div className={s.actions}><button aria-label={t.search} title={t.search} onClick={e => { opener.current = e.currentTarget; setPanel("search"); }}><Icon type="search"/></button><Link href={`${prefix}/hesabim`} aria-label={t.account} title={t.account} aria-current={accountActive ? "page" : undefined}><Icon type="account"/></Link><Link href={`${prefix}/sepet`} aria-label={t.cart} title={t.cart} aria-current={cartActive ? "page" : undefined}><Icon type="cart"/></Link></div>
    </div></header>
    <dialog ref={dialog} className={`${s.dialog} ${panel === "menu" ? s.menuDialog : s.searchDialog}`} aria-label={panel === "menu" ? t.navigation : t.search} onCancel={close} onClose={close}>
      <div className={s.dialogTop}>{brand()}<button onClick={close} aria-label={t.close}>×</button></div>
      {panel === "menu" ? <><nav className={s.mobileNavigation} aria-label={t.navigation}>{sections.map((section,index) => <Link key={section} href={websitePath(locale, section)} onClick={close} aria-current={active === section ? "page" : undefined}><small>0{index + 1}</small>{t[section]}<span>↗</span></Link>)}</nav><div className={s.mobileActions}><Link href={`${prefix}/hesabim`} onClick={close}>{t.account}</Link><Link href={`${prefix}/sepet`} onClick={close}>{t.cart}</Link></div></> : <div className={s.searchBody}><p>{t.searchHint}</p><form role="search" onSubmit={e => { e.preventDefault(); const query = String(new FormData(e.currentTarget).get("q") ?? "").trim().slice(0,100); close(); router.push(`${pagePath(locale,"shop")}${query ? `?q=${encodeURIComponent(query)}` : ""}`); }}><label htmlFor="site-product-query">{t.search}</label><div><input id="site-product-query" name="q" type="search" maxLength={100} placeholder={t.placeholder}/><button type="submit" aria-label={t.search}>→</button></div></form><div className={s.quickLinks}><Link href={`${pagePath(locale,"shop")}?category=coffee`} onClick={close}>{t.coffees} ↗</Link><Link href={`${pagePath(locale,"shop")}?category=thermos`} onClick={close}>{t.thermoses} ↗</Link></div></div>}
    </dialog>
  </>;
}
