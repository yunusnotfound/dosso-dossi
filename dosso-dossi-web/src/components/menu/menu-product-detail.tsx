"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { MobileMenuOptions, MobileMenuProduct } from "@/lib/menu-snapshot";
import type { Locale } from "@/lib/site";
import s from "./menu-product-detail.module.css";

type MenuProductDetailProps = {
  product: MobileMenuProduct;
  categoryName: string;
  options: MobileMenuOptions;
  locale: Locale;
  onClose: () => void;
  onBranches: () => void;
};

const copy = {
  tr: {
    close: "Ürün detayını kapat", milk: "Süt tercihi", shot: "Espresso tercihi",
    included: "Dahil", branches: "Şubelerimizde keşfet", new: "Yeni",
    price: "Menü fiyatı", selectedPrice: "Seçimlerinle", image: "Görsel mevcut değil",
    choices: "Kendi dokunuşunu kat.",
  },
  en: {
    close: "Close product details", milk: "Milk preference", shot: "Espresso preference",
    included: "Included", branches: "Discover in our stores", new: "New",
    price: "Menu price", selectedPrice: "With your choices", image: "Image unavailable",
    choices: "Make it your own.",
  },
};

export function MenuProductDetail({ product, categoryName, options, locale, onClose, onBranches }: MenuProductDetailProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const optionsId = useId();
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [selection, setSelection] = useState({ productId: product.id, milk: "", shot: "" });
  const t = copy[locale];
  const formatPrice = (value: number) => new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
  const milk = options.milks.find((option) => selection.productId === product.id && option.id === selection.milk) ?? options.milks[0];
  const shot = options.shots.find((option) => selection.productId === product.id && option.id === selection.shot) ?? options.shots[0];
  const extraPrice = product.hasOptions ? (milk?.priceDelta ?? 0) + (shot?.priceDelta ?? 0) : 0;
  const imageSource = [product.imageUrl, product.image].find((source): source is string => Boolean(source && !failedImages.includes(source)));
  const groups = [
    { key: "milk" as const, label: t.milk, items: options.milks, selected: milk?.id },
    { key: "shot" as const, label: t.shot, items: options.shots, selected: shot?.id },
  ];

  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    if (!node) return;
    if (!node.open) node.showModal();
    return () => {
      node.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby={titleId}
      aria-describedby={product.description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onPointerDown={(event) => { pointerStartedOutside.current = event.target === event.currentTarget; }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && pointerStartedOutside.current) onClose();
        pointerStartedOutside.current = false;
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <div className={s.shell}>
        <button className={s.close} type="button" autoFocus onClick={onClose} aria-label={t.close}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        <div className={s.visual}>
          <div className={s.visualTop}>
            <span className={s.category}>{categoryName}</span>
            {product.isNew && <span className={s.new}>{t.new}</span>}
          </div>
          <div className={s.imageStage}>
            {imageSource ? (
              <Image
                key={imageSource}
                src={imageSource}
                alt={product.name}
                fill
                sizes="(max-width: 680px) 86vw, 440px"
                className={s.image}
                onError={() => setFailedImages((current) => [...current, imageSource])}
              />
            ) : <span className={s.missingImage}>{t.image}</span>}
          </div>
          <span className={s.wordmark} aria-hidden="true">DOSSO DOSSI<span>COFFEE</span></span>
        </div>
        <div className={s.content}>
          <p className={s.eyebrow}>{categoryName}</p>
          <h2 id={titleId} className={s.title}>{product.name}</h2>
          <div className={s.priceBlock} aria-live="polite" aria-atomic="true">
            <div>
              <span className={s.priceCaption}>{extraPrice ? t.selectedPrice : t.price}</span>
              <span className={s.price}>{formatPrice(product.price + extraPrice)}</span>
            </div>
            {Boolean(product.sizeMl) && <span className={s.size}>{product.sizeMl} ml</span>}
          </div>
          {product.description && <p className={s.description} id={descriptionId}>{product.description}</p>}
          {product.hasOptions && groups.some((group) => group.items.length > 0) && (
            <div className={s.options}>
              <h3>{t.choices}</h3>
              {groups.filter((group) => group.items.length > 0).map((group) => (
                <fieldset className={s.optionGroup} key={group.key}>
                  <legend>{group.label}</legend>
                  <div className={s.optionChoices}>
                    {group.items.map((option) => (
                      <label className={s.option} key={option.id}>
                        <input
                          type="radio"
                          name={`${optionsId}-${group.key}`}
                          value={option.id}
                          checked={option.id === group.selected}
                          onChange={() => setSelection({ productId: product.id, milk: milk?.id ?? "", shot: shot?.id ?? "", [group.key]: option.id })}
                        />
                        <span>{option.name}<small>{option.priceDelta ? `+${formatPrice(option.priceDelta)}` : t.included}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
          <button className={s.action} type="button" onClick={onBranches}>
            {t.branches}<span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
