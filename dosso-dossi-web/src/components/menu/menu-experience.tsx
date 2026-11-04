"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { menuSnapshot, type MobileMenuProduct } from "@/lib/menu-snapshot";
import type { Locale } from "@/lib/site";
import { MenuHero } from "./menu-hero";
import { MenuProductCard } from "./menu-product-card";
import { MenuProductDetail } from "./menu-product-detail";
import { categoryLabel, menuCopy, searchable } from "./menu-copy";
import s from "./menu-experience.module.css";

export function MenuExperience({ locale, titleId, onBranches, standalone = false }: {
  locale: Locale; titleId?: string; onBranches: () => void; standalone?: boolean;
}) {
  const t = menuCopy[locale];
  const [category, setCategory] = useState(menuSnapshot.categories[0]?.id ?? "all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "featured" | "new">("all");
  const [selected, setSelected] = useState<MobileMenuProduct | null>(null);
  const catalog = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const resultsId = useId();
  const term = searchable(query.trim());
  const active = menuSnapshot.categories.find(item => item.id === category);
  const results = useMemo(() => menuSnapshot.products.filter(product => {
    if (term ? !searchable(product.name).includes(term) : category !== "all" && product.categoryId !== category) return false;
    return filter === "all" || (filter === "new" ? product.isNew : product.isFeatured);
  }), [category, term, filter]);
  const scrollToMenu = () => catalog.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  const chooseCategory = (id: string, scroll = false) => {
    setCategory(id); setQuery(""); setFilter("all");
    if (scroll) scrollToMenu();
  };
  const clear = () => { setQuery(""); setFilter("all"); setCategory("all"); };
  return (
    <div className={s.menu}>
      <MenuHero locale={locale} titleId={titleId} onExplore={scrollToMenu} onCategory={id => chooseCategory(id, true)} />
      <div className={s.catalog} ref={catalog}>
        <div className={s.catalogTop}>
          <p className={s.kicker}>{t.categories}</p>
          <label className={s.search} htmlFor={searchId}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <input id={searchId} type="search" placeholder={t.search} aria-label={t.searchLabel} value={query} onChange={event => setQuery(event.target.value)} maxLength={100} aria-controls={resultsId} />
            {query && <button type="button" onClick={() => setQuery("")} aria-label={t.clearSearch}>×</button>}
          </label>
        </div>
        <div className={s.catalogLayout}>
          <nav className={s.categoryNav} aria-label={t.categories}>
            <button onClick={() => chooseCategory("all")} aria-pressed={category === "all" && !term}><span>{t.all}</span><small>{menuSnapshot.products.length}</small></button>
            {menuSnapshot.categories.map(item => <button key={item.id} onClick={() => chooseCategory(item.id)} aria-pressed={category === item.id && !term} aria-controls={resultsId}>
              <span>{categoryLabel(item.id, item.name, locale)}</span><small>{item.products.length}</small>
            </button>)}
          </nav>
          <section className={s.results} id={resultsId} aria-labelledby={`${resultsId}-heading`}>
            <div className={s.resultsHeading}>
              <div><p className={s.resultCount} role="status">{results.length} {t.count}</p><h3 id={`${resultsId}-heading`}>{term ? t.results : active ? categoryLabel(active.id, active.name, locale) : t.all}<span>.</span></h3></div>
              <div className={s.filters} aria-label={locale === "tr" ? "Ürün filtresi" : "Product filter"} role="group">
                {([['all', t.all], ['featured', t.featured], ['new', t.new]] as const).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
              </div>
            </div>
            {results.length ? <div className={s.grid} key={`${category}-${filter}-${term}`}>
              {results.map(product => <MenuProductCard product={product} locale={locale} onSelect={setSelected} key={product.id} />)}
            </div> : <div className={s.empty}><span aria-hidden="true">↺</span><h4>{t.empty}</h4><p>{t.emptyText}</p><button onClick={clear}>{t.all} ↗</button></div>}
          </section>
        </div>
      </div>
      <section className={s.menuEnd}>
        <div><p className={s.kicker}>{t.endLabel}</p><h3>{t.endTitle}</h3></div>
        <div><p>{t.endText}</p><button onClick={onBranches}>{t.branches}<span aria-hidden="true">↗</span></button></div>
        <span className={s.endStamp} aria-hidden="true">DD.</span>
      </section>
      <footer className={s.menuFooter}><p>{t.note}</p>{!standalone && <Link href={locale === "tr" ? "/menu" : "/en/menu"}>{t.full} ↗</Link>}<b>{t.footer}</b></footer>
      {selected && <MenuProductDetail key={selected.id} product={selected} categoryName={categoryLabel(selected.categoryId, menuSnapshot.categories.find(item => item.id === selected.categoryId)?.name ?? "", locale)} options={menuSnapshot.options} locale={locale} onClose={() => setSelected(null)} onBranches={() => { setSelected(null); onBranches(); }} />}
    </div>
  );
}
