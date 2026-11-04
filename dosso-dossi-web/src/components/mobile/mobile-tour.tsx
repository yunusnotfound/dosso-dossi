"use client";

import { useId, useState } from "react";
import type { Locale } from "@/lib/site";
import { useSceneMotion } from "../shop/use-scene-motion";
import { AppPhone } from "./app-phone";
import { mobileCopy, type AppScreen } from "./mobile-copy";
import s from "./mobile-tour.module.css";

export function MobileTour({ locale }: { locale: Locale }) {
  const t = mobileCopy[locale];
  const [selected, setSelected] = useState(0);
  const [selectedStory, setSelectedStory] = useState(0);
  const screen = t.screens[selected];
  const story = t.stories[selectedStory];
  const showingStories = screen.id === "stories";
  const displayedScreen: AppScreen = screen.id === "stories" ? story.id : screen.id;
  const displayedName = showingStories ? story.name : screen.name;
  const detailsId = useId();
  const phoneId = useId();
  const scene = useSceneMotion<HTMLElement>();
  return <section className={s.tour} ref={scene} data-mobile-motion>
    <header className={s.heading} data-story-reveal>
      <p className={s.eyebrow}>{t.tourLabel}</p>
      <h2>{t.tourTitle.map((line,index)=><span key={line} data-accent={index===2}>{line}</span>)}</h2>
      <p className={s.intro}>{t.tourIntro}</p>
    </header>
    <div className={s.experience} data-story-reveal>
      <div className={s.stage}>
        <span className={s.orbit} aria-hidden="true" /><span className={s.orbitTwo} aria-hidden="true" />
        <span className={s.giantNumber} aria-hidden="true">{String(selected+1).padStart(2,"0")}</span>
        <div className={s.deviceMotion} id={phoneId}>
          <div className={s.device} key={displayedScreen}><AppPhone screen={displayedScreen} alt={`${displayedName} · Dosso Dossi Coffee`} /></div>
        </div>
        <p className={s.screenCaption}>{t.screenNote}</p>
      </div>
      <div className={s.details}>
        <div className={s.selection}>
          <div className={s.tabs} role="group" aria-label={t.screenGroup}>
            {t.screens.map((item,index)=><button key={item.id} type="button" aria-pressed={selected===index} aria-controls={`${phoneId} ${detailsId}`} onClick={()=>setSelected(index)}><small>{String(index+1).padStart(2,"0")}</small><span>{item.name}</span><i aria-hidden="true">↗</i></button>)}
          </div>
          {showingStories && <div className={s.storyPicker}>
            <p>{t.storyLabel}<span aria-hidden="true">{String(selectedStory+1).padStart(2,"0")} / {String(t.stories.length).padStart(2,"0")}</span></p>
            <div className={s.storyChoices} role="group" aria-label={t.storyGroup}>
              {t.stories.map((item,index)=><button key={item.id} type="button" aria-pressed={selectedStory===index} aria-controls={phoneId} onClick={()=>setSelectedStory(index)}><span aria-hidden="true" />{item.name}</button>)}
            </div>
          </div>}
        </div>
        <div className={s.copy} id={detailsId} aria-live="polite" aria-atomic="true">
          <div key={screen.id}><h3>{screen.title}</h3><p>{screen.text}</p><span>{screen.detail}</span></div>
        </div>
        <div className={s.pagination} aria-hidden="true"><span>{String(selected+1).padStart(2,"0")}</span><div>{t.screens.map((item,index)=><i key={item.id} data-active={selected===index} />)}</div><span>{String(t.screens.length).padStart(2,"0")}</span></div>
      </div>
    </div>
  </section>;
}
