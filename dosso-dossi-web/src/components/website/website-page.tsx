"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site";
import { BrandBranches, BrandFranchise, BrandStory } from "@/components/brand/brand-sections";
import { MenuExperience } from "@/components/menu/menu-experience";
import { MobileExperience } from "@/components/mobile/mobile-experience";
import { SiteFooter } from "@/components/site-chrome";
import { WebsiteHeader, websitePath, type WebsiteSection } from "./website-header";
import s from "./website-page.module.css";

type PageSection = Exclude<WebsiteSection, "shop">;
const titles = {
  tr: { menu: "Menümüz", story: "Hikâyemiz", mobile: "Dosso Dossi mobil uygulaması", branches: "Şubelerimiz", franchise: "Franchising" },
  en: { menu: "Our menu", story: "Our story", mobile: "The Dosso Dossi mobile app", branches: "Our locations", franchise: "Franchising" },
};

export function WebsitePage({ locale, section }: { locale: Locale; section: PageSection }) {
  const router = useRouter();
  const tr = locale === "tr";
  const navigate = (next: PageSection) => router.push(websitePath(locale, next));
  return (
    <div className={s.page}>
      <a className={s.skipLink} href="#main-content">{tr ? "İçeriğe geç" : "Skip to content"}</a>
      <WebsiteHeader locale={locale} active={section} />
      <main id="main-content" tabIndex={-1} className={section === "menu" ? s.menuMain : s.fullMain}>
        <h1 className={s.srOnly}>{titles[locale][section]}</h1>
        {section === "menu" && <MenuExperience locale={locale} standalone onBranches={() => navigate("branches")} />}
        {section === "story" && <BrandStory locale={locale} onSection={navigate} />}
        {section === "mobile" && <MobileExperience locale={locale} />}
        {section === "franchise" && <BrandFranchise locale={locale} />}
        {section === "branches" && <BrandBranches locale={locale} onMenu={() => navigate("menu")} />}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
