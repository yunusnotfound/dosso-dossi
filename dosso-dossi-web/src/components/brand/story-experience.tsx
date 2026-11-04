"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/site";
import type { StoreInfo } from "../store3d/store-info-panel";
import { useSceneMotion } from "../shop/use-scene-motion";
import { StoryChapters } from "./story-chapters";
import { StoryRitual } from "./story-ritual";
import { storyCopy } from "./story-copy";
import { useStoryReveal } from "./use-story-reveal";
import s from "./story-experience.module.css";

export function BrandStory({ locale, onSection }: { locale: Locale; onSection: (section: StoreInfo) => void }) {
  const t = storyCopy[locale];
  const root = useStoryReveal();
  const hero = useSceneMotion<HTMLElement>();
  const beginning = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const start = () => beginning.current?.scrollIntoView({ behavior: paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });

  return (
    <div className={s.story} ref={root} data-motion-paused={paused}>
      <section className={s.hero} ref={hero}>
        <div className={s.heroArt}>
          <Image src="/images/story/coffee-meets-art-v1.webp" alt={t.chapters[1].alt} fill sizes="100vw" preload />
        </div>
        <div className={s.heroContent}>
          <p className={s.eyebrow}><span className={s.dot} />{t.eyebrow}</p>
          <h2>{t.title.map((line, index) => <span key={line} data-accent={index === 1}>{line}</span>)}</h2>
          <p className={s.heroIntro}>{t.intro}</p>
          <button type="button" className={s.startButton} onClick={start}>{t.start}<span aria-hidden="true">↘</span></button>
        </div>
        <div className={s.heroBottom}>
          <span>{t.scroll}<span aria-hidden="true">↓</span></span>
          <span className={s.heroCoordinates}>COFFEE / ART / MUSIC</span>
          <button type="button" aria-label={paused ? t.play : t.pause} aria-pressed={paused} onClick={() => setPaused(!paused)}><span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span></button>
        </div>
      </section>
      <div className={s.ribbon} aria-hidden="true"><div>{[0, 1, 2, 3].map((item) => <span key={item}>TASTE THE ART <i>✳</i> FEEL THE MELODY <i>✳</i></span>)}</div></div>
      <section className={s.manifesto} ref={beginning} data-story-reveal>
        <div className={s.manifestoLabel}><p className={s.eyebrow}>{t.manifestoLabel}</p><span aria-hidden="true">↘</span></div>
        <div className={s.manifestoWords}><h2>{t.manifesto.map((line) => <span key={line}>{line}</span>)}</h2><p>{t.manifestoText}</p></div>
        <div className={s.beanAccent} aria-hidden="true"><Image src="/images/editorial/coffee-beans.webp" alt="" width={512} height={512} sizes="180px" /></div>
      </section>
      <StoryChapters locale={locale} />
      <section id="vizyon" className={s.vision} data-story-reveal>
        <div className={s.visionPortrait}>
          <Image src="/images/editorial/ceo.webp" alt={t.portrait} fill sizes="(max-width: 700px) 90vw, 42vw" />
          <span>HİKMET ERASLAN</span>
        </div>
        <div className={s.visionCopy}>
          <p className={s.eyebrow}>{t.visionLabel}</p>
          <h2>{t.visionTitle[0]}<br /><span>{t.visionTitle[1]}</span></h2>
          <p className={s.visionDescription}>{t.visionText}</p>
          <a href={`${locale === "en" ? "/en" : ""}/franchising`}>{locale === "tr" ? "Bu hikâyeye katıl" : "Become part of the story"}<span aria-hidden="true">↗</span></a>
          <span className={s.visionSeal} aria-hidden="true">DD<span>COFFEE<br />ART & MUSIC</span></span>
        </div>
      </section>
      <StoryRitual locale={locale} onMenu={() => onSection("menu")} onBranches={() => onSection("branches")} />
    </div>
  );
}
