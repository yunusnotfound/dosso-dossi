"use client";

import Image from "next/image";
import {
  formatPrice,
  minimumPriceMinor,
  variantLabel,
  type CatalogItem,
} from "@/lib/catalog";
import type { Locale } from "@/lib/site";
import { StoreOverlay } from "./store-overlay";
import s from "./store-experience.module.css";

type CatalogOverlayProps = {
  locale: Locale;
  items: CatalogItem[];
  available: boolean;
  onClose: () => void;
  onProduct: (id: string) => void;
};

export function StoreCatalogOverlay({
  locale,
  items,
  available,
  onClose,
  onProduct,
}: CatalogOverlayProps) {
  const tr = locale === "tr";
  return (
    <StoreOverlay
      className={s.catalog}
      label={tr ? "Ürün seçkisi" : "Product collection"}
      onClose={onClose}
    >
      <div className={s.catalogHeading}>
        <div>
          <p className={s.eyebrow}>
            {tr ? "DOSSO DOSSI SEÇKİSİ" : "THE DOSSO DOSSI COLLECTION"}
          </p>
          <h2>{tr ? "Kahve molan, seninle." : "Your coffee break, to go."}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label={tr ? "Ürün listesini kapat" : "Close product list"}
        >
          ×
        </button>
      </div>
      <div className={s.catalogGrid}>
        {items.map((product) => (
          <button key={product.id} onClick={() => onProduct(product.id)}>
            {product.image ? (
              <Image
                src={product.image}
                alt={product.imageAlt[locale]}
                width={140}
                height={180}
              />
            ) : (
              <span>{tr ? "Görsel bulunmuyor" : "No image available"}</span>
            )}
            <b>{product.name[locale]}</b>
            <small>{variantLabel(product, locale)}</small>
            <span>
              {formatPrice(minimumPriceMinor(product), locale)} <i>↗</i>
            </span>
          </button>
        ))}
      </div>
      {!available ? (
        <p role="alert">
          {tr ? "Katalog yüklenemedi." : "The catalog could not be loaded."}{" "}
          <button onClick={() => location.reload()}>
            {tr ? "Yeniden dene" : "Try again"}
          </button>
        </p>
      ) : items.length === 0 ? (
        <p>
          {tr ? "Koleksiyon hazırlanıyor." : "The collection is on its way."}
        </p>
      ) : null}
    </StoreOverlay>
  );
}

export function StoreHelpOverlay({
  locale,
  onClose,
}: {
  locale: Locale;
  onClose: () => void;
}) {
  const tr = locale === "tr";
  return (
    <StoreOverlay
      className={s.help}
      label={tr ? "Nasıl gezilir?" : "How to explore?"}
      onClose={onClose}
    >
      <button
        className={s.helpClose}
        onClick={onClose}
        aria-label={tr ? "Kapat" : "Close"}
      >
        ×
      </button>
      <p className={s.eyebrow}>{tr ? "KÜÇÜK BİR TUR" : "A LITTLE TOUR"}</p>
      <h2>{tr ? "Kendi ritminde keşfet." : "Explore at your own pace."}</h2>
      <p>
        {tr
          ? "Etrafa bakmak için görüntüyü sürükle. Alttaki bölüm düğmeleriyle mağazada gezinebilirsin."
          : "Drag the scene to look around. Use the section buttons below to explore the store."}
      </p>
      <p>
        {tr
          ? "Raftaki ürüne dokunarak seçeneklerini incele. Sağ alttaki haritadan da gitmek istediğin noktayı seçebilirsin."
          : "Tap a product to explore its options. You can also choose your destination on the map at the bottom right."}
      </p>
      <button className={s.helpStart} onClick={onClose}>
        {tr ? "Keşfetmeye başla" : "Start exploring"} ↗
      </button>
    </StoreOverlay>
  );
}
