"use client";

import Image from "next/image";
import Link from "next/link";
import { accountPath } from "@/lib/customer-account";
import { cartPath, commerceError } from "@/lib/web-commerce";
import { useCustomerCart } from "@/components/commerce/use-customer-cart";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatPrice,
  catalogItems,
  variantLabel,
  minimumPriceMinor,
  type CatalogCategory,
  type CatalogItem,
  type CatalogResult,
} from "../../lib/catalog";
import type { Locale } from "../../lib/site";
import styles from "./shop-content.module.css";

const copy = {
  tr: {
    eyebrow: "DOSSO DOSSI ONLINE MAĞAZA",
    hero: "Her anına\nbir renk.",
    heroCaption: "KAHVENİZ. SİZİN RENGİNİZ.",
    thermosEyebrow: "HEP YANINIZDA",
    intro: "Kahveniz, tarzınız, ritüeliniz.\nDosso Dossi her anınızda sizinle.",
    explore: "KOLEKSİYONU KEŞFET",
    categories: "KENDİ RİTÜELİNİ BUL",
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
    editorialTitle: "İyi bir kahve.\nSize ait bir an.",
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
    categories: "FIND YOUR OWN RITUAL",
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
    editorialTitle: "Good coffee.\nA moment of your own.",
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    products.find((product) => product.id === selectedId) ?? null;
  const variants = products.filter(
    (product) => product.product.id === selected?.product.id,
  );
  const [grindId, setGrindId] = useState<string | null>(null);
  const grinds =
    selected?.product.grindOptions.filter((grind) => grind.active) ?? [];
  const selectedGrind =
    grinds.find((grind) => grind.id === grindId) ?? grinds[0] ?? null;
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const galleryImage = selected?.product.images.find(
    (image) => image.id === galleryId,
  );
  const [quantity, setQuantity] = useState(1);
  const {
    cart,
    status: cartStatus,
    busy: cartBusy,
    error: cartError,
    refresh: refreshCart,
    mutate,
  } = useCustomerCart(false);
  const [announcement, setAnnouncement] = useState("");
  const detailRef = useRef<HTMLDialogElement>(null);
  const cartCount = cart?.itemCount ?? 0;
  const skuQuantity = selected
    ? (cart?.lines ?? [])
        .filter((line) => line.variantId === selected.id)
        .reduce((sum, line) => sum + line.quantity, 0)
    : 0;
  const liveStock = selected?.variant.stock ?? 0;
  const sameOptionQuantity =
    cart?.lines.find(
      (line) =>
        line.variantId === selected?.id &&
        line.grindId === (selectedGrind?.id ?? null),
    )?.quantity ?? 0;
  const remaining = Math.max(
    0,
    Math.min(liveStock - skuQuantity, 99 - sameOptionQuantity),
  );
  const selectedQuantity = Math.min(
    quantity,
    Math.max(1, Math.min(99, remaining)),
  );
  const selectedPrice = selected
    ? selected.priceMinor + (selectedGrind?.priceDeltaMinor ?? 0)
    : 0;

  useEffect(() => {
    const query = new URLSearchParams(queryString);
    const queryCategory = query.get("category");
    setCategory(
      queryCategory === "coffee" || queryCategory === "thermos"
        ? queryCategory
        : "all",
    );
    setSearch(query.get("q") ?? "");
  }, [queryString]);

  useEffect(() => {
    const candidates = products.filter(
      (item) =>
        item.product.id === productQuery ||
        item.product.slug === productQuery ||
        item.id === productQuery,
    );
    setQuantity(1);
    setGrindId(null);
    setGalleryId(null);
    setSelectedId(
      (candidates.find((item) => item.id === variantQuery) ?? candidates[0])
        ?.id ?? null,
    );
  }, [productQuery, variantQuery, products]);

  useEffect(() => {
    const dialog = detailRef.current;
    if (selected && dialog && !dialog.open) dialog.showModal();
    if (!selected && dialog?.open) dialog.close();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);

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
  function openProduct(product: CatalogItem) {
    setQuantity(1);
    setGrindId(null);
    setGalleryId(null);
    setSelectedId(product.id);
  }
  function chooseVariant(product: CatalogItem) {
    setQuantity(1);
    setGalleryId(null);
    setSelectedId(product.id);
  }
  function closeProduct() {
    setSelectedId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("product");
    url.searchParams.delete("variant");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  async function addToCart(product: CatalogItem) {
    if (!remaining || cartBusy) return;
    const added = await mutate("cart/items", "POST", {
      variantId: product.id,
      grindId: selectedGrind?.id ?? null,
      quantity: selectedQuantity,
    });
    if (added) {
      setAnnouncement(
        `${product.name[locale]} · ${variantLabel(product, locale)} ${t.added}`,
      );
      closeProduct();
    }
  }

  return (
    <div className={styles.shop}>
      <div className={styles.container}>
        <section className={styles.hero} aria-labelledby="shop-heading">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 id="shop-heading">{t.hero}</h1>
            <p className={styles.heroIntro}>{t.intro}</p>
            <a
              className={styles.heroLink}
              href="#katalog"
              onClick={() => updateFilters("thermos", "")}
            >
              {t.explore}
              <Arrow />
            </a>
          </div>
          <div className={styles.heroVisual} aria-hidden="true">
            <span className={styles.heroHalo} />
            {["orange", "cream", "pink", "green"].map((color, index) => (
              <div
                key={color}
                className={`${styles.heroBottle} ${styles[`bottle${index}`]}`}
              >
                <Image
                  src={`/images/products/thermos-${color}.webp`}
                  alt=""
                  fill
                  sizes="(max-width: 700px) 24vw, 15vw"
                  loading="eager"
                />
              </div>
            ))}
            <span className={styles.heroCaption}>{t.heroCaption}</span>
          </div>
        </section>

        <section
          className={styles.categorySection}
          aria-labelledby="categories-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="categories-title">{t.categories}</h2>
            <span>01 / 02</span>
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
                onChange={(event) => setSort(event.target.value)}
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
                <article className={styles.productCard} key={product.id}>
                  <button
                    className={styles.productPhoto}
                    onClick={() => openProduct(product)}
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
                  </button>
                  <div className={styles.productInfo}>
                    <p>{variantLabel(product, locale)}</p>
                    <h3>
                      <button onClick={() => openProduct(product)}>
                        {product.name[locale]}
                      </button>
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
                    <button
                      className={styles.productAction}
                      onClick={() => openProduct(product)}
                    >
                      {t.view}
                      <span>+</span>
                    </button>
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
      </div>

      <section
        className={styles.editorial}
        aria-labelledby="shop-editorial-heading"
      >
        <div className={`${styles.container} ${styles.editorialInner}`}>
          <div className={styles.editorialImage}>
            <Image
              src="/images/editorial/coffee-beans.webp"
              alt=""
              fill
              sizes="(max-width: 700px) 45vw, 450px"
            />
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

      <div className={styles.announcement} role="status" aria-live="polite">
        {announcement && (
          <>
            <Bag />
            <span>
              {announcement}{" "}
              <Link href={cartPath(locale)} className={styles.announcementLink}>
                {t.viewCart} →
              </Link>
            </span>
            <button aria-label={t.close} onClick={() => setAnnouncement("")}>
              ×
            </button>
          </>
        )}
      </div>

      <dialog
        ref={detailRef}
        className={styles.productDialog}
        aria-labelledby="product-dialog-title"
        onClose={closeProduct}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeProduct();
        }}
      >
        {selected && (
          <>
            <button
              className={styles.closeDialog}
              onClick={closeProduct}
              aria-label={t.close}
            >
              ×
            </button>
            <div className={styles.dialogLayout}>
              <div className={styles.dialogGallery}>
                <div className={styles.dialogImage}>
                  {galleryImage?.url || selected.image ? (
                    <Image
                      src={galleryImage?.url ?? selected.image!}
                      alt={
                        galleryImage
                          ? (locale === "tr"
                              ? galleryImage.altTr
                              : galleryImage.altEn) || selected.name[locale]
                          : selected.imageAlt[locale]
                      }
                      fill
                      sizes="(max-width: 700px) 70vw, 380px"
                    />
                  ) : (
                    <span className={styles.noImage}>{t.noImage}</span>
                  )}
                </div>
                {selected.product.images.length > 1 && (
                  <div
                    className={styles.galleryThumbs}
                    role="group"
                    aria-label={t.gallery}
                  >
                    {selected.product.images.map((image, index) => (
                      <button
                        key={image.id}
                        onClick={() => setGalleryId(image.id)}
                        aria-label={`${t.gallery} ${index + 1}`}
                        aria-pressed={
                          galleryImage
                            ? galleryImage.id === image.id
                            : selected.image === image.url
                        }
                      >
                        <Image src={image.url} alt="" fill sizes="64px" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.dialogInfo}>
                <p className={styles.eyebrow}>{t.productDetail}</p>
                <h2 id="product-dialog-title">{selected.name[locale]}</h2>
                <p className={styles.dialogPrice}>
                  {formatPrice(selectedPrice, locale)}
                </p>
                <p className={styles.description}>
                  {selected.description[locale]}
                </p>
                {variants.some((item) => item.color?.hex) && (
                  <fieldset className={styles.options}>
                    <legend>
                      {t.color}: <span>{selected.color?.[locale]}</span>
                    </legend>
                    <div className={styles.swatches}>
                      {variants
                        .filter(
                          (item, index, all) =>
                            item.color &&
                            all.findIndex(
                              (other) =>
                                other.color?.tr === item.color?.tr &&
                                other.color?.en === item.color?.en,
                            ) === index,
                        )
                        .map((item) => (
                          <button
                            key={item.id}
                            aria-label={item.color?.[locale]}
                            aria-pressed={
                              item.color?.tr === selected.color?.tr &&
                              item.color?.en === selected.color?.en
                            }
                            style={{
                              backgroundColor: item.color?.hex ?? undefined,
                            }}
                            onClick={() =>
                              chooseVariant(
                                variants.find(
                                  (candidate) =>
                                    candidate.color?.tr === item.color?.tr &&
                                    candidate.color?.en === item.color?.en &&
                                    candidate.size === selected.size,
                                ) ?? item,
                              )
                            }
                          />
                        ))}
                    </div>
                  </fieldset>
                )}
                <label className={styles.grindLabel}>
                  {selected.category === "coffee" ? t.weight : t.variant}
                  <select
                    value={selected.id}
                    onChange={(event) => {
                      const item = variants.find(
                        (item) => item.id === event.target.value,
                      );
                      if (item) chooseVariant(item);
                    }}
                  >
                    {variants.map((item) => (
                      <option key={item.id} value={item.id}>
                        {variantLabel(item, locale)}
                        {item.variant.stock === 0 ? ` — ${t.soldOut}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selected.category === "coffee" && grinds.length > 0 && (
                  <label className={styles.grindLabel}>
                    {t.grind}
                    <select
                      value={selectedGrind?.id ?? ""}
                      onChange={(event) => setGrindId(event.target.value)}
                    >
                      {grinds.map((grind) => (
                        <option key={grind.id} value={grind.id}>
                          {locale === "tr" ? grind.nameTr : grind.nameEn}
                          {grind.priceDeltaMinor
                            ? ` (+${formatPrice(grind.priceDeltaMinor, locale)})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className={styles.stockNote} aria-live="polite">
                  {liveStock === 0 ? t.soldOut : `${t.stock}: ${liveStock}`}
                  {liveStock > 0 && remaining === 0 ? ` · ${t.stockLimit}` : ""}
                </p>
                <div className={styles.addRow}>
                  <div className={styles.quantity}>
                    <button
                      onClick={() =>
                        setQuantity(Math.max(1, selectedQuantity - 1))
                      }
                      disabled={cartBusy || selectedQuantity <= 1 || !remaining}
                      aria-label={t.minus}
                    >
                      −
                    </button>
                    <span aria-label={t.quantity}>{selectedQuantity}</span>
                    <button
                      onClick={() =>
                        setQuantity((current) =>
                          Math.min(99, remaining, current + 1),
                        )
                      }
                      disabled={
                        cartBusy || selectedQuantity >= Math.min(99, remaining)
                      }
                      aria-label={t.plus}
                    >
                      +
                    </button>
                  </div>
                  {cartStatus === "guest" && remaining > 0 ? (
                    <Link
                      className={styles.addButton}
                      href={accountPath(locale)}
                    >
                      {t.login}
                      <Bag />
                    </Link>
                  ) : (
                    <button
                      className={styles.addButton}
                      onClick={() =>
                        cartStatus === "error"
                          ? void refreshCart()
                          : void addToCart(selected)
                      }
                      disabled={
                        cartBusy ||
                        cartStatus === "loading" ||
                        (!remaining && cartStatus !== "error")
                      }
                    >
                      {cartBusy
                        ? t.updating
                        : cartStatus === "loading"
                          ? t.loading
                          : cartStatus === "error"
                            ? t.retry
                            : liveStock === 0
                              ? t.soldOut
                              : t.add}
                      <Bag />
                    </button>
                  )}
                </div>
                {Boolean(cartError) && (
                  <p className={styles.cartError} role="alert">
                    {commerceError(cartError, locale)}
                  </p>
                )}
                <p className={styles.dialogPreview}>{t.preview}</p>
              </div>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
