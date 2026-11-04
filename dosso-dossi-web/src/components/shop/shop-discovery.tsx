"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { type CatalogItem, type BrewingMethod, type ProductDetails, formatPrice, minimumPriceMinor, variantLabel } from "@/lib/catalog";
import { findCoffees, brewingLabels, roastLabels, detailRows, productSelectionPath, loginForSelection } from "@/lib/product-helpers";
import { cartPath, commerceError } from "@/lib/web-commerce";
import type { Locale } from "@/lib/site";
import type { useCustomerCart } from "@/components/commerce/use-customer-cart";
import s from "./shop-discovery.module.css";

type CustomerCartState = ReturnType<typeof useCustomerCart>;

export function ShopDiscovery({ products, locale, customerCart }: { products: CatalogItem[]; locale: Locale; customerCart: CustomerCartState }) {
  const tr = locale === "tr";
  const [grindCode, setGrindCode] = useState("");
  const [weight, setWeight] = useState("");
  const [budget, setBudget] = useState("");
  const [method, setMethod] = useState<BrewingMethod | "">("");
  const [roast, setRoast] = useState<ProductDetails["roast"] | "">("");
  const [showResults, setShowResults] = useState(false);
  const coffees = useMemo(() => products.filter(item => item.category === "coffee"), [products]);
  const grinds = [...new Map(coffees.flatMap(item => item.product.grindOptions.filter(grind => grind.active)).map(grind => [grind.code, grind])).values()];
  const weights = [...new Set(coffees.map(item => item.variant.weightGrams).filter((weight): weight is number => weight != null))].sort((a,b) => a-b);
  const methods = [...new Set(coffees.flatMap(item => item.product.details?.brewingMethods ?? []))];
  const roasts = [...new Set(coffees.flatMap(item => item.product.details?.roast ? [item.product.details.roast] : []))];
  const matches = findCoffees(products, { method, roast, grindCode, weightGrams: weight ? Number(weight) : null, maxPriceMinor: budget ? Number(budget) * 100 : null });
  return <div className={s.discovery}>
    <section className={s.finder} id="kahveni-bul" aria-labelledby="finder-title">
      <div className={s.finderIntro}><p className={s.eyebrow}>{tr ? "EVDEKİ KAHVE RİTÜELİN" : "YOUR COFFEE RITUAL AT HOME"}</p><h2 id="finder-title">{tr ? "Sana uygun kahveyi bul." : "Find your coffee."}</h2><p>{tr ? "Öğütümünü, gramajını ve bütçeni seç. Stoktaki paket kahveler arasından tercihine uyanları birlikte bulalım." : "Choose your grind, weight and budget. Find the packaged coffees that fit your preferences and are in stock."}</p></div>
      <form className={s.finderForm} onSubmit={event => { event.preventDefault(); setShowResults(true); }}>
        <label>{tr ? "Öğütüm tercihin" : "Your grind"}<select value={grindCode} onChange={event => { setGrindCode(event.target.value); setShowResults(false); }}><option value="">{tr ? "Tüm seçenekler" : "All options"}</option>{grinds.map(grind => <option key={grind.code} value={grind.code}>{tr ? grind.nameTr : grind.nameEn}</option>)}</select></label>
        <label>{tr ? "Paket boyutu" : "Pack size"}<select value={weight} onChange={event => { setWeight(event.target.value); setShowResults(false); }}><option value="">{tr ? "Fark etmez" : "Any size"}</option>{weights.map(weight => <option key={weight} value={weight}>{weight} g</option>)}</select></label>
        <label>{tr ? "En yüksek bütçe (₺)" : "Maximum budget (₺)"}<input type="number" min="1" max="1000000" step="1" inputMode="numeric" value={budget} onChange={event => { setBudget(event.target.value); setShowResults(false); }} placeholder={tr ? "Sınır yok" : "No limit"} /></label>
        {methods.length > 0 && <label>{tr ? "Demleme yöntemi" : "Brewing method"}<select value={method} onChange={event => { setMethod(event.target.value as BrewingMethod | ""); setShowResults(false); }}><option value="">{tr ? "Tümü" : "Any"}</option>{methods.map(method => <option key={method} value={method}>{brewingLabels[method][locale]}</option>)}</select></label>}
        {roasts.length > 0 && <label>{tr ? "Kavurma profili" : "Roast"}<select value={roast ?? ""} onChange={event => { setRoast(event.target.value as ProductDetails["roast"]); setShowResults(false); }}><option value="">{tr ? "Tümü" : "Any"}</option>{roasts.map(roast => <option key={roast} value={roast}>{roastLabels[roast][locale]}</option>)}</select></label>}
        <button className={s.primary}>{tr ? "Kahvelerimi göster" : "Show my coffees"}<span aria-hidden="true">↗</span></button>
      </form>
      {showResults && <div className={s.results} aria-live="polite"><p>{matches.length ? (tr ? `${matches.length} seçenek tercihlerine uyuyor.` : `${matches.length} options match your preferences.`) : (tr ? "Bu tercihlerle eşleşen stokta bir kahve yok. Bir seçimi değiştirerek tekrar dene." : "No in-stock coffees match these preferences. Try changing a selection.")}</p><div className={s.resultGrid}>{matches.map(item => <Link href={productSelectionPath(locale, item, item.product.grindOptions.find(grind => grind.active && grind.code === grindCode)?.id ?? null)} key={item.id} className={s.resultCard}>{item.image && <Image src={item.image} alt={item.imageAlt[locale]} width={110} height={140} />}<div><h3>{item.name[locale]}</h3><p>{variantLabel(item, locale)}</p><strong>{formatPrice(grindCode ? item.priceMinor + (item.product.grindOptions.find(grind => grind.active && grind.code === grindCode)?.priceDeltaMinor ?? 0) : minimumPriceMinor(item), locale)}</strong><p>{detailRows(item.product, locale).map(row => row.value).slice(0,2).join(" · ")}</p></div><span aria-hidden="true">↗</span></Link>)}</div></div>}
    </section>
    <CoffeeSet products={products} locale={locale} cart={customerCart} />
  </div>;
}

function CoffeeSet({ products, locale, cart }: { products: CatalogItem[]; locale: Locale; cart: CustomerCartState }) {
  const tr = locale === "tr";
  const query = useSearchParams();
  const coffees = products.filter(item => item.category === "coffee");
  const thermoses = products.filter(item => item.category === "thermos");
  const coffee = coffees.find(item => item.id === query.get("setCoffee")) ?? coffees.find(item => item.variant.stock > 0) ?? coffees[0];
  const thermos = thermoses.find(item => item.id === query.get("setThermos")) ?? thermoses.find(item => item.variant.stock > 0) ?? thermoses[0];
  const grinds = coffee?.product.grindOptions.filter(grind => grind.active) ?? [];
  const grind = grinds.find(grind => grind.id === query.get("setGrind")) ?? grinds[0] ?? null;
  const [added, setAdded] = useState(false);
  if (!coffee || !thermos) return null;
  const available = [coffee, thermos].every(item => item.variant.stock > (cart.cart?.lines.filter(line => line.variantId === item.id).reduce((sum, line) => sum + line.quantity, 0) ?? 0));
  const total = coffee.priceMinor + (grind?.priceDeltaMinor ?? 0) + thermos.priceMinor;
  function selectionPath(coffeeId: string, thermosId: string, grindId: string | null) {
    const params = new URLSearchParams(query.toString());
    params.set("setCoffee", coffeeId); params.set("setThermos", thermosId);
    if (grindId) params.set("setGrind", grindId); else params.delete("setGrind");
    return `${tr ? "" : "/en"}/alisveris?${params}#kahve-seti`;
  }
  function update(coffeeId: string, thermosId: string, grindId: string | null) { setAdded(false); window.history.replaceState(null, "", selectionPath(coffeeId, thermosId, grindId)); }
  async function add() {
    if (!available || cart.busy) return;
    const success = await cart.mutate("cart/set", "POST", { coffeeVariantId: coffee.id, coffeeGrindId: grind?.id ?? null, thermosVariantId: thermos.id });
    if (success) setAdded(true);
  }
  return <section className={s.set} id="kahve-seti" aria-labelledby="set-title">
    <div className={s.setArt}><span className={s.setWord} aria-hidden="true">{tr ? "SENİN" : "YOUR"}<br/>{tr ? "RİTÜELİN." : "RITUAL."}</span>{[coffee,thermos].map(item => <div key={item.category} className={s.setProduct}>{item.image && <Image src={item.image} alt={item.imageAlt[locale]} fill sizes="(max-width:760px) 42vw, 250px" />}</div>)}</div>
    <div className={s.setCopy}><p className={s.eyebrow}>{tr ? "KAHVE + TERMOS" : "COFFEE + THERMOS"}</p><h2 id="set-title">{tr ? "Ritüelini bir araya getir." : "Put your ritual together."}</h2><p>{tr ? "Bir paket kahve, bir termos. Sevdiğin ikiliyi seç; iki ürün birlikte sepetine eklensin." : "One pack of coffee, one thermos. Choose your pair and add both products to your bag."}</p>
      <div className={s.setFields}><label>{tr ? "Paket kahven" : "Your coffee"}<select disabled={cart.busy} value={coffee.id} onChange={event => update(event.target.value, thermos.id, null)}>{coffees.map(item => <option value={item.id} key={item.id}>{item.name[locale]} · {variantLabel(item,locale)}{item.variant.stock ? "" : (tr ? " — Tükendi" : " — Sold out")}</option>)}</select></label>
      {grinds.length > 0 && <label>{tr ? "Öğütüm" : "Grind"}<select disabled={cart.busy} value={grind?.id ?? ""} onChange={event => update(coffee.id, thermos.id, event.target.value)}>{grinds.map(grind => <option key={grind.id} value={grind.id}>{tr ? grind.nameTr : grind.nameEn}{grind.priceDeltaMinor ? ` (+${formatPrice(grind.priceDeltaMinor,locale)})` : ""}</option>)}</select></label>}
      <label>{tr ? "Termosun" : "Your thermos"}<select disabled={cart.busy} value={thermos.id} onChange={event => update(coffee.id,event.target.value,grind?.id ?? null)}>{thermoses.map(item => <option key={item.id} value={item.id}>{item.name[locale]} · {variantLabel(item,locale)}{item.variant.stock ? "" : (tr ? " — Tükendi" : " — Sold out")}</option>)}</select></label></div>
      <div className={s.total}><span>{tr ? "İki ürün toplamı" : "Total for both products"}</span><strong>{formatPrice(total, locale)}</strong></div>
      {cart.status === "guest" && available ? <Link className={s.primary} href={loginForSelection(locale, selectionPath(coffee.id,thermos.id,grind?.id ?? null))}>{tr ? "Giriş yap ve setine devam et" : "Sign in to continue with your set"}<span>↗</span></Link> : <button className={s.primary} disabled={cart.busy || cart.status === "loading" || (!available && cart.status !== "error")} onClick={() => cart.status === "error" ? void cart.refresh() : void add()}>{cart.busy ? (tr ? "Ekleniyor…" : "Adding…") : cart.status === "loading" ? (tr ? "Yükleniyor…" : "Loading…") : cart.status === "error" ? (tr ? "Yeniden dene" : "Retry") : !available ? (tr ? "Seçilen adetler stokta yok" : "Selected quantities unavailable") : (tr ? "İkisini sepete ekle" : "Add both to bag")}<span>+</span></button>}
      {added && <p className={s.feedback} role="status">{tr ? "İki ürün sepetine eklendi. " : "Both products are in your bag. "}<Link href={cartPath(locale)}>{tr ? "Sepetime git →" : "View bag →"}</Link></p>}
      {cart.error != null && <p role="alert">{commerceError(cart.error,locale)}</p>}
      <p className={s.note}>{tr ? "Ürünler ayrı ayrı fiyatlandırılır. Sepette her ürün için bir adet yer alır." : "Products are priced separately. Your bag will contain one of each."}</p>
    </div>
  </section>;
}
