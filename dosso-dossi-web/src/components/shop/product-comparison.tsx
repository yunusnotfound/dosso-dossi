"use client";
import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/site";
import { formatPrice, minimumPriceMinor, variantLabel, type CatalogItem } from "@/lib/catalog";
import { detailRows, productSelectionPath } from "@/lib/product-helpers";
import s from "./shop-discovery.module.css";
export function ProductComparison({ items, locale, onRemove }: { items: CatalogItem[]; locale: Locale; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  const tr = locale === "tr";
  const allLabels = [...new Set(items.flatMap(item => detailRows(item.product, locale).map(row => row.label)))];
  return <section className={s.comparison} aria-labelledby="compare-title"><h2 id="compare-title">{tr ? "Yan yana karar ver." : "Compare your favourites."}</h2><p>{tr ? "En fazla üç ürünün fiyatını ve belirtilen özelliklerini karşılaştırın." : "Compare prices and listed details for up to three products."}</p><div className={s.tableWrap} tabIndex={0} role="region" aria-label={tr ? "Ürün karşılaştırma tablosu" : "Product comparison table"}><table><thead><tr><th scope="col">{tr ? "Özellik" : "Feature"}</th>{items.map(item => <th scope="col" key={item.id}><div className={s.compareProduct}>{item.image && <Image src={item.image} alt="" width={65} height={80} />}<Link href={productSelectionPath(locale, item)}>{item.name[locale]}<small>{variantLabel(item, locale)}</small></Link><button onClick={() => onRemove(item.id)} aria-label={`${item.name[locale]} · ${tr ? "Karşılaştırmadan çıkar" : "Remove from comparison"}`}>×</button></div></th>)}</tr></thead><tbody><tr><th scope="row">{tr ? "Başlangıç fiyatı" : "From"}</th>{items.map(item => <td key={item.id}>{formatPrice(minimumPriceMinor(item), locale)}</td>)}</tr>{allLabels.map(label => <tr key={label}><th scope="row">{label}</th>{items.map(item => <td key={item.id}>{detailRows(item.product, locale).find(row => row.label === label)?.value ?? (tr ? "Belirtilmemiş" : "Not specified")}</td>)}</tr>)}<tr><th scope="row">{tr ? "Stok" : "Availability"}</th>{items.map(item => <td key={item.id}>{item.variant.stock > 0 ? (tr ? "Stokta" : "In stock") : (tr ? "Tükendi" : "Sold out")}</td>)}</tr></tbody></table></div></section>;
}
