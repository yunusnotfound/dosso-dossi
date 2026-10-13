"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { catalogItems, variantLabel, type CatalogResult } from "@/lib/catalog";
import { pagePath, type Locale } from "@/lib/site";
import s from "./home-content.module.css";

const copy = {
  tr: {
    heroLabel: "KAHVE. SOHBET. DOSSO DOSSI.",
    heroTitle: "İYİ KAHVE.\nGÜZEL ANLAR.",
    heroText:
      "Günün telaşına küçük bir ara. Sevdiğin kahveye, yeni fikirlere ve uzun sohbetlere yer aç.",
    heroCta: "Dünyamızı keşfet",
    nextLabel: "KAHVENİN RENGİ SANA KALSIN",
    nextTitle: "HER ANINA\nBİR RENK.",
    nextText:
      "En sevdiğin kahve, şimdi sen nereye gidersen orada. Dosso Dossi termos koleksiyonuyla tanış.",
    nextCta: "Koleksiyonu keşfet",
    slide: "Tanıtım",
    prev: "Önceki tanıtım",
    next: "Sonraki tanıtım",
    scroll: "KEŞFETMEYE DEVAM ET",
    collectionLabel: "DOSSO DOSSI, SENİNLE",
    collectionTitle: "KAHVE MOLANI YANINA AL.",
    collectionText:
      "Evde, yolda, günün tam ortasında. Küçük bir molaya ihtiyacın olan her yerde.",
    all: "Tüm ürünleri keşfet",
    inspect: "Ürünü keşfet",
    packaged: "PAKET KAHVE",
    thermos: "TERMOS KOLEKSİYONU",
    storyLabel: "KAHVENİN ETRAFINDA",
    storyTitle: "BİR FİNCANDAN\nDAHA FAZLASI.",
    storyTabs: ["Kahve", "Sanat", "Birlikte"],
    storyTexts: [
      "Dosso Dossi’de kahve, günün bir parçasından fazlası. Her fincan; sohbetlere, yeni fikirlere ve kendine ayırdığın zamana eşlik eden küçük bir ritüel.",
      "İlhamı bir kahve molasında bulabilir misin? Bizce evet. Sanatın, müziğin ve kahvenin bir araya geldiği yaşam alanları yaratmayı seviyoruz.",
      "En güzel anlar paylaştıklarımız. Bazen bir dostla buluşmak, bazen yeni bir yüzle tanışmak için. Dosso Dossi, birlikte olmanın tadını çıkardığımız yer.",
    ],
    storyCta: "Bir kahvede buluşalım",
    storyImage: "Dosso Dossi kahve bardağı ve kahve çekirdekleri",
    locationLabel: "SANA YAKIN BİR DOSSO DOSSI",
    locationTitle: "BİR KAHVEYE\nBEKLERİZ.",
    locationText:
      "Şehrin içinde, sana ait bir mola. Sana en yakın Dosso Dossi’yi keşfet.",
    cityLabel: "Şehir seç",
    allCities: "Tüm şehirler",
    map: "Yol tarifi al",
    menuLabel: "DOSSO DOSSI MENÜ",
    menuTitle: "HER MODUNA\nBİR KAHVE.",
    menuText:
      "Kimi gün sıcacık bir klasik, kimi gün buz gibi bir mola. Bugün senin kahven hangisi?",
    hot: "Sıcak kahveler",
    cold: "Soğuk kahveler",
    menuNote: "Şubelerdeki ürün bulunurluğu değişebilir.",
    menuCta: "En yakın şubeyi bul",
    franchiseLabel: "BİRLİKTE BÜYÜYELİM",
    franchiseTitle: "BU HİKÂYEYE\nSEN DE KATIL.",
    franchiseText:
      "Kahveye duyduğumuz tutkuyu yeni şehirlere, yeni buluşmalara taşıyalım. Dosso Dossi franchising dünyasını birlikte keşfedelim.",
    franchiseCta: "Birlikte konuşalım",
    collectionNote:
      "Online mağazamızın önizlemesini keşfedin. Henüz sipariş alınmamaktadır.",
    coffeeAlt: "Kahveye süt dökerek latte sanatı hazırlayan barista",
    cupAlt: "Dosso Dossi kahve bardağı",
    coldAlt: "Dosso Dossi soğuk içecekleri",
  },
  en: {
    heroLabel: "COFFEE. CONVERSATION. DOSSO DOSSI.",
    heroTitle: "GOOD COFFEE.\nGREAT MOMENTS.",
    heroText:
      "A little pause in a busy day. Make room for your favourite coffee, fresh ideas and conversations that linger.",
    heroCta: "Explore our world",
    nextLabel: "COLOUR YOUR COFFEE BREAK",
    nextTitle: "A COLOUR FOR\nEVERY MOMENT.",
    nextText:
      "Your favourite coffee, wherever you go. Meet the Dosso Dossi thermos collection.",
    nextCta: "Explore the collection",
    slide: "Feature",
    prev: "Previous feature",
    next: "Next feature",
    scroll: "THERE’S MORE TO DISCOVER",
    collectionLabel: "TAKE DOSSO DOSSI WITH YOU",
    collectionTitle: "YOUR COFFEE BREAK, TO GO.",
    collectionText:
      "At home, on the move, in the middle of your day. Wherever you need a little moment to yourself.",
    all: "Explore all products",
    inspect: "Explore product",
    packaged: "PACKAGED COFFEE",
    thermos: "THERMOS COLLECTION",
    storyLabel: "GATHER AROUND COFFEE",
    storyTitle: "MORE THAN\nA CUP OF COFFEE.",
    storyTabs: ["Coffee", "Art", "Together"],
    storyTexts: [
      "At Dosso Dossi, coffee is more than part of the day. Every cup is a small ritual, made for good conversations, new ideas and a little time for yourself.",
      "Can inspiration begin with a coffee break? We think so. We love creating spaces where art, music and coffee come together.",
      "Our favourite moments are the ones we share. Catching up with a friend, meeting someone new. Dosso Dossi is a place to enjoy being together.",
    ],
    storyCta: "Let’s meet over coffee",
    storyImage: "Dosso Dossi coffee cup with coffee beans",
    locationLabel: "FIND YOUR DOSSO DOSSI",
    locationTitle: "COME OVER\nFOR COFFEE.",
    locationText:
      "A moment of your own, right in the city. Find a Dosso Dossi near you.",
    cityLabel: "Select a city",
    allCities: "All cities",
    map: "Get directions",
    menuLabel: "THE DOSSO DOSSI MENU",
    menuTitle: "A COFFEE FOR\nEVERY MOOD.",
    menuText:
      "Some days call for a comforting classic. Others, a refreshing pause. What’s your coffee today?",
    hot: "Hot coffees",
    cold: "Iced coffees",
    menuNote: "Product availability may vary by location.",
    menuCta: "Find your nearest location",
    franchiseLabel: "LET’S GROW TOGETHER",
    franchiseTitle: "BE PART OF\nOUR STORY.",
    franchiseText:
      "Let’s take our love of coffee to new cities and new conversations. Discover the world of Dosso Dossi franchising with us.",
    franchiseCta: "Let’s talk",
    collectionNote:
      "Explore a preview of our online store. Orders are not open yet.",
    coffeeAlt: "Barista pouring milk to create latte art",
    cupAlt: "Dosso Dossi coffee cup",
    coldAlt: "Dosso Dossi cold drinks",
  },
};
const branches = [
  {
    name: "Beylikdüzü Vadi Loca",
    city: "İstanbul",
    address: "Adnan Kahveci Mah. Sayaca Cad. No:13, Beylikdüzü / İstanbul",
    coordinates: "41.00838,28.632925",
  },
  {
    name: "Beylikdüzü Son Durak",
    city: "İstanbul",
    address:
      "Cumhuriyet Mah. Yıldıray Çınar Sok. No:47-1, Büyükçekmece / İstanbul",
    coordinates: "41.021873,28.623523",
  },
  {
    name: "Vatan Caddesi",
    city: "İstanbul",
    address:
      "Akşemsettin Mah. Adnan Menderes Vatan Bulvarı, Dosso Dossi Hotel No:46-48, Fatih / İstanbul",
    coordinates: "41.016863,28.940617",
  },
  {
    name: "Diyarbakır Stad",
    city: "Diyarbakır",
    address:
      "Fırat Mah. 507. Sok. Dicle Fırat No:5 İç Kapı No:29, Kayapınar / Diyarbakır",
    coordinates: "37.926528,40.164817",
  },
];
function Arrow({ diagonal = true }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

export function HomeContent({ locale, catalog }: { locale: Locale; catalog: CatalogResult }) {
  const products = catalogItems(catalog.products);
  const t = copy[locale],
    shop = pagePath(locale, "shop");
  const [slide, setSlide] = useState(0),
    [story, setStory] = useState(0),
    [city, setCity] = useState("all"),
    [cold, setCold] = useState(false);
  return (
    <>
      <section
        className={`${s.hero} ${slide === 1 ? s.colourHero : ""}`}
        aria-roledescription={
          locale === "tr" ? "Tanıtım slaytları" : "Carousel"
        }
        aria-label={
          locale === "tr" ? "Dosso Dossi dünyası" : "The world of Dosso Dossi"
        }
      >
        {slide === 0 ? (
          <Image
            src="/images/editorial/coffee-moment.webp"
            alt={t.coffeeAlt}
            fill
            sizes="100vw"
            priority
            className={s.heroPhoto}
          />
        ) : (
          <div className={s.heroThermoses}>
            {["orange", "cream", "pink", "green"].map((color) => (
              <Image key={color} src={`/images/products/thermos-${color}.webp`} alt="" width={190} height={530} />
            ))}
          </div>
        )}
        <div className={s.heroShade} />
        <div className={s.heroInner}>
          <div className={s.heroCopy} aria-live="polite">
            <p className={s.eyebrow}>
              {slide === 0 ? t.heroLabel : t.nextLabel}
            </p>
            <h1>{slide === 0 ? t.heroTitle : t.nextTitle}</h1>
            <p className={s.heroText}>
              {slide === 0 ? t.heroText : t.nextText}
            </p>
            <Link
              className={s.lightButton}
              href={slide === 0 ? "#hikayemiz" : `${shop}?category=thermos`}
            >
              {slide === 0 ? t.heroCta : t.nextCta}
              <Arrow />
            </Link>
          </div>
          <div className={s.heroBottom}>
            <span>
              {t.scroll} <span aria-hidden="true">↓</span>
            </span>
            <div className={s.slideControls}>
              <button
                onClick={() => setSlide(slide === 0 ? 1 : 0)}
                aria-label={t.prev}
              >
                ←
              </button>
              <div>
                {[0, 1].map((item) => (
                  <button
                    key={item}
                    className={slide === item ? s.activeDot : ""}
                    aria-label={`${t.slide} ${item + 1}`}
                    aria-pressed={slide === item}
                    onClick={() => setSlide(item)}
                  />
                ))}
              </div>
              <button
                onClick={() => setSlide(slide === 0 ? 1 : 0)}
                aria-label={t.next}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={s.collection} aria-labelledby="collection-title">
        <div className={s.sectionTop}>
          <div>
            <p className={s.eyebrow}>{t.collectionLabel}</p>
            <h2 id="collection-title">{t.collectionTitle}</h2>
            <p className={s.intro}>{t.collectionText}</p>
          </div>
          <Link className={s.textLink} href={shop}>
            {t.all}
            <Arrow />
          </Link>
        </div>
        <div className={s.productGrid}>
          {products.slice(0, 3).map((product, index) => (
            <Link
              key={product.id}
              href={`${shop}?product=${product.product.id}&variant=${product.id}`}
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
                  <Arrow />
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

      <section className={s.story} id="hikayemiz" aria-labelledby="story-title">
        <div className={s.storyVisual}>
          <div className={s.storyType} aria-hidden="true">
            {locale === "tr" ? (
              <>
                KAHVE.
                <br />
                SANAT.
                <br />
                HAYAT.
              </>
            ) : (
              <>
                COFFEE.
                <br />
                ART.
                <br />
                PEOPLE.
              </>
            )}
          </div>
          <Image
            src="/images/editorial/coffee-cup.webp"
            alt={t.storyImage}
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <span className={s.storyStamp}>DOSSO DOSSI COFFEE</span>
        </div>
        <div className={s.storyCopy}>
          <p className={s.eyebrow}>{t.storyLabel}</p>
          <h2 id="story-title">{t.storyTitle}</h2>
          <div className={s.storyTabs} aria-label={t.storyLabel}>
            {t.storyTabs.map((item, index) => (
              <button
                key={item}
                aria-pressed={story === index}
                onClick={() => setStory(index)}
              >
                {item}
              </button>
            ))}
          </div>
          <p className={s.storyDescription} aria-live="polite">
            {t.storyTexts[story]}
          </p>
          <Link className={s.textLink} href="#subeler">
            {t.storyCta}
            <Arrow />
          </Link>
        </div>
      </section>

      <section
        className={s.locations}
        id="subeler"
        aria-labelledby="locations-title"
      >
        <div className={s.locationIntro}>
          <p className={s.eyebrow}>{t.locationLabel}</p>
          <h2 id="locations-title">{t.locationTitle}</h2>
          <p className={s.intro}>{t.locationText}</p>
          <label className={s.cityLabel}>
            {t.cityLabel}
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="all">{t.allCities}</option>
              <option value="İstanbul">İstanbul</option>
              <option value="Diyarbakır">Diyarbakır</option>
            </select>
          </label>
          <div className={s.locationSignature} aria-hidden="true">
            {locale === "tr" ? (
              <>
                Dosso Dossi’de
                <br />
                <i>görüşürüz.</i>
              </>
            ) : (
              <>
                See you
                <br />
                <i>at Dosso Dossi.</i>
              </>
            )}
          </div>
        </div>
        <div className={s.branchList} aria-live="polite">
          {branches
            .filter((branch) => city === "all" || branch.city === city)
            .map((branch, index) => (
              <article key={branch.name} className={s.branch}>
                <span className={s.branchNumber}>0{index + 1}</span>
                <div>
                  <span className={s.branchCity}>{branch.city}</span>
                  <h3>{branch.name}</h3>
                  <p>{branch.address}</p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${branch.coordinates}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.map}
                    <Arrow />
                  </a>
                </div>
              </article>
            ))}
        </div>
      </section>

      <section className={s.menuSection} id="menu" aria-labelledby="menu-title">
        <div className={s.menuVisual}>
          <span aria-hidden="true" className={s.menuBackdrop}>
            {locale === "tr"
              ? cold
                ? "BUZ GİBİ\nBİR MOLA."
                : "AMA ÖNCE,\nKAHVE."
              : cold
                ? "ICE, ICE\nCOFFEE."
                : "BUT FIRST,\nCOFFEE."}
          </span>
          <Image
            src={
              cold
                ? "/images/editorial/cold-drinks.webp"
                : "/images/editorial/coffee-cup.webp"
            }
            alt={cold ? t.coldAlt : t.cupAlt}
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </div>
        <div className={s.menuCopy}>
          <p className={s.eyebrow}>{t.menuLabel}</p>
          <h2 id="menu-title">{t.menuTitle}</h2>
          <p className={s.intro}>{t.menuText}</p>
          <div className={s.menuTabs}>
            <button aria-pressed={!cold} onClick={() => setCold(false)}>
              {t.hot}
            </button>
            <button aria-pressed={cold} onClick={() => setCold(true)}>
              {t.cold}
            </button>
          </div>
          <ul className={s.menuItems} aria-live="polite">
            {(cold
              ? ["Americano Freddo", "Latte Freddo", "Matcha Latte Freddo"]
              : ["Espresso", "Cafe Americano", "Caffe Latte"]
            ).map((item) => (
              <li key={item}>
                {item}
                <span aria-hidden="true">✳</span>
              </li>
            ))}
          </ul>
          <p className={s.menuNote}>{t.menuNote}</p>
          <Link href="#subeler" className={s.textLink}>
            {t.menuCta}
            <Arrow />
          </Link>
        </div>
      </section>

      <section className={s.franchise} id="franchising">
        <div className={s.franchiseDecor} aria-hidden="true">
          DD
        </div>
        <div>
          <p className={s.eyebrow}>{t.franchiseLabel}</p>
          <h2>{t.franchiseTitle}</h2>
        </div>
        <div className={s.franchiseRight}>
          <p>{t.franchiseText}</p>
          <a href="tel:+902122422121" className={s.lightButton}>
            {t.franchiseCta}
            <Arrow />
          </a>
        </div>
      </section>
    </>
  );
}
