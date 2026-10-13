import Image from "next/image";
import type { Locale } from "@/lib/site";
import { formatPrice } from "@/lib/catalog";
import { commerceImageUrl } from "@/lib/web-commerce";
import type { OrderAddress, OrderLine } from "@/lib/web-orders";
import { provinceName } from "@/components/account/address-provinces";
import s from "./orders.module.css";

export function OrderLines({
  lines,
  locale,
}: {
  lines: OrderLine[];
  locale: Locale;
}) {
  return (
    <div className={s.lines}>
      {lines.map((line) => {
        const image = commerceImageUrl(line.imageUrl);
        return (
          <article className={s.line} key={line.id}>
            <div className={s.image}>
              {image && <Image src={image} alt="" fill sizes="76px" />}
            </div>
            <div>
              <h3>{locale === "tr" ? line.nameTr : line.nameEn}</h3>
              <p>
                {[
                  locale === "tr" ? line.variantLabelTr : line.variantLabelEn,
                  locale === "tr" ? line.grindNameTr : line.grindNameEn,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <small>
                {line.quantity} × {formatPrice(line.unitPriceMinor, locale)}
              </small>
            </div>
            <strong>{formatPrice(line.lineTotalMinor, locale)}</strong>
          </article>
        );
      })}
    </div>
  );
}
export function OrderAddressCard({
  address,
  locale,
}: {
  address: OrderAddress;
  locale: Locale;
}) {
  return (
    <section className={s.card}>
      <p className={s.eyebrow}>
        {locale === "tr" ? "TESLİMAT ADRESİ" : "DELIVERY ADDRESS"}
      </p>
      <h2>{address.title}</h2>
      <address className={s.address}>
        <strong>{address.recipientName}</strong>
        <span>
          {address.neighborhood}, {address.addressLine}
        </span>
        <span>
          {address.district} / {provinceName(address.provinceCode)} ·{" "}
          {address.postalCode} · Türkiye
        </span>
        <span>{address.phone}</span>
      </address>
    </section>
  );
}
export function OrderTotals({
  subtotalMinor,
  shippingFeeMinor,
  totalMinor,
  locale,
}: {
  subtotalMinor: number;
  shippingFeeMinor: number;
  totalMinor: number;
  locale: Locale;
}) {
  return (
    <dl className={s.totals}>
      <div>
        <dt>{locale === "tr" ? "Ürünler toplamı" : "Product subtotal"}</dt>
        <dd>{formatPrice(subtotalMinor, locale)}</dd>
      </div>
      <div>
        <dt>{locale === "tr" ? "Kargo" : "Delivery"}</dt>
        <dd>
          {shippingFeeMinor === 0
            ? locale === "tr"
              ? "Ücretsiz"
              : "Free"
            : formatPrice(shippingFeeMinor, locale)}
        </dd>
      </div>
      <div className={s.total}>
        <dt>{locale === "tr" ? "Toplam" : "Total"}</dt>
        <dd>{formatPrice(totalMinor, locale)}</dd>
      </div>
    </dl>
  );
}
