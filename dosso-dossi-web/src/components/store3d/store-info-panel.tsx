"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import type { Locale } from "@/lib/site";
import {
  storeInfoCopy,
  storeInfoUi,
} from "./store-info-data";
import s from "./store-info-panel.module.css";

export type StoreInfo = "story" | "mobile" | "menu" | "branches" | "franchise";
type PanelProps = {
  locale: Locale;
  section: StoreInfo;
  onClose: () => void;
  onSection: (section: StoreInfo) => void;
};
const sections: StoreInfo[] = ["story", "mobile", "menu", "branches", "franchise"];

const MenuExperience = dynamic(() => import("../menu/menu-experience").then(module => module.MenuExperience));
const BrandStory = dynamic(() => import("../brand/brand-sections").then(module => module.BrandStory));
const BrandBranches = dynamic(() => import("../brand/brand-sections").then(module => module.BrandBranches));
const BrandFranchise = dynamic(() => import("../brand/brand-sections").then(module => module.BrandFranchise));
const MobileExperience = dynamic(() => import("../mobile/mobile-experience").then(module => module.MobileExperience));
const paths: Record<StoreInfo, string> = { story: "hikayemiz", mobile: "mobil", menu: "menu", branches: "subeler", franchise: "franchising" };

export function StoreInfoPanel({
  locale,
  section,
  onClose,
  onSection,
}: PanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const t = storeInfoCopy[locale];
  const ui = storeInfoUi[locale];
  const titles = {
    story: t.storyTitle,
    mobile: locale === "tr" ? "Dosso Dossi mobil uygulaması" : "The Dosso Dossi mobile app",
    menu: t.menuTitle,
    branches: t.locationTitle,
    franchise: t.franchiseTitle,
  };
  const labels = {
    story: t.storyLabel,
    mobile: ui.sections.mobile,
    menu: t.menuLabel,
    branches: t.locationLabel,
    franchise: t.franchiseLabel,
  };

  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    if (!node) return;
    node.showModal();
    return () => {
      node.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [section]);

  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <div className={s.shell}>
        <header className={s.header}>
          <span className={s.wordmark}>
            DOSSO DOSSI <small>COFFEE</small>
          </span>
          <button
            autoFocus
            className={s.close}
            type="button"
            onClick={onClose}
            aria-label={ui.close}
          >
            <span aria-hidden="true">×</span>
          </button>
        <nav className={s.navigation} aria-label={ui.navigation}>
          {sections.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={section === item}
              onClick={() => onSection(item)}
            >
              {ui.sections[item]}
            </button>
          ))}
        </nav>
        </header>
        <div className={s.body} ref={body}>
          {section !== "menu" && <div className={s.srOnly}>
            <p>{labels[section]}</p><h2 id={titleId}>{titles[section]}</h2>
          </div>}
          {section === "story" && (
            <BrandStory locale={locale} onSection={onSection} />
          )}
          {section === "mobile" && <MobileExperience locale={locale} />}
          {section === "menu" && <MenuExperience locale={locale} titleId={titleId} onBranches={() => onSection("branches")} />}
          {section === "branches" && <BrandBranches locale={locale} onMenu={() => onSection("menu")} />}
          {section === "franchise" && <BrandFranchise locale={locale} />}
          {section !== "menu" && <div className={s.fullPage}><Link href={`${locale === "en" ? "/en" : ""}/${paths[section]}`}>{locale === "tr" ? "Tam sayfa görüntüle" : "Open full page"} ↗</Link></div>}
        </div>
      </div>
    </dialog>
  );
}
