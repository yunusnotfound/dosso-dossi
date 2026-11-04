"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { Locale } from "@/lib/site";
import { franchisePhone } from "../store3d/store-info-data";
import { useSceneMotion } from "../shop/use-scene-motion";
import { useStoryReveal } from "./use-story-reveal";
import { FranchiseBrief } from "./franchise-brief";
import { franchiseCopy } from "./franchise-copy";
import s from "./franchise-experience.module.css";

export function BrandFranchise({ locale }: { locale: Locale }) {
  const t = franchiseCopy[locale];
  const [support, setSupport] = useState(0);
  const root = useStoryReveal();
  const hero = useSceneMotion<HTMLElement>();
  const brief = useRef<HTMLDivElement>(null);
  const supportArea = useRef<HTMLElement>(null);
  const panelId = useId();
  const jump = (target: HTMLElement | null) => target?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });

  return (
    <div className={s.franchise} ref={root}>
      <section className={s.hero} ref={hero}>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}><span className={s.dot} />{t.eyebrow}</p>
          <h2>{t.title.map((line) => <span key={line}>{line}</span>)}</h2>
          <p className={s.intro}>{t.intro}</p>
          <button type="button" className={s.primary} onClick={() => jump(brief.current)}>{t.begin}<span aria-hidden="true">↗</span></button>
        </div>
        <div className={s.heroVisual}>
          <div className={s.heroFrame}><Image src="/images/franchise/cafe-concept-v1.webp" alt={t.heroAlt} fill sizes="(max-width: 760px) 100vw, 60vw" preload /></div>
          <span className={s.roundel} aria-hidden="true">DOSSO DOSSI<strong>×</strong>{locale === "tr" ? "SENİN HİKÂYEN" : "YOUR STORY"}</span>
          <span className={s.concept}>{t.concept}</span>
          <span className={s.heroArrow} aria-hidden="true">↗</span>
        </div>
        <footer className={s.heroFoot}><span>COFFEE / ART / MUSIC</span><button type="button" onClick={() => jump(supportArea.current)}>{t.explore}<span aria-hidden="true">↓</span></button><span>FRANCHISING</span></footer>
      </section>
      <section className={s.invitation} data-story-reveal>
        <p className={s.eyebrow}>{t.invitation}</p>
        <h2>{t.invitationTitle[0]}<br /><span>{t.invitationTitle[1]}</span></h2>
        <p className={s.invitationText}>{t.invitationText}</p>
        <span className={s.spark} aria-hidden="true">✳</span>
      </section>
      <section className={s.support} ref={supportArea} aria-label={t.supportLabel} data-story-reveal>
        <div className={s.supportHeading}><p className={s.eyebrow}>{t.supportLabel}</p><h2>{t.supportTitle[0]}<br /><span>{t.supportTitle[1]}</span></h2></div>
        <div className={s.supportLayout}>
          <div className={s.supportVisual}>
            {t.supports.map((item,index) => <div className={s.supportImage} key={item.title} data-active={support === index} aria-hidden={support !== index}><Image src={item.image} alt={item.alt} fill sizes="(max-width: 760px) 100vw, 55vw" /></div>)}
            <span className={s.supportNumber} aria-hidden="true">0{support + 1}</span>
            <p className={s.supportWord} key={support} aria-hidden="true">{t.supports[support].word}</p>
          </div>
          <div className={s.supportControls}>
            <div role="group" aria-label={t.supportGroup} className={s.supportTabs}>
              {t.supports.map((item,index) => <button type="button" key={item.title} aria-pressed={support === index} aria-controls={panelId} onClick={() => setSupport(index)}><small>0{index+1}</small><strong>{item.title}</strong><span aria-hidden="true">{support === index ? "−" : "+"}</span></button>)}
            </div>
            <div className={s.supportDetails} id={panelId} aria-live="polite" aria-atomic="true"><p key={support}>{t.supports[support].text}</p><span>{t.supports[support].note}</span></div>
            <button type="button" className={s.textLink} onClick={() => jump(brief.current)}>{t.begin}<span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </section>
      <div ref={brief} className={s.brief}><FranchiseBrief locale={locale} /></div>
      <section className={s.faq} data-story-reveal>
        <div><p className={s.eyebrow}>{t.faqLabel}</p><h2>{t.faqTitle}</h2></div>
        <div className={s.questions}>{t.faqs.map(([question,answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>
      <section className={s.contact}>
        <div><p className={s.eyebrow}>DOSSO DOSSI FRANCHISING</p><h2>{t.contact}</h2><p>{t.contactText}</p></div>
        <div className={s.contactActions}><a className={s.phone} href={franchisePhone}>+90 212 242 21 21<span aria-hidden="true">↗</span></a><a href="#franchise-form">{locale === "tr" ? "Başvuru formuna geç" : "Start your inquiry"} ↗</a></div>
      </section>
    </div>
  );
}
