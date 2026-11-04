import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/site";
import { WebsiteHeader } from "@/components/website/website-header";
import { SiteFooter } from "@/components/site-chrome";
import { informationCopy, isInformationSlug } from "./information-copy";
import s from "./information-page.module.css";
export function informationMetadata(locale: Locale, slug: string): Metadata { return { title: isInformationSlug(slug) ? informationCopy[locale][slug].title : (locale === "tr" ? "Bilgilendirme" : "Information"), robots: { index: false, follow: false } }; }
export function InformationPage({ locale, slug }: { locale: Locale; slug: string }) {
  if (!isInformationSlug(slug)) notFound();
  const tr = locale === "tr";
  const page = informationCopy[locale][slug];
  const prefix = tr ? "" : "/en";
  return <><a className="skip-link" href="#main-content">{tr ? "İçeriğe geç" : "Skip to content"}</a><WebsiteHeader locale={locale} active="shop" languagePaths={{ tr: `/bilgilendirme/${slug}`, en: `/en/bilgilendirme/${slug}` }} /><main id="main-content" className={s.page}><div className={s.hero}><p className={s.eyebrow}>DOSSO DOSSI · {tr ? "BİLGİLENDİRME" : "INFORMATION"}</p><h1>{page.title}</h1><p>{page.intro}</p><span className={s.preview}>{tr ? "Önizleme mağazası · Canlı satış henüz başlamadı" : "Preview store · Live sales have not started"}</span></div><div className={s.layout}><nav className={s.navigation} aria-label={tr ? "Bilgilendirme sayfaları" : "Information pages"}>{Object.entries(informationCopy[locale]).map(([key, value]) => <Link key={key} href={`${prefix}/bilgilendirme/${key}`} aria-current={key === slug ? "page" : undefined}>{value.title}<span aria-hidden="true">↗</span></Link>)}</nav><div className={s.content}>{page.sections.map((section,index) => <section key={section.title} id={section.id}><span className={s.number}>{String(index+1).padStart(2,"0")}</span><h2>{section.title}</h2><p>{section.text}</p>{section.points && <ol>{section.points.map(point => <li key={point}>{point}</li>)}</ol>}</section>)}<div className={s.contact}><p>{tr ? "Bir sorunuz mu var?" : "Have a question?"}</p><a href="tel:+902122422121">+90 212 242 21 21 <span aria-hidden="true">↗</span></a></div></div></div></main><SiteFooter locale={locale} /></>;
}
