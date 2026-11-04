"use client";

import Image from "next/image";
import Link from "next/link";
import { pagePath, virtualStorePath, type Locale } from "@/lib/site";
import { accountPath } from "@/lib/customer-account";
import { cartPath } from "@/lib/web-commerce";
import type { StoreInfo } from "./store-info-panel";
import { stations, type StationId } from "./scene-types";
import s from "./store-experience.module.css";

const pinThumbnails = {
  coffee: "/images/store3d/pins/coffee-v1.webp",
  thermos: "/images/store3d/pins/thermos-v1.webp",
  menu: "/images/store3d/pins/menu-v1.webp",
  story: "/images/store3d/pins/story-v1.webp",
  checkout: "/images/store3d/pins/checkout-v1.webp",
  branches: "/images/store3d/pins/branches-v1.webp",
} as const;

type StoreHudProps = {
  locale: Locale;
  station: StationId;
  ready: boolean;
  failed: boolean;
  welcome: boolean;
  catalogOpen: boolean;
  onToggleCatalog: () => void;
  onInfo: (section: StoreInfo) => void;
  onGo: (station: StationId) => void;
  onPin: (id: string) => void;
};

export function StoreHud({
  locale,
  station,
  ready,
  failed,
  welcome,
  catalogOpen,
  onToggleCatalog,
  onInfo,
  onGo,
  onPin,
}: StoreHudProps) {
  const tr = locale === "tr";
  const pinLabels: Record<keyof typeof pinThumbnails, string> = {
    coffee: tr ? "Kahve seçkisi" : "Coffee collection",
    thermos: tr ? "Termos koleksiyonu" : "Thermos collection",
    menu: tr ? "Menüyü keşfet" : "Explore the menu",
    story: tr ? "Kahve ve biz" : "Coffee & us",
    checkout: tr ? "Kasa · Sepetim" : "Checkout · My bag",
    branches: tr ? "Şubelerimiz" : "Our locations",
  };
  return (
    <>
      <header className={s.header}>
        <Link
          href={pagePath(locale, "home")}
          className={s.brand}
          aria-label="Dosso Dossi Coffee"
        >
          <Image
            src="/images/brand/logo.png"
            width={52}
            height={52}
            alt=""
            priority
          />
          <span>
            DOSSO DOSSI
            <small>COFFEE · {tr ? "SANAL MAĞAZA" : "VIRTUAL STORE"}</small>
          </span>
        </Link>
        <nav
          className={s.navigation}
          aria-label={tr ? "Mağaza gezinmesi" : "Store navigation"}
        >
          <button onClick={onToggleCatalog} aria-expanded={catalogOpen}>
            {tr ? "Ürünler" : "Products"}
          </button>
          <button onClick={() => onInfo("menu")}>{tr ? "Menü" : "Menu"}</button>
          <button onClick={() => onInfo("branches")}>
            {tr ? "Şubeler" : "Locations"}
          </button>
          <button onClick={() => onInfo("story")}>
            {tr ? "Hikâyemiz" : "Our story"}
          </button>
          <button onClick={() => onInfo("mobile")}>
            {tr ? "MOBİL" : "MOBILE"}
          </button>
        </nav>
        <div className={s.headerActions}>
          <Link
            className={s.account}
            href={accountPath(locale)}
            aria-label={tr ? "Hesabım" : "My account"}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>
          </Link>
          <Link
            href={cartPath(locale)}
            className={s.bag}
            aria-label={tr ? "Sepetim" : "My bag"}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14l1 14H4L5 7Z" />
              <path d="M8 8V6a4 4 0 0 1 8 0v2" />
            </svg>
            <span>{tr ? "Sepetim" : "My bag"}</span>
          </Link>
          <Link
            className={s.language}
            href={virtualStorePath(tr ? "en" : "tr")}
            lang={tr ? "en" : "tr"}
          >
            {tr ? "EN" : "TR"}
          </Link>
        </div>
      </header>
      {!ready && !failed && (
        <div className={s.loading} role="status">
          <span className={s.loader} />
          <p>{tr ? "Kapımız açılıyor." : "Opening our doors."}</p>
          <small>
            {tr
              ? "Dosso Dossi dünyası hazırlanıyor"
              : "Preparing your Dosso Dossi experience"}
          </small>
        </div>
      )}
      {failed && (
        <div className={s.fallback}>
          <Image
            src="/images/store3d/venice-window.webp"
            alt=""
            fill
            sizes="100vw"
          />
          <div>
            <h1>
              {tr
                ? "Her zaman bir kahveye bekleriz."
                : "There’s always time for coffee."}
            </h1>
            <p>
              {tr
                ? "Bu cihazda 3D görünüm açılamadı. Tüm ürünlerimizi klasik mağazada inceleyebilirsiniz."
                : "The 3D view is unavailable on this device. Explore every product in the classic store."}
            </p>
            <Link href={pagePath(locale, "shop")}>
              {tr ? "Mağazaya git" : "Visit the store"} ↗
            </Link>
          </div>
        </div>
      )}
      {ready &&
        !welcome &&
        Object.entries(pinLabels).map(([id, label]) => (
          <button
            key={id}
            className={s.pin}
            data-scene-pin={id}
            onClick={() => onPin(id)}
            aria-label={label}
          >
            <span
              className={`${s.pinThumbnail}${id === "story" ? ` ${s.pinThumbnailLogo}` : ""}`}
              aria-hidden="true"
            >
              <Image
                src={pinThumbnails[id as keyof typeof pinThumbnails]}
                width={36}
                height={36}
                sizes="36px"
                alt=""
              />
            </span>
            <b>{label}</b>
          </button>
        ))}
      {ready && welcome && (
        <div className={s.welcome}>
          <p className={s.eyebrow}>
            {tr
              ? "İYİ KAHVE. YENİ BİR DENEYİM."
              : "GOOD COFFEE. A NEW PERSPECTIVE."}
          </p>
          <h1>
            {tr ? (
              <>
                Bir adım
                <br />
                içeri.
              </>
            ) : (
              <>
                Step
                <br />
                inside.
              </>
            )}
          </h1>
          <p>
            {tr
              ? "Gez. Keşfet. Kendine bir şey seç."
              : "Wander. Discover. Find your favourite."}
          </p>
          <button onClick={() => onGo("counter")}>
            {tr ? "Mağazayı gez" : "Explore the store"} <span>↗</span>
          </button>
        </div>
      )}
      {ready && (
        <>
          <nav
            className={s.stations}
            aria-label={tr ? "Mağaza bölümleri" : "Store areas"}
          >
            {stations.slice(0, 4).map((point, i) => (
              <button
                key={point.id}
                aria-pressed={station === point.id}
                onClick={() => onGo(point.id)}
              >
                <small>0{i + 1}</small>
                {point.label[locale]}
              </button>
            ))}
          </nav>
        </>
      )}
      <Link className={s.classic} href={pagePath(locale, "home")}>
        {tr ? "Kurumsal siteye dön" : "Back to website"} ↗
      </Link>
    </>
  );
}
