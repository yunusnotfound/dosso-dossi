"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { catalogItems, formatPrice, variantLabel, type CatalogProduct } from "@/lib/catalog";
import { detailRows, loginForSelection, productSelectionPath, resolveProductSelection } from "@/lib/product-helpers";
import { cartPath, commerceError } from "@/lib/web-commerce";
import type { Locale } from "@/lib/site";
import { useCustomerCart } from "@/components/commerce/use-customer-cart";
import s from "./product-detail.module.css";

export function ProductDetail({ product, locale }: { product: CatalogProduct; locale: Locale }) {
  const tr = locale === "tr";
  const query = useSearchParams();
  const items = useMemo(() => catalogItems([product]), [product]);
  const selection = resolveProductSelection(items, new URLSearchParams(query.toString()));
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const customerCart = useCustomerCart(false);
  if (!selection) return <p className={s.unavailable}>{tr ? "Bu ürünün satışa açık seçeneği yok." : "This product has no available options."}</p>;
  const { item, grind, quantity } = selection;
  const grinds = product.grindOptions.filter(grind => grind.active);
  const lines = customerCart.cart?.lines ?? [];
  const inCart = lines.filter(line => line.variantId === item.id).reduce((sum, line) => sum + line.quantity, 0);
  const sameLine = lines.find(line => line.variantId === item.id && line.grindId === (grind?.id ?? null))?.quantity ?? 0;
  const remaining = Math.max(0, Math.min(item.variant.stock - inCart, 99 - sameLine));
  const selectedQuantity = Math.min(quantity, Math.max(1, remaining));
  const price = item.priceMinor + (grind?.priceDeltaMinor ?? 0);
  const image = product.images.find(image => image.id === galleryId);
  const src = image?.url ?? item.image;
  const facts = detailRows(product, locale);
  const guide = tr ? product.details?.brewGuideTr : product.details?.brewGuideEn;
  const care = tr ? product.details?.careTr : product.details?.careEn;
  function update(variantId: string, grindId: string | null, amount: number) {
    const next = items.find(item => item.id === variantId);
    if (!next) return;
    setAdded(false);
    if (next.id !== item.id) setGalleryId(null);
    window.history.replaceState(null, "", productSelectionPath(locale, next, grindId, amount));
  }
  async function add() {
    if (!remaining || customerCart.busy) return;
    const success = await customerCart.mutate("cart/items", "POST", { variantId: item.id, grindId: grind?.id ?? null, quantity: selectedQuantity });
    if (success) setAdded(true);
  }
  return <section className={s.page}>
    <nav className={s.breadcrumb} aria-label={tr ? "Sayfa yolu" : "Breadcrumb"}><Link href={tr ? "/alisveris" : "/en/alisveris"}>{tr ? "Mağaza" : "Shop"}</Link><span aria-hidden="true">/</span><span>{item.name[locale]}</span></nav>
    <div className={s.layout}>
      <div className={s.gallery}>
        <div className={s.photo}>{src ? <Image src={src} alt={image ? (tr ? image.altTr : image.altEn) || item.name[locale] : item.imageAlt[locale]} fill sizes="(max-width: 760px) 90vw, 600px" priority /> : <span>{tr ? "Görsel hazırlanıyor" : "Image coming soon"}</span>}</div>
        {product.images.length > 1 && <div className={s.thumbs} role="group" aria-label={tr ? "Ürün görselleri" : "Product images"}>{product.images.map((image, index) => <button key={image.id} onClick={() => setGalleryId(image.id)} aria-label={`${tr ? "Görsel" : "Image"} ${index + 1}`} aria-pressed={src === image.url}><Image src={image.url} alt="" fill sizes="70px" /></button>)}</div>}
      </div>
      <div className={s.info}>
        <p className={s.eyebrow}>DOSSO DOSSI · {product.type === "COFFEE" ? (tr ? "PAKET KAHVE" : "PACKAGED COFFEE") : (tr ? "TERMOS" : "THERMOS")}</p>
        <h1>{item.name[locale]}</h1><p className={s.price}>{formatPrice(price, locale)}</p>
        <p className={s.description}>{item.description[locale]}</p>
        <div className={s.fields}>
          <label>{product.type === "COFFEE" ? (tr ? "Gramaj" : "Weight") : (tr ? "Renk ve hacim" : "Colour and capacity")}<select value={item.id} onChange={event => update(event.target.value, grind?.id ?? null, 1)}>{items.map(option => <option key={option.id} value={option.id}>{variantLabel(option, locale)}{option.variant.stock === 0 ? (tr ? " — Tükendi" : " — Sold out") : ""}</option>)}</select></label>
          {grinds.length > 0 && <label>{tr ? "Öğütüm" : "Grind"}<select value={grind?.id ?? ""} onChange={event => update(item.id, event.target.value, quantity)}>{grinds.map(option => <option key={option.id} value={option.id}>{tr ? option.nameTr : option.nameEn}{option.priceDeltaMinor ? ` (+${formatPrice(option.priceDeltaMinor, locale)})` : ""}</option>)}</select></label>}
        </div>
        <p className={s.stock} aria-live="polite">{item.variant.stock === 0 ? (tr ? "Tükendi" : "Sold out") : remaining === 0 ? (tr ? "Mevcut stok sepetinizde." : "The available stock is already in your bag.") : (tr ? "Stokta" : "In stock")}</p>
        <div className={s.purchase}>
          <div className={s.quantity}><button aria-label={tr ? "Adedi azalt" : "Decrease quantity"} disabled={customerCart.busy || selectedQuantity <= 1} onClick={() => update(item.id, grind?.id ?? null, selectedQuantity - 1)}>−</button><span aria-label={tr ? "Adet" : "Quantity"}>{selectedQuantity}</span><button aria-label={tr ? "Adedi artır" : "Increase quantity"} disabled={customerCart.busy || selectedQuantity >= remaining} onClick={() => update(item.id, grind?.id ?? null, selectedQuantity + 1)}>+</button></div>
          {customerCart.status === "guest" && remaining > 0 ? <Link className={s.primary} href={loginForSelection(locale, productSelectionPath(locale, item, grind?.id ?? null, selectedQuantity))}>{tr ? "Giriş yap ve devam et" : "Sign in to continue"}<span aria-hidden="true">↗</span></Link> : <button className={s.primary} disabled={customerCart.busy || customerCart.status === "loading" || (!remaining && customerCart.status !== "error")} onClick={() => customerCart.status === "error" ? void customerCart.refresh() : void add()}>{customerCart.busy ? (tr ? "Ekleniyor…" : "Adding…") : customerCart.status === "loading" ? (tr ? "Yükleniyor…" : "Loading…") : customerCart.status === "error" ? (tr ? "Yeniden dene" : "Retry") : item.variant.stock === 0 ? (tr ? "Tükendi" : "Sold out") : (tr ? "Sepete ekle" : "Add to bag")}<span aria-hidden="true">+</span></button>}
        </div>
        {added && <p role="status" className={s.success}>{tr ? "Seçiminiz sepete eklendi." : "Your selection was added to your bag."} <Link href={cartPath(locale)}>{tr ? "Sepetime git →" : "View bag →"}</Link></p>}
        {customerCart.error != null && <p role="alert" className={s.error}>{commerceError(customerCart.error, locale)}</p>}
        <p className={s.note}>{tr ? "Sepetiniz hesabınızda saklanır. Satışlar henüz başlamadı." : "Your bag is saved to your account. Sales have not started yet."}</p>
        {facts.length > 0 && <section className={s.facts}><h2>{product.type === "COFFEE" ? (tr ? "Kahveni tanı" : "Meet your coffee") : (tr ? "Ürün özellikleri" : "Product details")}</h2><dl>{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></section>}
        {guide && product.type === "COFFEE" && <section className={s.guide}><h2>{tr ? "Demleme rehberi" : "Brewing guide"}</h2><p>{guide}</p></section>}
        {care && <section className={s.guide}><h2>{tr ? "Kullanım ve bakım" : "Use and care"}</h2><p>{care}</p></section>}
      </div>
    </div>
  </section>;
}
