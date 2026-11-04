import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCatalog } from "@/lib/backend";
import type { Locale } from "@/lib/site";
import { productPath } from "@/lib/product-helpers";
import { publicPageMetadata } from "@/lib/site-seo";
import { WebsiteHeader } from "@/components/website/website-header";
import { SiteFooter } from "@/components/site-chrome";
import { ProductDetail } from "./product-detail";
import s from "./product-detail.module.css";

export async function productMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const catalog = await getCatalog();
  const product = catalog.products.find(product => product.slug === slug);
  if (!product) return { title: locale === "tr" ? "Ürün" : "Product", robots: { index: false, follow: false } };
  const title = locale === "tr" ? product.nameTr : product.nameEn;
  const description = (locale === "tr" ? product.descriptionTr : product.descriptionEn).slice(0, 160);
  return publicPageMetadata({ locale, path: productPath("tr", slug), title, description, ...(product.images[0] ? { image: product.images[0].url } : {}) });
}

export async function ProductPage({ locale, slug }: { locale: Locale; slug: string }) {
  const catalog = await getCatalog();
  const product = catalog.products.find(product => product.slug === slug);
  if (catalog.available && !product) notFound();
  return <>
    <a className="skip-link" href="#main-content">{locale === "tr" ? "İçeriğe geç" : "Skip to content"}</a>
    <WebsiteHeader locale={locale} active="shop" languagePaths={{ tr: productPath("tr", slug), en: productPath("en", slug) }} />
    <main id="main-content">
      {product ? <ProductDetail locale={locale} product={product} /> : <section className={s.unavailable}><h1>{locale === "tr" ? "Ürün bilgileri şu anda yüklenemiyor." : "Product information is currently unavailable."}</h1><p>{locale === "tr" ? "Biraz sonra yeniden deneyin." : "Please try again shortly."}</p><Link href={locale === "tr" ? "/alisveris" : "/en/alisveris"}>{locale === "tr" ? "Mağazaya dön" : "Back to shop"}</Link></section>}
    </main>
    <SiteFooter locale={locale} />
  </>;
}
