"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCustomerCart } from "@/components/commerce/use-customer-cart";
import {
  catalogItems,
  formatPrice,
  variantLabel,
  type CatalogItem,
} from "@/lib/catalog";
import { accountPath } from "@/lib/customer-account";
import { cartPath, commerceError } from "@/lib/web-commerce";
import type { Locale } from "@/lib/site";
import styles from "./store-product-panel.module.css";

type StoreProductPanelProps = {
  locale: Locale;
  item: CatalogItem;
  items: CatalogItem[];
  onClose: () => void;
};

const copy = {
  tr: {
    detail: "DOSSO DOSSI SEÇKİSİ",
    close: "Ürün detayını kapat",
    coffee: "Kahve",
    thermos: "Termos",
    variant: "Renk / hacim",
    weight: "Gramaj / seçenek",
    grind: "Öğütüm",
    gallery: "Ürün görselleri",
    noImage: "Bu ürün için görsel bulunmuyor.",
    quantity: "Adet",
    decrease: "Adedi azalt",
    increase: "Adedi artır",
    add: "Sepete ekle",
    adding: "Ekleniyor…",
    loading: "Sepetiniz yükleniyor…",
    login: "Giriş yap ve sepete ekle",
    guest: "Sepetiniz hesabınızda saklanır. Eklemek için giriş yapın.",
    cart: "Sepetimi gör",
    retry: "Yeniden dene",
    soldOut: "Tükendi",
    soldOutNote: "Bu seçenek şu anda stokta bulunmuyor.",
    stockLimit: "Bu seçenek için eklenebilecek adede ulaştınız.",
    available: "adet mevcut",
    inCart: "adet sepetinizde",
    added: "sepetinize eklendi.",
    subtotal: "Seçiminizin toplamı",
    continue: "Mağazaya dön",
    sku: "Ürün kodu",
  },
  en: {
    detail: "THE DOSSO DOSSI COLLECTION",
    close: "Close product details",
    coffee: "Coffee",
    thermos: "Thermos",
    variant: "Colour / capacity",
    weight: "Weight / option",
    grind: "Grind",
    gallery: "Product images",
    noImage: "No image is available for this product.",
    quantity: "Quantity",
    decrease: "Decrease quantity",
    increase: "Increase quantity",
    add: "Add to bag",
    adding: "Adding…",
    loading: "Loading your bag…",
    login: "Sign in to add to bag",
    guest: "Your bag stays in your account. Sign in to add this item.",
    cart: "View my bag",
    retry: "Try again",
    soldOut: "Out of stock",
    soldOutNote: "This option is currently out of stock.",
    stockLimit: "You have reached the available quantity for this option.",
    available: "available",
    inCart: "already in your bag",
    added: "added to your bag.",
    subtotal: "Your selection total",
    continue: "Back to the store",
    sku: "Product code",
  },
} as const;

/** A new selected shelf product starts a fresh detail session. */
export function StoreProductPanel(props: StoreProductPanelProps) {
  return <ProductPanelSession key={props.item.id} {...props} />;
}

function ProductPanelSession({
  locale,
  item,
  items,
  onClose,
}: StoreProductPanelProps) {
  const t = copy[locale];
  const titleId = useId();
  const stockId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeCallback = useRef(onClose);
  const [selectedId, setSelectedId] = useState(item.id);
  const [grindId, setGrindId] = useState<string | null>(null);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [announcement, setAnnouncement] = useState("");
  const { cart, status, busy, error, refresh, mutate, clearError } =
    useCustomerCart(false);

  const variants = useMemo(
    () =>
      catalogItems([item.product]).map(
        (variant) =>
          items.find(
            (candidate) =>
              candidate.id === variant.id &&
              candidate.product.id === item.product.id &&
              candidate.variant.active,
          ) ?? variant,
      ),
    [item.product, items],
  );
  const selected =
    variants.find((variant) => variant.id === selectedId) ??
    variants[0] ??
    item;
  const grinds = selected.product.grindOptions
    .filter((grind) => grind.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedGrind =
    grinds.find((grind) => grind.id === grindId) ?? grinds[0] ?? null;
  const images = [...selected.product.images].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const galleryImage = images.find((image) => image.id === galleryId);
  const imageUrl = galleryImage?.url ?? selected.image;
  const imageAlt = galleryImage
    ? (locale === "tr" ? galleryImage.altTr : galleryImage.altEn) ||
      selected.name[locale]
    : selected.imageAlt[locale];
  const hasImage = Boolean(imageUrl && !failedImages.includes(imageUrl));
  const skuQuantity = (cart?.lines ?? []).reduce(
    (sum, line) => sum + (line.variantId === selected.id ? line.quantity : 0),
    0,
  );
  const sameOptionQuantity =
    cart?.lines.find(
      (line) =>
        line.variantId === selected.id &&
        line.grindId === (selectedGrind?.id ?? null),
    )?.quantity ?? 0;
  const liveStock = variants.some((variant) => variant.id === selected.id)
    ? Math.max(0, selected.variant.stock)
    : 0;
  // All grind options consume the same SKU stock; each cart line is capped at 99.
  const remaining = Math.max(
    0,
    Math.min(liveStock - skuQuantity, 99 - sameOptionQuantity),
  );
  const selectedQuantity = Math.max(1, Math.min(quantity, remaining || 1));
  const unitPrice = selected.priceMinor + (selectedGrind?.priceDeltaMinor ?? 0);
  const controlsDisabled = busy || status === "loading";

  useEffect(() => {
    closeCallback.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function chooseVariant(id: string) {
    setSelectedId(id);
    setGalleryId(null);
    setQuantity(1);
    setAnnouncement("");
    clearError();
  }

  async function addToCart() {
    if (status !== "ready" || busy || remaining < 1) return;
    setAnnouncement("");
    const added = await mutate("cart/items", "POST", {
      variantId: selected.id,
      grindId: selectedGrind?.id ?? null,
      quantity: selectedQuantity,
    });
    if (added) {
      setQuantity(1);
      setAnnouncement(
        `${selectedQuantity} × ${selected.name[locale]} ${t.added}`,
      );
      window.dispatchEvent(new Event("dosso-store-cart-updated"));
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        closeCallback.current();
      }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          closeCallback.current();
      }}
      onKeyDown={(event) => {
        // Do not pass typing/selection keys through to the 3D navigation controls.
        event.stopPropagation();
        if (event.key !== "Tab") return;
        const focusable = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled), [tabindex='0']",
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className={styles.header}>
        <span>{t.detail}</span>
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={t.close}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.imageStage}>
          {hasImage ? (
            <Image
              key={imageUrl}
              src={imageUrl!}
              alt={imageAlt}
              fill
              sizes="(max-width: 520px) 80vw, 330px"
              onError={() =>
                setFailedImages((failed) =>
                  imageUrl ? [...failed, imageUrl] : failed,
                )
              }
            />
          ) : (
            <p className={styles.noImage}>{t.noImage}</p>
          )}
          <span className={styles.category}>
            {selected.category === "coffee" ? t.coffee : t.thermos}
          </span>
        </div>
        {images.length > 1 && (
          <div className={styles.gallery} role="group" aria-label={t.gallery}>
            {images.map((image, index) => (
              <button
                type="button"
                key={image.id}
                className={styles.thumbnail}
                onClick={() => setGalleryId(image.id)}
                aria-label={`${t.gallery} ${index + 1}`}
                aria-pressed={image.url === imageUrl}
              >
                {failedImages.includes(image.url) ? (
                  <span>{index + 1}</span>
                ) : (
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="52px"
                    onError={() =>
                      setFailedImages((failed) => [...failed, image.url])
                    }
                  />
                )}
              </button>
            ))}
          </div>
        )}

        <div className={styles.identity}>
          <h2 id={titleId}>{selected.name[locale]}</h2>
          <p className={styles.price}>{formatPrice(unitPrice, locale)}</p>
        </div>
        {selected.description[locale] && (
          <p className={styles.description}>{selected.description[locale]}</p>
        )}

        {variants.length > 0 && (
          <label className={styles.field}>
            <span>{selected.category === "coffee" ? t.weight : t.variant}</span>
            <select
              value={selected.id}
              disabled={controlsDisabled}
              onChange={(event) => chooseVariant(event.target.value)}
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variantLabel(variant, locale)}
                  {variant.variant.stock <= 0 ? ` — ${t.soldOut}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {variants.some((variant) => variant.color?.hex) && (
          <div className={styles.swatches} role="group" aria-label={t.variant}>
            {variants
              .filter((variant) =>
                /^#[a-f\d]{6}$/i.test(variant.color?.hex ?? ""),
              )
              .map((variant) => (
                <button
                  type="button"
                  key={variant.id}
                  disabled={controlsDisabled}
                  aria-label={variantLabel(variant, locale)}
                  title={variantLabel(variant, locale)}
                  aria-pressed={selected.id === variant.id}
                  onClick={() => chooseVariant(variant.id)}
                >
                  <span
                    style={{ backgroundColor: variant.color?.hex ?? undefined }}
                  />
                </button>
              ))}
          </div>
        )}

        {grinds.length > 0 && (
          <label className={styles.field}>
            <span>{t.grind}</span>
            <select
              value={selectedGrind?.id ?? ""}
              required
              disabled={controlsDisabled}
              onChange={(event) => {
                setGrindId(event.target.value);
                setQuantity(1);
                setAnnouncement("");
                clearError();
              }}
            >
              {grinds.map((grind) => (
                <option key={grind.id} value={grind.id}>
                  {locale === "tr" ? grind.nameTr : grind.nameEn}
                  {grind.priceDeltaMinor
                    ? ` (${grind.priceDeltaMinor > 0 ? "+" : ""}${formatPrice(grind.priceDeltaMinor, locale)})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div
          id={stockId}
          className={styles.stock}
          data-empty={liveStock === 0}
          aria-live="polite"
        >
          <span className={styles.stockDot} />
          <span>
            {liveStock === 0
              ? t.soldOutNote
              : remaining === 0
                ? t.stockLimit
                : `${liveStock} ${t.available}`}
            {skuQuantity > 0 && (
              <small>
                {skuQuantity} {t.inCart}
              </small>
            )}
          </span>
        </div>

        <div className={styles.quantityRow}>
          <span>{t.quantity}</span>
          <div className={styles.quantity} role="group" aria-label={t.quantity}>
            <button
              type="button"
              disabled={
                controlsDisabled || remaining === 0 || selectedQuantity <= 1
              }
              aria-label={t.decrease}
              onClick={() => setQuantity(selectedQuantity - 1)}
            >
              −
            </button>
            <output aria-live="polite" aria-label={t.quantity}>
              {selectedQuantity}
            </output>
            <button
              type="button"
              disabled={controlsDisabled || selectedQuantity >= remaining}
              aria-label={t.increase}
              onClick={() => setQuantity(selectedQuantity + 1)}
            >
              +
            </button>
          </div>
        </div>
        <p className={styles.sku}>
          {t.sku}: {selected.variant.sku}
        </p>
      </div>

      <div className={styles.footer}>
        {announcement && (
          <p className={styles.success} role="status">
            {announcement}
          </p>
        )}
        {Boolean(error) && (
          <p className={styles.error} role="alert">
            {commerceError(error, locale)}
          </p>
        )}
        <div className={styles.subtotal}>
          <span>{t.subtotal}</span>
          <strong>{formatPrice(unitPrice * selectedQuantity, locale)}</strong>
        </div>
        {status === "guest" && remaining > 0 ? (
          <>
            <Link href={accountPath(locale)} className={styles.primary}>
              {t.login}
              <span aria-hidden="true">↗</span>
            </Link>
            <p className={styles.note}>{t.guest}</p>
          </>
        ) : (
          <button
            type="button"
            className={styles.primary}
            aria-describedby={stockId}
            disabled={
              busy ||
              status === "loading" ||
              (remaining === 0 && status !== "error")
            }
            onClick={() =>
              status === "error" ? void refresh() : void addToCart()
            }
          >
            {busy
              ? t.adding
              : status === "loading"
                ? t.loading
                : status === "error"
                  ? t.retry
                  : liveStock === 0
                    ? t.soldOut
                    : t.add}
            {!busy && status === "ready" && remaining > 0 && (
              <span aria-hidden="true">+</span>
            )}
          </button>
        )}
        <div className={styles.footerLinks}>
          <button type="button" onClick={onClose}>
            {t.continue}
          </button>
          <Link href={cartPath(locale)}>
            {t.cart}
            {cart ? ` (${cart.itemCount})` : ""}
            <span aria-hidden="true"> ↗</span>
          </Link>
        </div>
      </div>
    </dialog>
  );
}
