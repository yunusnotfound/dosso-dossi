"use client";

import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/site";
import { accountPath } from "@/lib/customer-account";
import { formatPrice } from "@/lib/catalog";
import {
  addressesPath,
  commerceError,
  commerceImageUrl,
  type CartLine,
} from "@/lib/web-commerce";
import { ordersPath } from "@/lib/web-orders";
import { provinceName } from "@/components/account/address-provinces";
import { useCustomerCart } from "./use-customer-cart";
import s from "./cart.module.css";

const copy = {
  tr: {
    eyebrow: "DOSSO DOSSI ONLINE MAĞAZA",
    title: "Kahve molanız\nhazır olsun.",
    intro:
      "Seçtikleriniz hesabınızda saklanır. Her dönüşünüzde kaldığınız yerden devam edin.",
    bag: "Sepetim",
    products: "ürün",
    continue: "Alışverişe devam et",
    loading: "Sepetiniz yükleniyor…",
    retry: "Yeniden dene",
    guestTitle: "Sepetiniz sizinle gelsin.",
    guestText:
      "Ürünlerinizi hesabınızda saklamak ve teslimat adreslerinizi yönetmek için giriş yapın.",
    login: "Giriş yap / Üye ol",
    emptyTitle: "Bir kahve molasına ne dersiniz?",
    emptyText:
      "Sevdiğiniz kahveleri ve termosları keşfedin. Seçtikleriniz burada sizi beklesin.",
    discover: "Koleksiyonu keşfet",
    summary: "Sepet özeti",
    subtotal: "Ürünler toplamı",
    shipping: "Kargo",
    total: "Toplam",
    free: "Ücretsiz",
    unconfigured: "Henüz belirlenmedi",
    disabled: "Teslimat şu anda kapalı",
    chooseAddress: "Teslimat adresinizi seçin",
    invalidTotal: "Ürünleri kontrol edin",
    shippingUnknown:
      "Kargo ücreti henüz belirlenmedi. Ücret tanımlandığında sepetinizde gösterilecek.",
    shippingDisabled: "Kargo ile teslimat şu anda kullanılamıyor.",
    shippingFree: "Bu sepet için kargo ücretsiz.",
    shippingRemaining: "Ücretsiz kargo için kalan tutar:",
    checkoutNote:
      "Mağaza sandbox test modunda. Sipariş özetini kontrol ederek test siparişi oluşturabilirsiniz; gerçek ödeme veya teslimat yapılmaz.",
    addressTitle: "Teslimat adresi",
    addressNote: "Teslimat yalnızca Türkiye içindeki adreslere yapılır.",
    manageAddresses: "Adreslerimi yönet",
    addAddress: "Teslimat adresi ekle",
    noAddress: "Henüz kayıtlı teslimat adresiniz yok.",
    selected: "Seçili",
    default: "Varsayılan",
    recipient: "Alıcı",
    remove: "Kaldır",
    minus: "Adedi azalt",
    plus: "Adedi artır",
    qty: "Adet",
    unit: "Birim fiyat",
    unavailable: "Bu seçenek artık satışta değil. Sepetinizden kaldırın.",
    stock:
      "Diğer öğütüm seçenekleriyle paylaşılan stok dikkate alındığında bu seçenek için mevcut adet:",
    noImage: "Görsel hazırlanıyor",
    updated: "Fiyat ve stoklar güncel mağaza bilgilerine göre hesaplanır.",
    country: "TÜRKİYE İÇİ TESLİMAT",
    save: "Güncelleniyor…",
    errorTitle: "Sepetinize ulaşamadık.",
    select: "Bu adrese teslim edilsin",
    quantityLimit: "Bu ürün için mevcut stok sepetinizde.",
  },
  en: {
    eyebrow: "DOSSO DOSSI ONLINE STORE",
    title: "Make time for\nyour coffee break.",
    intro:
      "Your favourites stay in your account. Pick up where you left off, whenever you return.",
    bag: "My bag",
    products: "items",
    continue: "Continue shopping",
    loading: "Loading your bag…",
    retry: "Try again",
    guestTitle: "Keep your favourites close.",
    guestText:
      "Sign in to save your bag to your account and manage your delivery addresses.",
    login: "Sign in / Create account",
    emptyTitle: "Time for a little coffee break?",
    emptyText:
      "Discover your favourite coffee and thermoses. Your selection will be waiting for you here.",
    discover: "Explore the collection",
    summary: "Bag summary",
    subtotal: "Product subtotal",
    shipping: "Delivery",
    total: "Total",
    free: "Free",
    unconfigured: "Not yet configured",
    disabled: "Delivery is currently unavailable",
    chooseAddress: "Choose a delivery address",
    invalidTotal: "Review your products",
    shippingUnknown:
      "The delivery fee has not been set yet. It will appear here once it is available.",
    shippingDisabled: "Shipping is currently unavailable.",
    shippingFree: "Delivery is free for this bag.",
    shippingRemaining: "Add this amount for free delivery:",
    checkoutNote:
      "The store is in sandbox test mode. Review your summary to create a test order; no real payment or delivery is made.",
    addressTitle: "Delivery address",
    addressNote: "We only deliver to addresses within Türkiye.",
    manageAddresses: "Manage addresses",
    addAddress: "Add a delivery address",
    noAddress: "You have no saved delivery addresses yet.",
    selected: "Selected",
    default: "Default",
    recipient: "Recipient",
    remove: "Remove",
    minus: "Decrease quantity",
    plus: "Increase quantity",
    qty: "Quantity",
    unit: "Unit price",
    unavailable: "This option is no longer available. Remove it from your bag.",
    stock:
      "After accounting for other grind options in your bag, the available quantity for this option is:",
    noImage: "Image coming soon",
    updated:
      "Prices and availability are calculated using the latest store details.",
    country: "DELIVERY WITHIN TÜRKİYE",
    save: "Updating…",
    errorTitle: "We could not load your bag.",
    select: "Deliver to this address",
    quantityLimit: "All available stock for this product is in your bag.",
  },
} as const;

function BagIcon() {
  return (
    <svg
      viewBox="0 0 40 44"
      width="40"
      height="44"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 14h28l2 26H4l2-26Z" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M13 16V9a7 7 0 0 1 14 0v7"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function CartContent({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const { cart, addresses, status, busy, error, refresh, mutate } =
    useCustomerCart();
  const shopPath = `${locale === "en" ? "/en" : ""}/alisveris`;
  const itemLabel = (line: CartLine) =>
    locale === "tr" ? line.nameTr : line.nameEn;
  const allLinesValid =
    cart?.lines.every((line) => line.issue === null) ?? false;
  const shippingText = !cart?.shipping.enabled
    ? t.disabled
    : !cart.shipping.configured
      ? t.unconfigured
      : cart.shippingFeeMinor === 0
        ? t.free
        : cart.shippingFeeMinor === null
          ? "—"
          : formatPrice(cart.shippingFeeMinor, locale);

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.heading}>
          <div>
            <p className={s.eyebrow}>{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p className={s.intro}>{t.intro}</p>
          </div>
          <Link className={s.continueLink} href={shopPath}>
            {t.continue}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {Boolean(error) && (
          <div className={s.error} role="alert">
            {commerceError(error, locale)}
          </div>
        )}
        {status === "loading" && (
          <div className={s.loading} role="status">
            <BagIcon />
            <p>{t.loading}</p>
          </div>
        )}
        {status === "guest" && (
          <section className={s.empty}>
            <BagIcon />
            <p className={s.eyebrow}>DOSSO DOSSI & YOU</p>
            <h2>{t.guestTitle}</h2>
            <p>{t.guestText}</p>
            <Link className={s.primary} href={accountPath(locale)}>
              {t.login}
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        )}
        {status === "error" && (
          <section className={s.empty}>
            <BagIcon />
            <h2>{t.errorTitle}</h2>
            <button className={s.primary} onClick={() => void refresh()}>
              {t.retry}
              <span aria-hidden="true">↻</span>
            </button>
          </section>
        )}
        {status === "ready" &&
          cart &&
          (cart.lines.length === 0 ? (
            <section className={s.empty}>
              <BagIcon />
              <p className={s.eyebrow}>{t.bag}</p>
              <h2>{t.emptyTitle}</h2>
              <p>{t.emptyText}</p>
              <Link className={s.primary} href={shopPath}>
                {t.discover}
                <span aria-hidden="true">→</span>
              </Link>
              <Link className={s.textLink} href={addressesPath(locale)}>
                {t.manageAddresses}
              </Link>
            </section>
          ) : (
            <div className={s.layout} aria-busy={busy}>
              <div className={s.left}>
                <section aria-labelledby="bag-title">
                  <div className={s.sectionHeading}>
                    <h2 id="bag-title">{t.bag}</h2>
                    <span>
                      {cart.itemCount} {t.products}
                    </span>
                  </div>
                  <div className={s.lines}>
                    {cart.lines.map((line) => {
                      const imageUrl = commerceImageUrl(line.imageUrl);
                      const atStockLimit =
                        line.quantity >= line.availableQuantity;
                      const variantName =
                        locale === "tr"
                          ? line.variantLabelTr
                          : line.variantLabelEn;
                      const grindName =
                        locale === "tr" ? line.grindNameTr : line.grindNameEn;
                      return (
                        <article className={s.line} key={line.id}>
                          <div className={s.productImage}>
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt=""
                                fill
                                sizes="(max-width:600px) 78px, 116px"
                              />
                            ) : (
                              <span>{t.noImage}</span>
                            )}
                          </div>
                          <div className={s.productInfo}>
                            <h3>
                              {line.slug ? (
                                <Link
                                  href={`${shopPath}?product=${encodeURIComponent(line.slug)}&variant=${encodeURIComponent(line.variantId)}`}
                                >
                                  {itemLabel(line)}
                                </Link>
                              ) : (
                                itemLabel(line)
                              )}
                            </h3>
                            <p className={s.variant}>
                              {[variantName, grindName]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {line.unitPriceMinor !== null && (
                              <p className={s.unit}>
                                {t.unit}:{" "}
                                {formatPrice(line.unitPriceMinor, locale)}
                              </p>
                            )}
                            {line.issue && (
                              <p className={s.lineIssue}>
                                {line.issue === "UNAVAILABLE"
                                  ? t.unavailable
                                  : `${t.stock} ${line.availableQuantity}`}
                              </p>
                            )}
                            <div className={s.controls}>
                              <div className={s.quantity} aria-label={t.qty}>
                                <button
                                  aria-label={`${t.minus}: ${itemLabel(line)} ${variantName} ${grindName ?? ""}`}
                                  disabled={busy || line.quantity <= 1}
                                  onClick={() =>
                                    void mutate(
                                      `cart/items/${line.id}`,
                                      "PATCH",
                                      { quantity: line.quantity - 1 },
                                    )
                                  }
                                >
                                  −
                                </button>
                                <span>{line.quantity}</span>
                                <button
                                  title={
                                    atStockLimit ? t.quantityLimit : undefined
                                  }
                                  aria-label={`${t.plus}: ${itemLabel(line)} ${variantName} ${grindName ?? ""}`}
                                  disabled={
                                    busy ||
                                    line.issue !== null ||
                                    atStockLimit ||
                                    line.quantity >= 99
                                  }
                                  onClick={() =>
                                    void mutate(
                                      `cart/items/${line.id}`,
                                      "PATCH",
                                      { quantity: line.quantity + 1 },
                                    )
                                  }
                                >
                                  +
                                </button>
                              </div>
                              <button
                                className={s.remove}
                                disabled={busy}
                                onClick={() =>
                                  void mutate(
                                    `cart/items/${line.id}`,
                                    "DELETE",
                                    {},
                                  )
                                }
                              >
                                {t.remove}
                              </button>
                            </div>
                          </div>
                          <strong className={s.linePrice}>
                            {line.lineTotalMinor === null
                              ? "—"
                              : formatPrice(line.lineTotalMinor, locale)}
                          </strong>
                        </article>
                      );
                    })}
                  </div>
                  <p className={s.footnote}>{t.updated}</p>
                </section>
                <section
                  className={s.addressSection}
                  aria-labelledby="address-title"
                >
                  <div className={s.sectionHeading}>
                    <h2 id="address-title">{t.addressTitle}</h2>
                    <Link href={addressesPath(locale)}>
                      {t.manageAddresses} <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                  <p className={s.addressNote}>{t.addressNote}</p>
                  {addresses.length ? (
                    <fieldset className={s.addressGrid} disabled={busy}>
                      <legend className={s.srOnly}>{t.chooseAddress}</legend>
                      {addresses.map((address) => (
                        <label
                          className={`${s.address} ${cart.selectedAddressId === address.id ? s.addressSelected : ""}`}
                          key={address.id}
                        >
                          <input
                            type="radio"
                            name="delivery-address"
                            value={address.id}
                            checked={cart.selectedAddressId === address.id}
                            onChange={() =>
                              void mutate("cart/address", "PUT", {
                                addressId: address.id,
                              })
                            }
                          />
                          <span className={s.addressCopy}>
                            <strong>{address.title}</strong>
                            <span>{address.recipientName}</span>
                            <span>
                              {address.neighborhood}, {address.addressLine}
                            </span>
                            <span>
                              {address.district} /{" "}
                              {provinceName(address.provinceCode)} ·{" "}
                              {address.postalCode} · Türkiye
                            </span>
                            <span>{address.phone}</span>
                            <small>
                              {cart.selectedAddressId === address.id
                                ? t.selected
                                : address.isDefault
                                  ? t.default
                                  : t.select}
                            </small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <div className={s.noAddress}>
                      <p>{t.noAddress}</p>
                      <Link className={s.textLink} href={addressesPath(locale)}>
                        {t.addAddress} <span aria-hidden="true">+</span>
                      </Link>
                    </div>
                  )}
                </section>
              </div>
              <aside className={s.summary} aria-labelledby="summary-title">
                <p className={s.eyebrow}>{t.country}</p>
                <h2 id="summary-title">{t.summary}</h2>
                <dl className={s.totals}>
                  <div>
                    <dt>{t.subtotal}</dt>
                    <dd>
                      {cart.subtotalMinor === null
                        ? "—"
                        : formatPrice(cart.subtotalMinor, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.shipping}</dt>
                    <dd>{shippingText}</dd>
                  </div>
                  <div className={s.total}>
                    <dt>{t.total}</dt>
                    <dd>
                      {cart.totalMinor !== null ? (
                        formatPrice(cart.totalMinor, locale)
                      ) : (
                        <span>
                          {!allLinesValid
                            ? t.invalidTotal
                            : !cart.selectedAddressId
                              ? t.chooseAddress
                              : "—"}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
                {!cart.shipping.enabled ? (
                  <p className={s.shippingNote}>{t.shippingDisabled}</p>
                ) : !cart.shipping.configured ? (
                  <p className={s.shippingNote}>{t.shippingUnknown}</p>
                ) : (
                  cart.freeShippingRemainingMinor !== null &&
                  allLinesValid && (
                    <div className={s.freeShipping}>
                      <span aria-hidden="true">↗</span>
                      <p>
                        {cart.freeShippingRemainingMinor === 0 ? (
                          t.shippingFree
                        ) : (
                          <>
                            {t.shippingRemaining}{" "}
                            <strong>
                              {formatPrice(
                                cart.freeShippingRemainingMinor,
                                locale,
                              )}
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                  )
                )}
                <p className={s.checkoutNote}>{t.checkoutNote}</p>
                {cart.valid && cart.totalMinor !== null && !busy && (
                  <Link
                    className={`${s.primary} ${s.checkoutButton}`}
                    href={ordersPath(locale, "yeni")}
                  >
                    {locale === "tr"
                      ? "Test siparişini gözden geçir"
                      : "Review test order"}
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
                <Link
                  className={`${s.textLink} ${s.ordersLink}`}
                  href={ordersPath(locale)}
                >
                  {locale === "tr" ? "Siparişlerim" : "My orders"}
                </Link>
                {busy && (
                  <p className={s.updating} role="status">
                    {t.save}
                  </p>
                )}
              </aside>
            </div>
          ))}
      </div>
    </div>
  );
}
