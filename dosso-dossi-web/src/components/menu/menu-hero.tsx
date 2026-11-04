"use client";

import Image from "next/image";
import type { Locale } from "@/lib/site";
import { menuSnapshot } from "@/lib/menu-snapshot";
import { menuCopy } from "./menu-copy";
import { CitrusArt } from "../shop/citrus-art";
import { useSceneMotion } from "../shop/use-scene-motion";
import s from "./menu-experience.module.css";

export function MenuHero({ locale, titleId, onExplore, onCategory }: {
  locale: Locale; titleId?: string; onExplore: () => void; onCategory: (id: string) => void;
}) {
  const t = menuCopy[locale];
  const scene = useSceneMotion<HTMLElement>();
  const images = ["caffe-latte", "mango-arancio", "matcha-fragola-latte-freddo"]
    .map(id => menuSnapshot.products.find(product => product.id === id)).filter(product => product?.imageUrl);
  return (
    <section className={s.hero} ref={scene}>
      <div className={s.heroCopy}>
        <p className={s.kicker}>{t.label}</p>
        <h2 id={titleId}>{t.title}<br /><em>{t.titleAccent}</em></h2>
        <p className={s.intro}>{t.intro}</p>
        <button className={s.primary} onClick={onExplore}>{t.explore}<span aria-hidden="true">↘</span></button>
        <div className={s.stats}><strong>{menuSnapshot.categories.length}</strong> {t.categoryCount}<i /> <strong>{menuSnapshot.products.length}</strong> {t.count}</div>
      </div>
      <div className={s.heroArt}>
        <span className={s.orbit} aria-hidden="true" />
        <span className={s.heroWord} aria-hidden="true">DOSSO.</span>
        <CitrusArt />
        {images.map((product, index) => product && <button key={product.id} className={s.heroDrink} data-position={index} onClick={() => onCategory(product.categoryId)} aria-label={`${product.name} — ${t.explore}`}>
          <Image src={product.imageUrl!} alt={product.name} width={400} height={500} sizes="(max-width: 600px) 170px, 280px" priority />
        </button>)}
        <span className={s.seal} aria-hidden="true">FRESH<br /><b>&</b><br />FEARLESS.</span>
      </div>
      <div className={s.moods}>
        {[["sicak-kahveler", t.hot, "01"], ["soguk-meyveli", t.fresh, "02"], ["tatlilar", t.sweet, "03"]].map(([id, label, number]) => <button key={id} onClick={() => onCategory(id)}><small>{number}</small><span>{label}</span><b aria-hidden="true">↗</b></button>)}
      </div>
    </section>
  );
}
