"use client";

import Image from "next/image";
import Link from "next/link";
import { WebsiteHeader } from "./website/website-header";
import { pagePath, type Locale, type PageKind } from "@/lib/site";
import { accountPath, type AccountView } from "@/lib/customer-account";
import s from "./site-chrome.module.css";

const content = {
  tr: {
    announcement: "HER FİNCANDA BİR BULUŞMA.",
    story: "Kahve ve biz",
    mobile: "MOBİL",
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
      "Satış bilgileri",
      "Gizlilik ve veri kullanımı",
      "Çerezler",
      "İade süreci",
    ],
    legalTitle: "Yeni mağazamız için hazırlanıyor.",
    legal:
      "Yasal metinlerimiz yeni web mağazasına uygun olarak güncelleniyor. Onaylanan metinler satış başlamadan önce bu alanda yayınlanacaktır. Bu önizlemede yalnız test siparişleri oluşturulur; gerçek satış yapılmaz.",
    follow: "Bizi takip edin",
  },
  en: {
    announcement: "A LITTLE COFFEE. A LOT TO SHARE.",
    story: "Coffee & us",
    mobile: "MOBILE",
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
      "Sales information",
      "Privacy and data use",
      "Cookies",
      "Returns process",
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
  const languagePath = (language: Locale) => commerceView
    ? `${language === "en" ? "/en" : ""}/${commerceView === "cart" ? "sepet" : commerceView === "orders" ? `hesabim/siparislerim${orderId ? `/${encodeURIComponent(orderId)}` : ""}` : "hesabim/adreslerim"}`
    : accountView ? accountPath(language, accountView) : pagePath(language, page);
  void brand;
  return <WebsiteHeader locale={locale} active={page} languagePaths={{ tr: languagePath("tr"), en: languagePath("en") }} onLocaleChange={onAccountLocaleChange} accountActive={Boolean(accountView || commerceView === "addresses" || commerceView === "orders")} cartActive={commerceView === "cart"} />;
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = content[locale],
    home = pagePath(locale, "home"),
    shop = pagePath(locale, "shop");
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
          <Link href={`${locale === "en" ? "/en" : ""}/hikayemiz`}>{t.story}</Link>
          <Link href={`${locale === "en" ? "/en" : ""}/mobil`}>{t.mobile}</Link>
          <Link href={`${locale === "en" ? "/en" : ""}/subeler`}>{t.branches}</Link>
          <Link href={`${locale === "en" ? "/en" : ""}/menu`}>{t.menu}</Link>
          <Link href={`${locale === "en" ? "/en" : ""}/franchising`}>{t.franchise}</Link>
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
          <Link className={s.footerLocation} href={`${locale === "en" ? "/en" : ""}/subeler`}>
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
            <Link key={item} href={`${locale === "en" ? "/en" : ""}/bilgilendirme/${["mesafeli-satis", "gizlilik", "cerezler", "iade"][index]}`}>{item}</Link>
          ))}
        </div>
      </div>

    </footer>
  );
}
