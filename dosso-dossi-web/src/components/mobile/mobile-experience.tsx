"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/site";
import { useStoryReveal } from "../brand/use-story-reveal";
import { AppPhone } from "./app-phone";
import { MobileTour } from "./mobile-tour";
import { mobileCopy } from "./mobile-copy";
import s from "./mobile-experience.module.css";

const MobileCinema = dynamic(() => import("./mobile-cinema").then(m => m.MobileCinema), { ssr: false, loading: () => <div className={s.loadingPhone}><AppPhone screen="home" alt="Dosso Dossi Coffee" eager /></div> });

export function MobileExperience({ locale }: { locale: Locale }) {
  const t = mobileCopy[locale];
  const root = useStoryReveal();
  const tour = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [scene, setScene] = useState(0);
  const [stamps, setStamps] = useState(0);
  const complete = stamps === 5;
  const jump = (node: HTMLElement | null) => node?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });

  return <div className={s.mobile} ref={root} data-paused={paused}>
    <section className={s.hero}>
      <div className={s.heroCopy}>
        <p className={s.eyebrow}><span />{t.eyebrow}</p>
        <h2>{t.title.map((line,index)=><span key={line} data-accent={index===2}>{line}</span>)}</h2>
        <p className={s.intro}>{t.intro}</p>
        <button type="button" className={s.primary} onClick={()=>jump(tour.current)}>{t.explore}<span aria-hidden="true">↘</span></button>
        <div className={s.appSignature}><Image src="/images/mobile/app-logo.webp" alt="" width={46} height={46} /><div><strong>DOSSO DOSSI</strong><span>COFFEE · APP</span></div><span className={s.miniStar} aria-hidden="true">✳</span></div>
      </div>
      <div className={s.heroStage}>
        <span className={s.stageCircle} aria-hidden="true" /><span className={s.stageWord} aria-hidden="true">{locale==="tr"?"MOBİL.":"MOBILE."}</span>
        <MobileCinema locale={locale} paused={paused} scene={scene} />
        <div className={s.stageMeta}><span>{t.preview}</span><button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused} aria-label={paused?t.resume:t.pause}><span aria-hidden="true">{paused?"▶":"Ⅱ"}</span>{paused?t.resume:t.pause}</button></div>
      </div>
      <div className={s.sceneNav} role="group" aria-label={t.sceneLabel}>{t.scenes.map((label,index)=><button key={label} type="button" aria-pressed={scene===index} onClick={()=>setScene(index)}><small>0{index+1}</small><span>{label}</span><i aria-hidden="true">↗</i></button>)}</div>
      <div className={s.scrollHint}><span>{t.scroll}</span><span aria-hidden="true">↓</span></div>
    </section>
    <div className={s.ribbon} aria-hidden="true"><div>{Array.from({length:4},(_,index)=><span key={index}>{t.ribbon}<i>✳</i></span>)}</div></div>
    <div className={s.tourAnchor} ref={tour}><MobileTour locale={locale} /></div>
    <section className={s.rewards} data-complete={complete}>
      <div className={s.rewardArt}><Image src="/images/mobile/coffee-orbit-v1.webp" alt={locale==="tr"?"Turuncu yörüngede Dosso Dossi kahve bardağı ve üç boyutlu damga jetonları":"Dosso Dossi coffee cup and sculpted stamp tokens in an orange orbit"} fill sizes="(max-width: 760px) 150vw, 100vw" /></div>
      <div className={s.rewardCopy} data-story-reveal><p className={s.eyebrow}>{t.stampLabel}</p><h2>{t.stampTitle.map((line,index)=><span key={line} data-accent={index===2}>{line}</span>)}</h2><p>{t.stampIntro}</p></div>
      <div className={s.stampExperience} data-story-reveal>
        <div className={s.stampHeading}><span>{complete?t.stampComplete:t.stampLabel}</span><p aria-live="polite" aria-atomic="true"><strong>{stamps}</strong> / 5 <span className={s.srOnly}>{t.stampProgress}</span></p></div>
        <ol className={s.stamps} aria-label={t.stampProgress}>{Array.from({length:5},(_,index)=><li key={index} data-filled={stamps>index}><span className={s.coin} aria-hidden="true"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M23.7 4.8c-6-4.4-14.4-.2-17.5 7.1S5.1 26.3 11.3 28c-3.2-7 8.2-11.5 12.4-23.2Zm2.1 2.1c1.5 7.2-10.4 12.5-12.1 21.8 5.9 1.5 12.6-3.3 14.5-10.4 1.3-4.7.1-8.7-2.4-11.4Z"/></svg></span><small>{index+1}</small><span className={s.srOnly}>{stamps>index?(locale==="tr"?"Tamamlandı":"Complete"):(locale==="tr"?"Bekliyor":"Pending")}</span></li>)}</ol>
        <p className={s.stampDescription} aria-live="polite">{complete?t.stampDone:t.stampText}</p>
        <button type="button" className={s.primary} onClick={()=>setStamps(value=>value===5?0:value+1)}>{complete?t.stampReset:t.stampButton}<span aria-hidden="true">{complete?"↻":"+"}</span></button><small className={s.demoHint}>{t.stampHint}</small>
        {complete&&<div className={s.celebration} aria-hidden="true">{Array.from({length:12},(_,index)=><i key={index} />)}</div>}
      </div>
    </section>
    <section className={s.closing} data-story-reveal>
      <div className={s.closeCopy}><p className={s.eyebrow}>{t.closeLabel}</p><h2>{t.closeTitle.map(line=><span key={line}>{line}</span>)}</h2><p>{t.closeText}</p><div className={s.release}><span aria-hidden="true">◉</span>{t.release}</div><button type="button" className={s.textButton} onClick={()=>jump(root.current)}>{t.restart}<span aria-hidden="true">↑</span></button></div>
      <div className={s.phoneFan} aria-hidden="true"><div><AppPhone screen="menu" alt="" /></div><div><AppPhone screen="home" alt="" /></div><div><AppPhone screen="wallet" alt="" /></div><span className={s.fanOrbit} /></div>
      <p className={s.closeFoot}>{t.tech}<span aria-hidden="true">↗</span></p>
    </section>
  </div>;
}
