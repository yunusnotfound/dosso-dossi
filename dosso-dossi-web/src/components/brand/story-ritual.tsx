"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { Locale } from "@/lib/site";
import { useSceneMotion } from "@/components/shop/use-scene-motion";
import s from "./story-ritual.module.css";

type RitualProps = { locale: Locale; onMenu: () => void; onBranches: () => void };

const rituals = [
  {
    id: "slow",
    name: "Caffè Latte",
    image: "/images/menu/products/caffe-latte.webp",
    word: "SLOW",
    tr: { label: "Yavaşla", title: "Biraz dur. Kendine dön.", text: "Bir pencere kenarı, sevdiğin bir şarkı, yumuşacık bir latte. Bu birkaç dakika sadece senin." },
    en: { label: "Slow down", title: "Pause. Come back to yourself.", text: "A seat by the window, your favourite song, a mellow latte. These few minutes are just for you." },
  },
  {
    id: "bright",
    name: "Mango Arancio",
    image: "/images/menu/products/mango-arancio.webp",
    word: "BRIGHT",
    tr: { label: "Canlan", title: "Gününe biraz güneş kat.", text: "Yeni bir rota, açık bir pencere, meyveli bir mola. Bazen bütün günün ritmi bir yudumda değişir." },
    en: { label: "Brighten up", title: "Let a little sunshine in.", text: "A new route, an open window, a fruity break. Sometimes a single sip changes the rhythm of your day." },
  },
  {
    id: "together",
    name: "Matcha Fragola Latte Freddo",
    image: "/images/menu/products/matcha-fragola-latte-freddo.webp",
    word: "TOGETHER",
    tr: { label: "Paylaş", title: "Güzel anlar, birlikte güzel.", text: "Sohbet uzasın, planlar beklesin. Sevdiğin biriyle aynı masada, rengârenk bir kahve molası." },
    en: { label: "Share", title: "Good moments feel better together.", text: "Let the conversation linger and the plans wait. A colourful coffee break at a table with someone you love." },
  },
] as const;

function Arrow() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function RitualMark({ index }: { index: number }) {
  if (index === 0) return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 7v18M23 7v18" /></svg>;
  if (index === 1) return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M19 3 8 18h8l-3 11 12-17h-9l3-9Z" /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 26C2 18 2 10 8 7c4-2 7 1 8 4 1-3 4-6 8-4 6 3 6 11-8 19Z" /></svg>;
}

export function StoryRitual({ locale, onMenu, onBranches }: RitualProps) {
  const [selected, setSelected] = useState(0);
  const scene = useSceneMotion<HTMLElement>();
  const titleId = useId();
  const descriptionId = useId();
  const tr = locale === "tr";
  const ritual = rituals[selected];
  const text = ritual[locale];

  return (
    <section ref={scene} className={s.ritual} data-mood={ritual.id} aria-labelledby={titleId}>
      <div className={s.layout}>
        <header className={s.heading}>
          <p className={s.eyebrow}><span /> {tr ? "BİR SONRAKİ GÜZEL AN" : "YOUR NEXT GOOD MOMENT"}</p>
          <h3 id={titleId}>{tr ? "BUGÜNÜN" : "FIND YOUR"}<br /><em>{tr ? "RİTMİNİ SEÇ." : "RHYTHM."}</em></h3>
          <p className={s.invitation}>{tr ? "Her ruh hâline bir Dosso Dossi." : "A Dosso Dossi for every kind of day."}</p>
        </header>

        <div className={s.stage} role="img" aria-label={ritual.name}>
          <span className={s.stageIndex} aria-hidden="true">0{selected + 1} <i /> 03</span>
          <span className={s.orbit} aria-hidden="true" />
          <span className={s.orbitLine} aria-hidden="true" />
          <span className={s.stageWord} aria-hidden="true">{ritual.word}</span>
          <div className={s.drinks} aria-hidden="true">
            {rituals.map((item, index) => {
              const position = (index - selected + rituals.length) % rituals.length;
              return (
                <div key={item.id} className={`${s.drink} ${position === 0 ? s.lead : position === 1 ? s.next : s.previous}`}>
                  <Image src={item.image} alt="" fill sizes="(max-width: 600px) 60vw, (max-width: 1000px) 32vw, 380px" />
                </div>
              );
            })}
          </div>
          <div className={s.seal} aria-hidden="true"><RitualMark index={selected} /><span>{tr ? "TAM DA" : "JUST"}<br />{tr ? "SENLİK." : "FOR YOU."}</span></div>
          <div className={s.productCaption} aria-hidden="true"><span>{ritual.name}</span><i>↗</i></div>
        </div>

        <div className={s.choices} role="group" aria-label={tr ? "Bugünün ritmini seç" : "Choose your rhythm"}>
          {rituals.map((item, index) => (
            <button key={item.id} type="button" aria-pressed={selected === index} aria-controls={descriptionId} onClick={() => setSelected(index)}>
              <span className={s.choiceIndex}>0{index + 1}</span><strong>{item[locale].label}</strong><RitualMark index={index} />
            </button>
          ))}
        </div>

        <div className={s.details}>
          <div className={s.description} id={descriptionId} aria-live="polite" aria-atomic="true">
            <h4>{text.title}</h4>
            <p>{text.text}</p>
          </div>
          <div className={s.actions}>
            <button type="button" className={s.menuButton} onClick={onMenu}>{tr ? "MENÜYÜ KEŞFET" : "EXPLORE THE MENU"}<Arrow /></button>
            <button type="button" className={s.branchButton} onClick={onBranches}>{tr ? "Bir kahvede buluşalım" : "Let’s meet over coffee"}<span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </div>
      <div className={s.footer} aria-hidden="true"><span>DOSSO DOSSI COFFEE</span><span>TASTE THE ART. FEEL THE MELODY.</span><span>↗</span></div>
    </section>
  );
}
