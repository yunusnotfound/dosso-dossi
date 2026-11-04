"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { Locale } from "@/lib/site";
import { storeBranches } from "../store3d/store-info-data";
import { useSceneMotion } from "../shop/use-scene-motion";
import { useStoryReveal } from "./use-story-reveal";
import { branchCopy } from "./branch-copy";
import s from "./branch-experience.module.css";

const cities = [...new Set(storeBranches.map((branch) => branch.city))];
const cityImages: Record<string, string> = {
  İstanbul: "/images/locations/istanbul-concept-v1.webp",
  Diyarbakır: "/images/locations/diyarbakir-concept-v1.webp",
};
const number = (value: number) => String(value).padStart(2, "0");

export function BrandBranches({ locale, onMenu }: { locale: Locale; onMenu?: () => void }) {
  const t = branchCopy[locale];
  const root = useStoryReveal();
  const hero = useSceneMotion<HTMLElement>();
  const discovery = useRef<HTMLElement>(null);
  const [city, setCity] = useState("all");
  const [selectedName, setSelectedName] = useState<string>(storeBranches[0].name);
  const detailId = useId();
  const listId = useId();
  const branches = storeBranches.filter((branch) => city === "all" || branch.city === city);
  const selected = branches.find((branch) => branch.name === selectedName) ?? branches[0];
  const selectedIndex = storeBranches.indexOf(selected);
  const cityCount = storeBranches.filter((branch) => branch.city === selected.city).length;
  const upper = (value: string) => value.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-GB");
  const explore = () => discovery.current?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start",
  });
  const chooseCity = (next: string) => {
    setCity(next);
    if (next !== "all" && selected.city !== next) {
      const first = storeBranches.find((branch) => branch.city === next);
      if (first) setSelectedName(first.name);
    }
  };

  return (
    <div className={s.experience} ref={root}>
      <section className={s.hero} ref={hero}>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}><span className={s.dot} />{t.label}</p>
          <h2>{t.title[0]}<br /><span>{t.title[1]}</span></h2>
          <p className={s.heroIntro}>{t.intro}</p>
          <button type="button" className={s.explore} onClick={explore}>{t.explore}<span aria-hidden="true">↘</span></button>
          <div className={s.heroSignature}><span aria-hidden="true">DD.</span><p>GOOD COFFEE.<br />GREAT COMPANY.</p></div>
        </div>
        <figure className={s.heroScene}>
          <div className={s.heroImage}><Image src={cityImages.İstanbul} alt={t.cityAlt("İstanbul")} fill sizes="(max-width: 700px) 100vw, 60vw" preload /></div>
          <span className={s.heroCity} aria-hidden="true">İSTANBUL.</span>
          <span className={s.meetingSeal} aria-hidden="true">LET’S<br /><b>MEET.</b><span>↙</span></span>
          <figcaption><span>{t.illustration}</span><span>01 / 02</span></figcaption>
        </figure>
      </section>
      <div className={s.cityRibbon}>
        <p><strong>{number(storeBranches.length)}</strong><span>{t.locations}</span></p>
        <span className={s.ribbonStar} aria-hidden="true">✳</span>
        <p><strong>{number(cities.length)}</strong><span>{t.cities}</span></p>
        <p className={s.ribbonMessage}>{t.sameFeeling}<span aria-hidden="true">↗</span></p>
      </div>

      <section className={s.discovery} ref={discovery} data-story-reveal>
        <div className={s.discoveryHeading}>
          <div><p className={s.eyebrow}>{t.discoveryLabel}</p><h2>{t.discoveryTitle[0]}<br /><span>{t.discoveryTitle[1]}</span></h2></div>
          <p>{t.discoveryText}</p>
        </div>
        <div className={s.filters} role="group" aria-label={t.cityFilter}>
          {["all", ...cities].map((item) => (
            <button type="button" key={item} aria-pressed={city === item} aria-controls={listId} onClick={() => chooseCity(item)}>
              <span>{item === "all" ? t.all : item}</span><small>{number(item === "all" ? storeBranches.length : storeBranches.filter((branch) => branch.city === item).length)}</small>
            </button>
          ))}
        </div>
        <div className={s.discoveryCanvas}>
          <div className={s.branchSelector}>
            <div className={s.listHeading}><span className={s.eyebrow}>{t.branchList}</span><span aria-live="polite">{t.branchCount(branches.length)}</span></div>
            <div className={s.branchList} id={listId} role="group" aria-label={t.branchList}>
              {branches.map((branch) => (
                <button type="button" key={branch.name} aria-pressed={selected.name === branch.name} aria-controls={detailId} onClick={() => setSelectedName(branch.name)}>
                  <span className={s.rowNumber}>{number(storeBranches.indexOf(branch) + 1)}</span>
                  <span className={s.rowCopy}><small>{branch.city}</small><strong>{branch.name}</strong></span><span className={s.rowArrow} aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className={s.selectorFoot} aria-hidden="true"><span>COFFEE IS<br />ALWAYS A<br /><b>GOOD IDEA.</b></span><span>✳</span></div>
          </div>
          <div className={s.selectedPlace} id={detailId}>
            <figure className={s.cityScene}>
              {cities.map((item) => <div className={s.cityImage} key={item} data-active={selected.city === item} aria-hidden={selected.city !== item}><Image src={cityImages[item]} alt={t.cityAlt(item)} fill sizes="(max-width: 760px) 100vw, 64vw" /></div>)}
              <div className={s.sceneTop}><span>DOSSO DOSSI / {number(selectedIndex + 1)}</span><span>{t.branchCount(cityCount)}</span></div>
              <p className={s.cityName} key={selected.city} aria-hidden="true">{upper(selected.city)}<span>.</span></p>
              <figcaption>{t.illustration}</figcaption>
            </figure>
            <div className={s.addressPanel}>
              <div className={s.addressNumber} aria-hidden="true">{number(selectedIndex + 1)}</div>
              <div className={s.addressCopy} aria-live="polite" aria-atomic="true">
                <p className={s.eyebrow}>{t.selected}</p><h3>{selected.name}</h3><p className={s.addressLabel}>{t.address}</p><address>{selected.address}</address>
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.coordinates}`} target="_blank" rel="noopener noreferrer" aria-label={`${selected.name} — ${t.directions}`} className={s.directions}>
                <span aria-hidden="true">↗</span><span>{t.directions}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {onMenu && <section className={s.closing} data-story-reveal>
        <div className={s.closingWords}><p className={s.eyebrow}>{t.closingLabel}</p><h2>{t.closingTitle[0]}<br /><span>{t.closingTitle[1]}</span></h2><p>{t.closingText}</p><button type="button" className={s.explore} onClick={onMenu}>{t.menu}<span aria-hidden="true">↗</span></button></div>
        <div className={s.closingArt}><span aria-hidden="true">SEE<br />YOU.</span><Image src="/images/editorial/coffee-cup.webp" alt={t.cupAlt} width={512} height={512} sizes="(max-width: 700px) 270px, 400px" /></div>
      </section>}
      <div className={s.footerLine}><span>DOSSO DOSSI COFFEE</span><span>{t.footer}</span></div>
    </div>
  );
}
