"use client";

import Image from "next/image";
import Link from "next/link";
import { menuSnapshot } from "@/lib/menu-snapshot";
import type { Locale } from "@/lib/site";
import { CitrusArt } from "./citrus-art";
import { useSceneMotion } from "./use-scene-motion";
import styles from "./shop-showcase.module.css";

function Arrow() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export function ShopHero({ locale, onExplore }: { locale: Locale; onExplore: () => void }) {
  const scene = useSceneMotion<HTMLElement>();
  const tr = locale === "tr";
  return (
    <section ref={scene} className={styles.hero} aria-labelledby="shop-heading">
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> DOSSO DOSSI COFFEE · {tr ? "ONLINE MAĞAZA" : "ONLINE SHOP"}</p>
          <h1 id="shop-heading">{tr ? "RİTÜELİNİ" : "YOUR RITUAL."}<br /><em>{tr ? "YANINA AL." : "TO GO."}</em></h1>
          <p className={styles.description}>{tr ? "İlk yudumdan günün son ışığına. Sevdiğin kahve, senin rengin, sana ait bir ritüel." : "From the first sip to the last light. Your favourite coffee, your colour, a ritual all your own."}</p>
          <button className={styles.primaryAction} onClick={onExplore}>{tr ? "KOLEKSİYONU KEŞFET" : "EXPLORE THE COLLECTION"}<Arrow /></button>
          <a className={styles.quietAction} href="#kahveni-bul">{tr ? "Kahveni bul, setini oluştur" : "Find your coffee, build your set"}<span>↗</span></a>
        </div>
        <div className={styles.heroStage}>
          <div className={styles.thermosComposition}>
            <Image
              src="/images/editorial/thermos-quartet-v1.webp"
              alt={tr ? "Dosso Dossi’nin krem, turuncu, yeşil ve pembe termos koleksiyonu" : "The Dosso Dossi thermos collection in cream, orange, green and pink"}
              fill
              sizes="(max-width: 700px) 100vw, (max-width: 1440px) 55vw, 700px"
              loading="eager"
              fetchPriority="high"
            />
          </div>
          <span className={styles.stageCaption} aria-hidden="true">COFFEE. COLOUR. EVERYWHERE.</span>
          <span className={styles.stageIndex} aria-hidden="true">01 — ESSENTIALS</span>
        </div>
      </div>
      <div className={styles.heroFoot}><span>DOSSO DOSSI COFFEE</span><p>{tr ? "KAHVE BİR BAŞLANGIÇ. GERİSİ SENİN HİKÂYEN." : "COFFEE IS THE BEGINNING. THE REST IS YOUR STORY."}</p><a href="#katalog" aria-label={tr ? "Ürünlere git" : "Go to products"}>↓</a></div>
    </section>
  );
}

export function CitrusShowcase({ locale }: { locale: Locale }) {
  const scene = useSceneMotion<HTMLElement>();
  const tr = locale === "tr";
  const drink = menuSnapshot.products.find((product) => product.id === "mango-arancio");
  const image = drink?.imageUrl ?? drink?.image;
  if (!image) return null;

  return (
    <section ref={scene} className={styles.citrusSection} id="taze-bir-mola" aria-labelledby="citrus-heading">
      <div className={styles.citrusInner}>
        <div className={styles.citrusStage}>
          <span className={styles.citrusWord} aria-hidden="true">FRESH</span>
          <span className={styles.citrusHalo} aria-hidden="true" />
          <div className={styles.drink}><Image src={image} alt={drink?.name ?? "Mango Arancio"} fill sizes="(max-width: 700px) 54vw, 280px" /></div>
          <CitrusArt />
          <span className={styles.drinkLabel}>{drink?.name}<i>↗</i></span>
        </div>
        <div className={styles.citrusCopy}>
          <p className={styles.eyebrow}><span /> {tr ? "BİR YUDUM GÜNEŞ" : "A SIP OF SUNSHINE"}</p>
          <h2 id="citrus-heading">{tr ? "GÜNE BİRAZ" : "A LITTLE"}<br /><em>{tr ? "NEŞE KAT." : "MORE ZEST."}</em></h2>
          <p>{tr ? "Mango, portakal ve buz gibi bir mola. Dosso Dossi’nin renkli dünyasında yeni favorini bul." : "Mango, orange and an ice-cold break. Find your next favourite in the colourful world of Dosso Dossi."}</p>
          <Link href={tr ? "/menu" : "/en/menu"} className={styles.menuAction}>{tr ? "MENÜYÜ KEŞFET" : "EXPLORE THE MENU"}<Arrow /></Link>
          <div className={styles.citrusNotes}><span>{tr ? "MEYVELİ" : "FRUITY"}</span><i /> <span>{tr ? "BUZ GİBİ" : "ICE COLD"}</span><i /><span>DOSSO DOSSI</span></div>
        </div>
      </div>
    </section>
  );
}
