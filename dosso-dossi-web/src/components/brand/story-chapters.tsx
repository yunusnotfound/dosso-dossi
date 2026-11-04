"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { Locale } from "@/lib/site";
import { storyCopy } from "./story-copy";
import s from "./story-experience.module.css";

export function StoryChapters({ locale }: { locale: Locale }) {
  const t = storyCopy[locale];
  const [active, setActive] = useState(0);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const contentId = useId();
  const select = (index: number) => setActive((index + t.chapters.length) % t.chapters.length);
  const current = t.chapters[active];

  return (
    <section className={s.chapters} aria-label={t.chapterLabel} data-story-reveal>
      <header className={s.chapterHeading}>
        <p className={s.eyebrow}>{t.chapterLabel}</p>
        <h2>{t.chapterTitle[0]}<br /><span>{t.chapterTitle[1]}</span></h2>
        <span className={s.headingStar} aria-hidden="true">✳</span>
      </header>
      <div className={s.chapterTabs} role="group" aria-label={t.chapterGroup}>
        {t.chapters.map((chapter, index) => (
          <button key={chapter.name} type="button" aria-pressed={active === index} aria-controls={contentId} onClick={() => select(index)}>
            <span>0{index + 1}</span><strong>{chapter.name}</strong><span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div className={s.chapterStage} id={contentId}>
        <div className={s.chapterVisual}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { pointer.current = null; }}
          onLostPointerCapture={() => { pointer.current = null; }}
          onPointerUp={(event) => {
            const start = pointer.current;
            pointer.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) select(active + (dx < 0 ? 1 : -1));
          }}>
          {t.chapters.map((chapter, index) => (
            <div key={chapter.name} className={s.chapterImage} data-active={active === index} aria-hidden={active !== index}>
              <Image src={chapter.image} alt={chapter.alt} fill sizes="(max-width: 700px) 100vw, 65vw" draggable={false} />
            </div>
          ))}
          <span className={s.dragHint}><span aria-hidden="true">↔</span>{t.drag}</span>
          <span className={s.imageCount} aria-hidden="true">0{active + 1}<small> / 03</small></span>
        </div>
        <div className={s.chapterCopy}>
          <div className={s.chapterWords} key={active} aria-live="polite" aria-atomic="true">
            <p className={s.eyebrow}>{current.cue}</p>
            <h3>{current.title}</h3>
            <p className={s.chapterDescription}>{current.text}</p>
          </div>
          <div className={s.chapterFoot}>
            <p>{current.note}</p>
            <div className={s.chapterArrows}>
              <button type="button" onClick={() => select(active - 1)} aria-label={t.previous}>←</button>
              <button type="button" onClick={() => select(active + 1)} aria-label={t.next}>→</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
