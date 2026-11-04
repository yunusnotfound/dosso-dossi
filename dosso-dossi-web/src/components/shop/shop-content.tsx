"use client";

import Image from "next/image";
import Link from "next/link";
import { cartPath } from "@/lib/web-commerce";
import { useCustomerCart } from "@/components/commerce/use-customer-cart";
import { useRouter, useSearchParams } from "next/navigation";
import { productSelectionPath } from "@/lib/product-helpers";
import { ShopDiscovery } from "./shop-discovery";
import { ProductComparison } from "./product-comparison";
import { useEffect, useMemo, useState } from "react";
import {
  formatPrice,
  catalogItems,
  variantLabel,
  minimumPriceMinor,
  type CatalogCategory,
  type CatalogResult,
} from "../../lib/catalog";
import type { Locale } from "../../lib/site";
import { ShopHero } from "./shop-showcase";
import styles from "./shop-content.module.css";

const copy = {
  tr: {
    eyebrow: "DOSSO DOSSI ONLINE MAĞAZA",
    hero: "Her anına\nbir renk.",
    heroCaption: "KAHVENİZ. SİZİN RENGİNİZ.",
    thermosEyebrow: "HEP YANINIZDA",
    intro: "Kahveniz, tarzınız, ritüeliniz.\nDosso Dossi her anınızda sizinle.",
    explore: "KOLEKSİYONU KEŞFET",
    categories: "SENİN GÜNÜN. SENİN SEÇİMİN.",
    coffee: "Kahveler",
    coffeeNote: "Bir fincandan çok daha fazlası.",
    thermos: "Termoslar",
    thermosNote: "Kahveniz hep sizinle.",
    collection: "DOSSO DOSSI SEÇKİSİ",
    allProducts: "TÜM ÜRÜNLER",
    all: "Tümü",
    search: "Ürün ara",
    sort: "Sıralama",
    recommended: "Önerilen sıralama",
    priceAsc: "Fiyat: düşükten yükseğe",
    priceDesc: "Fiyat: yüksekten düşüğe",
    name: "Ürün adı: A–Z",
    count: "ürün",
    view: "ÜRÜNÜ İNCELE",
    preview: "Sepetiniz hesabınızda saklanır · Henüz sipariş alınmamaktadır.",
    noResults: "Aradığınız ürün burada görünmüyor.",
    noResultsText: "Başka bir kelime deneyin veya tüm koleksiyonu keşfedin.",
    clear: "Filtreleri temizle",
    cart: "Sepetim",
    bag: "SEPETİM",
    close: "Kapat",
    add: "SEPETE EKLE",
    login: "SEPETE EKLEMEK İÇİN GİRİŞ YAP",
    loading: "YÜKLENİYOR…",
    updating: "EKLENİYOR…",
    viewCart: "Sepete git",
    added: "sepetinize eklendi.",
    remove: "Kaldır",
    quantity: "Adet",
    minus: "Adedi azalt",
    plus: "Adedi artır",
    total: "Ürünler toplamı",
    empty: "Kahve molanız için bir şeyler seçin.",
    emptyText: "Beğendiğiniz ürünleri burada bir araya getirebilirsiniz.",
    shop: "Ürünleri keşfet",
    soon: "Satışlar yakında başlayacak.",
    unavailable: "Ürünler şu anda yüklenemiyor.",
    retry: "Yeniden dene",
    catalogEmpty: "Yeni koleksiyonumuz hazırlanıyor.",
    soldOut: "Tükendi",
    stock: "Stok",
    stockLimit: "Bu seçenek için eklenebilecek adede ulaştınız.",
    noImage: "Görsel hazırlanıyor",
    variant: "Renk / hacim",
    gallery: "Ürün görselleri",
    weight: "Gramaj",
    grind: "Öğütüm",
    color: "Renk",
    capacity: "Hacim",
    productDetail: "ÜRÜN DETAYI",
    editorialLabel: "HER GÜN, YENİ BİR RİTÜEL",
    editorialTitle: "İYİ BİR KAHVE.\nSANA AİT BİR AN.",
    editorialText:
      "Güne başlarken, kısa bir mola verirken ya da sevdiklerinizle aynı masada. Dosso Dossi ile kahvenin etrafında buluşun.",
    editorialLink: "Kahveleri keşfet",
    cartStrip: "Kendi seçkinizi oluşturun.",
    cartStripText: "Sevdiğiniz kahveler ve size eşlik eden renkler.",
  },
  en: {
    eyebrow: "DOSSO DOSSI ONLINE SHOP",
    hero: "A colour for\nevery moment.",
    heroCaption: "YOUR COFFEE. YOUR COLOUR.",
    thermosEyebrow: "TAKE IT WITH YOU",
    intro:
      "Your coffee, your style, your ritual.\nTake Dosso Dossi along for every moment.",
    explore: "EXPLORE THE COLLECTION",
    categories: "YOUR DAY. YOUR WAY.",
    coffee: "Coffee",
    coffeeNote: "More than just a cup.",
    thermos: "Thermoses",
    thermosNote: "Your coffee, wherever you go.",
    collection: "THE DOSSO DOSSI COLLECTION",
    allProducts: "ALL PRODUCTS",
    all: "All",
    search: "Search products",
    sort: "Sort by",
    recommended: "Recommended",
    priceAsc: "Price: low to high",
    priceDesc: "Price: high to low",
    name: "Product name: A–Z",
    count: "products",
    view: "VIEW PRODUCT",
    preview:
      "Your bag stays in your account · Orders are not being accepted yet.",
    noResults: "We couldn’t find that one.",
    noResultsText: "Try another search or explore the complete collection.",
    clear: "Clear filters",
    cart: "My bag",
    bag: "MY BAG",
    close: "Close",
    add: "ADD TO BAG",
    login: "SIGN IN TO ADD TO BAG",
    loading: "LOADING…",
    updating: "ADDING…",
    viewCart: "View bag",
    added: "added to your bag.",
    remove: "Remove",
    quantity: "Quantity",
    minus: "Decrease quantity",
    plus: "Increase quantity",
    total: "Product subtotal",
    empty: "Make a little room for a coffee break.",
    emptyText: "Bring your favourite products together here.",
    shop: "Explore products",
    soon: "Shopping will be available soon.",
    unavailable: "Products could not be loaded.",
    retry: "Try again",
    catalogEmpty: "Our new collection is on its way.",
    soldOut: "Out of stock",
    stock: "Stock",
    stockLimit: "You have reached the available quantity for this option.",
    noImage: "Image coming soon",
    variant: "Colour / capacity",
    gallery: "Product images",
    weight: "Weight",
    grind: "Grind",
    color: "Colour",
    capacity: "Capacity",
    productDetail: "PRODUCT DETAILS",
    editorialLabel: "EVERY DAY, A NEW RITUAL",
    editorialTitle: "GOOD COFFEE.\nYOUR OWN MOMENT.",
    editorialText:
      "As the day begins, on a short break, or around a table with your favourite people. Come together over Dosso Dossi coffee.",
    editorialLink: "Explore coffee",
    cartStrip: "Make it your own collection.",
    cartStripText: "Your favourite coffee and a little colour to take along.",
  },
} as const;

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12h15m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Bag() {
  return (
    <svg
      width="21"
      height="23"
      viewBox="0 0 24 26"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 8h16l1 15H3L4 8Z" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 9V6a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
function Search() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ShopContent({
  locale,
  catalog,
}: {
  locale: Locale;
  catalog: CatalogResult;
}) {
  const t = copy[locale];
  const router = useRouter();
  const [comparison, setComparison] = useState<string[]>([]);
  const products = useMemo(
    () => catalogItems(catalog.products),
    [catalog.products],
  );
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const productQuery = searchParams.get("product");
  const variantQuery = searchParams.get("variant");
  const initialCategory = searchParams.get("category");
  const [category, setCategory] = useState<CatalogCategory | "all">(
    initialCategory === "coffee" || initialCategory === "thermos"
      ? initialCategory
      : "all",
  );
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState("recommended");
  const customerCart = useCustomerCart(false);
  const { cart, status: cartStatus } = customerCart;
  const cartCount = cart?.itemCount ?? 0;
  useEffect(() => {
    const query = new URLSearchParams(queryString);
    const queryCategory = query.get("category");
    setCategory(queryCategory === "coffee" || queryCategory === "thermos" ? queryCategory : "all");
    setSearch(query.get("q") ?? "");
    const sort = query.get("sort");
    setSort(["price-asc", "price-desc", "name"].includes(sort ?? "") ? sort! : "recommended");
  }, [queryString]);
  useEffect(() => {
    if (!productQuery) return;
    const candidates = products.filter(item => item.product.id === productQuery || item.product.slug === productQuery || item.id === productQuery);
    const item = candidates.find(item => item.id === variantQuery) ?? candidates[0];
    if (item) {
      const query = new URLSearchParams(queryString);
      const amount = Number(query.get("quantity") ?? 1);
      router.replace(productSelectionPath(locale, item, query.get("grind"), Number.isSafeInteger(amount) && amount > 0 ? amount : 1));
    }
  }, [products, productQuery, variantQuery, queryString, locale, router]);

  const filtered = useMemo(() => {
    const term = search.toLocaleLowerCase(locale).trim();
    const list = products.filter((product) => {
      const matchesCategory =
        category === "all" || product.category === category;
      const label = `${product.name[locale]} ${variantLabel(product, locale)} ${product.variant.sku}`;
      return matchesCategory && label.toLocaleLowerCase(locale).includes(term);
    });
    if (sort === "price-asc")
      list.sort((a, b) => minimumPriceMinor(a) - minimumPriceMinor(b));
    if (sort === "price-desc")
      list.sort((a, b) => minimumPriceMinor(b) - minimumPriceMinor(a));
    if (sort === "name")
      list.sort((a, b) =>
        `${a.name[locale]} ${a.color?.[locale] ?? ""}`.localeCompare(
          `${b.name[locale]} ${b.color?.[locale] ?? ""}`,
          locale,
        ),
      );
    return list;
  }, [category, search, sort, locale, products]);

  function updateFilters(value: CatalogCategory | "all", term: string) {
    setCategory(value);
    setSearch(term);
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", value);
    if (term) url.searchParams.set("q", term);
    else url.searchParams.delete("q");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  function chooseCategory(value: CatalogCategory | "all") {
    updateFilters(value, "");
    document.getElementById("katalog")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <div className={styles.shop}>
      <ShopHero locale={locale} onExplore={() => chooseCategory("all")} />
      <div className={styles.container}>
        <section
          className={styles.categorySection}
          aria-labelledby="categories-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="categories-title">{t.categories}</h2>
            <span>{locale === "tr" ? "KÜÇÜK RİTÜELLER, BÜYÜK KEYİFLER." : "LITTLE RITUALS. GREAT MOMENTS."}</span>
          </div>
          <div className={styles.categories}>
            <button
              className={`${styles.categoryCard} ${styles.coffeeCategory}`}
              onClick={() => chooseCategory("coffee")}
            >
              <span>
                <small>DOSSO DOSSI COFFEE</small>
                <strong>{t.coffee}</strong>
                <em>{t.coffeeNote}</em>
                <Arrow />
              </span>
              <div className={styles.categoryCoffeeImage}>
                <Image
                  src="/images/products/turkish-coffee-250.webp"
                  alt=""
                  fill
                  sizes="(max-width: 600px) 25vw, 160px"
                />
              </div>
            </button>
            <button
              className={`${styles.categoryCard} ${styles.thermosCategory}`}
              onClick={() => chooseCategory("thermos")}
            >
              <span>
                <small>{t.thermosEyebrow}</small>
                <strong>{t.thermos}</strong>
                <em>{t.thermosNote}</em>
                <Arrow />
              </span>
              <div className={styles.categoryThermosImage}>
                <Image
                  src="/images/products/thermos-orange.webp"
                  alt=""
                  fill
                  sizes="(max-width: 600px) 18vw, 95px"
                />
              </div>
              <div className={styles.categoryThermosSecond}>
                <Image
                  src="/images/products/thermos-cream.webp"
                  alt=""
                  fill
                  sizes="(max-width: 600px) 18vw, 95px"
                />
              </div>
            </button>
          </div>
        </section>

        <section
          id="katalog"
          className={styles.catalog}
          aria-labelledby="catalog-heading"
        >
          <div className={styles.catalogHeading}>
            <div>
              <p className={styles.eyebrow}>{t.collection}</p>
              <h2 id="catalog-heading">{t.allProducts}</h2>
            </div>
            <span className={styles.productCount} aria-live="polite">
              {filtered.length} {t.count}
            </span>
          </div>
          <div className={styles.toolbar}>
            <div
              className={styles.filters}
              role="group"
              aria-label={t.categories}
            >
              {(["all", "coffee", "thermos"] as const).map((value) => (
                <button
                  key={value}
                  className={category === value ? styles.activeFilter : ""}
                  aria-pressed={category === value}
                  onClick={() => updateFilters(value, search)}
                >
                  {value === "all" ? t.all : t[value]}
                </button>
              ))}
            </div>
            <div className={styles.tools}>
              <label className={styles.search}>
                <Search />
                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    updateFilters(category, event.target.value)
                  }
                  placeholder={t.search}
                  aria-label={t.search}
                />
              </label>
              <select
                value={sort}
                onChange={(event) => {
                    setSort(event.target.value);
                    const url = new URL(window.location.href);
                    if (event.target.value === "recommended") url.searchParams.delete("sort"); else url.searchParams.set("sort", event.target.value);
                    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
                  }}
                aria-label={t.sort}
              >
                <option value="recommended">{t.recommended}</option>
                <option value="price-asc">{t.priceAsc}</option>
                <option value="price-desc">{t.priceDesc}</option>
                <option value="name">{t.name}</option>
              </select>
              <Link className={styles.cartButton} href={cartPath(locale)}>
                <Bag />
                <span>
                  {t.cart}
                  {cartStatus === "ready" ? ` (${cartCount})` : ""}
                </span>
              </Link>
            </div>
          </div>
          <p className={styles.previewNote}>{t.preview}</p>
          {!catalog.available ? (
            <div className={styles.emptySearch} role="status">
              <h3>{t.unavailable}</h3>
              <button onClick={() => window.location.reload()}>
                {t.retry}
                <Arrow />
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className={styles.emptySearch}>
              <h3>{t.catalogEmpty}</h3>
            </div>
          ) : filtered.length ? (
            <div className={styles.productGrid}>
              {filtered.map((product) => (
                <article className={`${styles.productCard} ${product.category === "coffee" ? styles.coffeeCard : styles.thermosCard}`} key={product.id}>
                  <Link
                    className={styles.productPhoto}
                    href={productSelectionPath(locale, product)}
                    aria-label={`${t.view}: ${product.name[locale]} ${product.color?.[locale] ?? ""} ${product.size}`}
                  >
                    <span className={styles.productTag}>
                      {product.category === "coffee"
                        ? t.coffee
                        : product.color?.[locale]}
                    </span>
                    {product.image ? (
                      <Image
                        className={
                          product.category === "coffee"
                            ? styles.coffeeProduct
                            : styles.thermosProduct
                        }
                        src={product.image}
                        alt={product.imageAlt[locale]}
                        fill
                        sizes="(max-width: 700px) 45vw, (max-width: 1000px) 30vw, 290px"
                      />
                    ) : (
                      <span className={styles.noImage}>{t.noImage}</span>
                    )}
                    <span className={styles.photoArrow}>
                      <Arrow />
                    </span>
                  </Link>
                  <div className={styles.productInfo}>
                    <p>{variantLabel(product, locale)}</p>
                    <h3>
                      <Link href={productSelectionPath(locale, product)}>{product.name[locale]}</Link>
                    </h3>
                    <div className={styles.priceRow}>
                      <strong>
                        {formatPrice(minimumPriceMinor(product), locale)}
                      </strong>
                      {product.color && (
                        <span
                          className={styles.colorDot}
                          style={{
                            backgroundColor: product.color.hex ?? undefined,
                          }}
                        />
                      )}
                    </div>
                    {product.variant.stock === 0 && (
                      <p className={styles.stockNote}>{t.soldOut}</p>
                    )}
                    <Link className={styles.productAction} href={productSelectionPath(locale, product)}>
                      {t.view}
                      <span>+</span>
                    </Link>
                    <label className={styles.compareChoice}><input type="checkbox" checked={comparison.includes(product.id)} disabled={!comparison.includes(product.id) && comparison.length >= 3} onChange={event => setComparison(current => event.target.checked ? [...current, product.id].slice(0,3) : current.filter(id => id !== product.id))} />{locale === "tr" ? "Karşılaştır" : "Compare"}</label>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptySearch}>
              <Search />
              <h3>{t.noResults}</h3>
              <p>{t.noResultsText}</p>
              <button
                onClick={() => {
                  updateFilters("all", "");
                  setSort("recommended");
                }}
              >
                {t.clear}
                <Arrow />
              </button>
            </div>
          )}
        </section>
        <ProductComparison locale={locale} items={products.filter(item => comparison.includes(item.id))} onRemove={id => setComparison(current => current.filter(item => item !== id))} />
      </div>

      <ShopDiscovery locale={locale} products={products} customerCart={customerCart} />

      <section
        className={styles.editorial}
        aria-labelledby="shop-editorial-heading"
      >
        <div className={`${styles.container} ${styles.editorialInner}`}>
          <div className={styles.editorialImage}>
            <span className={styles.editorialWord} aria-hidden="true">COFFEE</span>
            <Image
              src="/images/products/turkish-coffee-250.webp"
              alt=""
              fill
              sizes="(max-width: 700px) 45vw, 450px"
            />
            <span className={styles.editorialImageCaption}>THE ART OF A GOOD MOMENT.</span>
          </div>
          <div className={styles.editorialCopy}>
            <p className={styles.eyebrow}>{t.editorialLabel}</p>
            <h2 id="shop-editorial-heading">{t.editorialTitle}</h2>
            <p>{t.editorialText}</p>
            <button onClick={() => chooseCategory("coffee")}>
              {t.editorialLink}
              <Arrow />
            </button>
          </div>
        </div>
      </section>

      <section
        className={`${styles.container} ${styles.cartStrip}`}
        id="sepet"
        aria-labelledby="bag-heading"
      >
        <div>
          <h2 id="bag-heading">{t.cartStrip}</h2>
          <p>{t.cartStripText}</p>
        </div>
        <Link className={styles.cartButton} href={cartPath(locale)}>
          <Bag />
          <span>
            {t.cart}
            {cartStatus === "ready" ? ` (${cartCount})` : ""}
          </span>
          <Arrow />
        </Link>
      </section>

    </div>
  );
}
