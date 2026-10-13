"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { pagePath, type Locale, type PageKind } from "@/lib/site";
import { accountPath, type AccountView } from "@/lib/customer-account";
import s from "./site-chrome.module.css";

const content = {
  tr: {
    announcement: "HER FİNCANDA BİR BULUŞMA.",
    story: "Kahve ve biz",
    branches: "Şubelerimiz",
    menu: "Menümüz",
    franchise: "Franchising",
    shop: "Online mağaza",
    home: "Kurumsal site",
    search: "Kahve, termos ve daha fazlası…",
    searchLabel: "Ürün ara",
    basket: "Sepet",
    account: "Hesabım",
    nav: "Ana gezinme",
    close: "Kapat",
    menuLabel: "Menüyü aç",
    tagline: "İyi kahve.\nGüzel bir buluşma.",
    corporate: "DOSSO DOSSI",
    collection: "KOLEKSİYON",
    contact: "İLETİŞİM",
    coffees: "Paket kahveler",
    thermoses: "Termoslar",
    all: "Tüm ürünler",
    copyright: "Tüm hakları saklıdır.",
    policies: [
      "Mesafeli satış sözleşmesi",
      "Gizlilik ilkeleri",
      "Çerez politikası",
      "İade koşulları",
    ],
    legalTitle: "Yeni mağazamız için hazırlanıyor.",
    legal:
      "Yasal metinlerimiz yeni web mağazasına uygun olarak güncelleniyor. Onaylanan metinler satış başlamadan önce bu alanda yayınlanacaktır. Bu önizlemede yalnız test siparişleri oluşturulur; gerçek satış yapılmaz.",
    follow: "Bizi takip edin",
  },
  en: {
    announcement: "A LITTLE COFFEE. A LOT TO SHARE.",
    story: "Coffee & us",
    branches: "Our locations",
    menu: "Our menu",
    franchise: "Franchising",
    shop: "Online store",
    home: "Our website",
    search: "Coffee, thermoses and more…",
    searchLabel: "Search products",
    basket: "Bag",
    account: "My account",
    nav: "Main navigation",
    close: "Close",
    menuLabel: "Open menu",
    tagline: "Good coffee.\nGreat company.",
    corporate: "DOSSO DOSSI",
    collection: "COLLECTION",
    contact: "GET IN TOUCH",
    coffees: "Packaged coffee",
    thermoses: "Thermoses",
    all: "All products",
    copyright: "All rights reserved.",
    policies: [
      "Distance sales agreement",
      "Privacy policy",
      "Cookie policy",
      "Returns policy",
    ],
    legalTitle: "A fresh start for our new store.",
    legal:
      "Our legal documents are being updated for the new online store. Approved terms will be published here before sales begin. This preview creates test orders only; no real sales take place.",
    follow: "Follow us",
  },
};

function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M5 19 19 5M5 5h14v14" />
    </svg>
  );
}
function Brand({ href, label }: { href: string; label: string }) {
  return (
    <Link className={s.brand} href={href} aria-label={label}>
      <Image
        src="/images/brand/logo.png"
        alt=""
        width={68}
        height={68}
        priority
      />
      <span>
        DOSSO DOSSI<small>COFFEE</small>
      </span>
    </Link>
  );
}

export function SiteHeader({
  locale,
  page,
  brand,
  accountView,
  commerceView,
  orderId,
  onAccountLocaleChange,
}: {
  locale: Locale;
  page: PageKind;
  brand: string;
  accountView?: AccountView;
  commerceView?: "cart" | "addresses" | "orders";
  orderId?: string;
  onAccountLocaleChange?: (locale: Locale) => void;
}) {
  const t = content[locale];
  const router = useRouter();
  const home = pagePath(locale, "home"),
    shop = pagePath(locale, "shop");
  const cart = `${locale === "en" ? "/en" : ""}/sepet`;
  const languagePath = (language: Locale) =>
    commerceView
      ? `${language === "en" ? "/en" : ""}/${commerceView === "cart" ? "sepet" : commerceView === "orders" ? `hesabim/siparislerim${orderId ? `/${encodeURIComponent(orderId)}` : ""}` : "hesabim/adreslerim"}`
      : accountView
        ? accountPath(language, accountView)
        : pagePath(language, page);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const links = [
    ["hikayemiz", t.story],
    ["subeler", t.branches],
    ["menu", t.menu],
    ["franchising", t.franchise],
  ];
  const languages = (
    <nav
      className={s.languages}
      aria-label={locale === "tr" ? "Dil seçimi" : "Select language"}
    >
      <Link
        href={languagePath("tr")}
        onNavigate={
          onAccountLocaleChange
            ? (event) => {
                event.preventDefault();
                onAccountLocaleChange("tr");
              }
            : undefined
        }
        hrefLang="tr"
        lang="tr"
        aria-label="Türkçe"
        aria-current={locale === "tr" ? "page" : undefined}
      >
        TR
      </Link>
      <span>/</span>
      <Link
        href={languagePath("en")}
        onNavigate={
          onAccountLocaleChange
            ? (event) => {
                event.preventDefault();
                onAccountLocaleChange("en");
              }
            : undefined
        }
        hrefLang="en"
        lang="en"
        aria-label="English"
        aria-current={locale === "en" ? "page" : undefined}
      >
        EN
      </Link>
    </nav>
  );
  return (
    <>
      <div className={s.announcement}>{t.announcement}</div>
      <header className={s.header}>
        <div className={s.headerInner}>
          <button
            className={s.menuButton}
            onClick={() => setOpen(true)}
            aria-label={t.menuLabel}
            aria-expanded={open}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M3 7h18M3 12h18M3 17h12" />
            </svg>
          </button>
          <Brand href={home} label={brand} />
          {page === "home" ? (
            <nav className={s.mainNav} aria-label={t.nav}>
              {links.map(([id, title]) => (
                <Link href={`${home}#${id}`} key={id}>
                  {title}
                </Link>
              ))}
            </nav>
          ) : (
            <form
              action={shop}
              className={s.search}
              onSubmit={(event) => {
                event.preventDefault();
                const term = String(
                  new FormData(event.currentTarget).get("q") ?? "",
                ).trim();
                router.push(
                  `${shop}${term ? `?q=${encodeURIComponent(term)}` : ""}#katalog`,
                );
              }}
            >
              <input
                type="search"
                name="q"
                aria-label={t.searchLabel}
                placeholder={t.search}
                maxLength={100}
              />
              <button type="submit" aria-label={t.searchLabel}>
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 5 5" />
                </svg>
              </button>
            </form>
          )}
          <div className={s.headerActions}>
            {page === "home" ? (
              <Link className={s.shopButton} href={shop}>
                {t.shop}
                <Arrow />
              </Link>
            ) : (
              <>
                <Link className={s.corporateLink} href={home}>
                  {t.home}
                  <Arrow />
                </Link>
                <a className={s.cartLink} href={cart} aria-label={t.basket}>
                  <svg
                    width="22"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    aria-hidden="true"
                  >
                    <path d="M5 8h14l1 13H4L5 8Z" />
                    <path d="M8 9V6a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span>{t.basket}</span>
                </a>
              </>
            )}
            <Link
              className={s.accountLink}
              href={accountPath(locale)}
              aria-label={t.account}
              aria-current={
                accountView ||
                commerceView === "addresses" ||
                commerceView === "orders"
                  ? "page"
                  : undefined
              }
            >
              <svg
                width="22"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <circle cx="12" cy="7" r="3.5" />
                <path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" />
              </svg>
              <span>{t.account}</span>
            </Link>
            {languages}
          </div>
        </div>
      </header>
      <dialog
        ref={dialog}
        className={s.mobileDialog}
        aria-label={t.nav}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className={s.mobileTop}>
          <Brand href={home} label={brand} />
          <button onClick={() => setOpen(false)} aria-label={t.close}>
            ×
          </button>
        </div>
        <nav aria-label={t.nav}>
          {links.map(([id, title]) => (
            <Link
              href={`${home}#${id}`}
              key={id}
              onClick={() => setOpen(false)}
            >
              {title}
              <Arrow />
            </Link>
          ))}
          <Link href={shop} onClick={() => setOpen(false)}>
            {t.shop}
            <Arrow />
          </Link>
          <Link href={accountPath(locale)} onClick={() => setOpen(false)}>
            {t.account}
            <Arrow />
          </Link>
          <Link href={cart} onClick={() => setOpen(false)}>
            {t.basket}
            <Arrow />
          </Link>
        </nav>
        {languages}
      </dialog>
    </>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = content[locale],
    home = pagePath(locale, "home"),
    shop = pagePath(locale, "shop");
  const [policy, setPolicy] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (policy !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [policy]);
  return (
    <footer className={s.footer} id="iletisim">
      <div className={s.footerMain}>
        <div className={s.footerBrand}>
          <Brand href={home} label="Dosso Dossi Coffee" />
          <p>{t.tagline}</p>
          <div className={s.social} aria-label={t.follow}>
            <a
              href="https://www.instagram.com/dossodossicoffee/"
              target="_blank"
              rel="noreferrer"
            >
              Instagram ↗
            </a>
            <a
              href="https://www.facebook.com/dossodossicoffee/"
              target="_blank"
              rel="noreferrer"
            >
              Facebook ↗
            </a>
          </div>
        </div>
        <div className={s.footerColumn}>
          <h2>{t.corporate}</h2>
          <Link href={`${home}#hikayemiz`}>{t.story}</Link>
          <Link href={`${home}#subeler`}>{t.branches}</Link>
          <Link href={`${home}#menu`}>{t.menu}</Link>
          <Link href={`${home}#franchising`}>{t.franchise}</Link>
        </div>
        <div className={s.footerColumn}>
          <h2>{t.collection}</h2>
          <Link href={`${shop}?category=coffee`}>{t.coffees}</Link>
          <Link href={`${shop}?category=thermos`}>{t.thermoses}</Link>
          <Link href={shop}>{t.all}</Link>
          <Link href={accountPath(locale)}>{t.account}</Link>
        </div>
        <div className={s.footerColumn}>
          <h2>{t.contact}</h2>
          <a className={s.phone} href="tel:+902122422121">
            +90 (212) 242 21 21
          </a>
          <p>
            {locale === "tr"
              ? "Bir kahveyle başlayan güzel sohbetlere."
              : "Good conversations start with a cup of coffee."}
          </p>
          <Link className={s.footerLocation} href={`${home}#subeler`}>
            {t.branches}
            <Arrow />
          </Link>
        </div>
      </div>
      <div className={s.footerBottom}>
        <span>
          © {new Date().getFullYear()} Dosso Dossi Coffee. {t.copyright}
        </span>
        <div>
          {t.policies.map((item, index) => (
            <button key={item} onClick={() => setPolicy(index)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <dialog
        ref={dialog}
        className={s.policyDialog}
        onCancel={() => setPolicy(null)}
        onClose={() => setPolicy(null)}
        aria-labelledby="policy-title"
      >
        <button
          className={s.closeDialog}
          onClick={() => setPolicy(null)}
          aria-label={t.close}
        >
          ×
        </button>
        <p className={s.policyLabel}>
          {policy !== null ? t.policies[policy] : ""}
        </p>
        <h2 id="policy-title">{t.legalTitle}</h2>
        <p>{t.legal}</p>
        <button className={s.policyDone} onClick={() => setPolicy(null)}>
          {t.close}
        </button>
      </dialog>
    </footer>
  );
}
