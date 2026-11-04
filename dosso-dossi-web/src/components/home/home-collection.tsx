"use client";
import Image from "next/image";
import Link from "next/link";
import { catalogItems, variantLabel, type CatalogResult } from "@/lib/catalog";
import { pagePath, type Locale } from "@/lib/site";
import s from "./home-content.module.css";
const copy = {
tr: { collectionLabel: "DOSSO DOSSI, SENİNLE", collectionTitle: "KAHVE MOLANI YANINA AL.", collectionText: "Paket kahveler ve termoslar. Evde, yolda ve günün tam ortasında seninle.", all: "Tüm ürünleri keşfet", inspect: "Ürünü keşfet", packaged: "PAKET KAHVE", thermos: "TERMOS KOLEKSİYONU", collectionNote: "Online mağazamızın önizlemesini keşfedin. Henüz sipariş alınmamaktadır." },
en: { collectionLabel: "TAKE DOSSO DOSSI WITH YOU", collectionTitle: "YOUR COFFEE BREAK, TO GO.", collectionText: "Packaged coffees and thermoses. At home, on the move, in the middle of your day.", all: "Explore all products", inspect: "Explore product", packaged: "PACKAGED COFFEE", thermos: "THERMOS COLLECTION", collectionNote: "Explore a preview of our online store. Orders are not open yet." }
};
export function HomeCollection({ locale, catalog }: { locale: Locale; catalog: CatalogResult }) {
const products = catalogItems(catalog.products), t = copy[locale], shop = pagePath(locale, "shop");
return (
      <section className={s.collection} aria-labelledby="collection-title">
        <div className={s.sectionTop}>
          <div>
            <p className={s.eyebrow}>{t.collectionLabel}</p>
            <h2 id="collection-title">{t.collectionTitle}</h2>
            <p className={s.intro}>{t.collectionText}</p>
          </div>
          <Link className={s.textLink} href={shop}>
            {t.all}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className={s.productGrid}>
          {products.slice(0, 3).map((product, index) => (
            <Link
              key={product.id}
              href={`${locale === "en" ? "/en" : ""}/urun/${encodeURIComponent(product.product.slug)}?variant=${encodeURIComponent(product.id)}`}
              className={s.productCard}
            >
              <div
                className={`${s.productImage} ${index === 0 ? s.coffeeProduct : ""}`}
              >
                <span className={s.productTag}>
                  {product.category === "coffee" ? t.packaged : t.thermos}
                </span>
                {product.image ? <Image
                  src={product.image}
                  alt={product.imageAlt[locale]}
                  fill
                  sizes="(max-width: 600px) 70vw, 30vw"
                /> : <span className={s.noImage}>{locale === "tr" ? "Görsel hazırlanıyor" : "Image coming soon"}</span>}
                <span className={s.productArrow} aria-label={t.inspect}>
                  <span aria-hidden="true">↗</span>
                </span>
              </div>
              <div className={s.productInfo}>
                <h3>{product.name[locale]}</h3>
                <span>
                  {variantLabel(product, locale)}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {!catalog.available ? <div className={s.catalogNotice} role="status">
          <p>{locale === "tr" ? "Ürünler şu anda yüklenemiyor. Lütfen yeniden deneyin." : "Products could not be loaded. Please try again."}</p>
          <button onClick={() => window.location.reload()}>{locale === "tr" ? "Yeniden dene" : "Try again"}</button>
        </div> : products.length === 0 ? <p className={s.catalogNotice}>{locale === "tr" ? "Yeni koleksiyonumuz hazırlanıyor." : "Our new collection is on its way."}</p> : null}
        <p className={s.previewNote}>{t.collectionNote}</p>
      </section>

);
}
