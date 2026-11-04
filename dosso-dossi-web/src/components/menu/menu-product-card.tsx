"use client";

import Image from "next/image";
import { useState } from "react";
import type { MobileMenuProduct } from "@/lib/menu-snapshot";
import type { Locale } from "@/lib/site";
import { menuCopy, menuPrice } from "./menu-copy";
import s from "./menu-experience.module.css";

export function MenuProductCard({ product, locale, onSelect }: {
  product: MobileMenuProduct; locale: Locale; onSelect: (product: MobileMenuProduct) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const t = menuCopy[locale];
  const photo = product.image && !imageFailed;
  return (
    <article className={`${s.card} ${!photo ? s.textCard : ""}`}>
      <button className={s.cardButton} onClick={() => onSelect(product)} aria-label={`${product.name} — ${menuPrice(product.price, locale)} — ${t.detail}`}>
        {photo && <div className={s.productVisual}>
          <Image src={product.image!} alt={product.name} width={360} height={360} sizes="(max-width: 600px) 45vw, (max-width: 1000px) 38vw, 24vw" onError={() => setImageFailed(true)} />
          {product.isNew ? <span className={s.badge}>{t.newBadge}</span> : product.isFeatured ? <span className={s.badge}>{t.featuredBadge}</span> : null}
          <span className={s.cardArrow} aria-hidden="true">↗</span>
        </div>}
        <div className={s.cardCopy}>
          {!photo && <span className={s.textMark} aria-hidden="true">DD.</span>}
          <div className={s.cardHeading}><h4>{product.name}</h4><strong>{menuPrice(product.price, locale)}</strong></div>
          <div className={s.cardMeta}><span>{product.sizeMl > 0 ? `${product.sizeMl} ${t.size}` : t.noPhoto}</span><span>{t.detail} <b aria-hidden="true">↗</b></span></div>
        </div>
      </button>
    </article>
  );
}
