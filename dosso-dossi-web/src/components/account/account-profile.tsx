import Link from "next/link";
import { pagePath, type Locale } from "@/lib/site";
import { type Customer } from "@/lib/customer-account";
import { addressesPath, cartPath } from "@/lib/web-commerce";
import { ordersPath } from "@/lib/web-orders";
import { AccountIcon } from "./account-icon";
import s from "./account.module.css";
import { ProfileForm } from "./profile-form";

export function AccountProfile({ customer, locale, busy, error, onLogout, onUpdated }: {
  customer: Customer;
  locale: Locale;
  busy: boolean;
  error: string;
  onLogout: () => void;
  onUpdated: (customer: Customer) => void;
}) {
  const tr = locale === "tr";
  const links = [
    { kind: "orders" as const, href: ordersPath(locale), title: tr ? "Siparişlerim" : "My orders", description: tr ? "Siparişlerinizi ve detaylarını görüntüleyin." : "View your orders and their details." },
    { kind: "bag" as const, href: cartPath(locale), title: tr ? "Sepetim" : "My bag", description: tr ? "Seçtiğiniz lezzetlerden devam edin." : "Pick up where you left off." },
    { kind: "address" as const, href: addressesPath(locale), title: tr ? "Adreslerim" : "My addresses", description: tr ? "Teslimat adreslerinizi kolayca yönetin." : "Manage your delivery addresses." },
  ];
  return (
    <div className={s.profile}>
      <div className={s.profileWelcome}>
        <div className={s.monogram} aria-hidden="true">{customer.name.trim().slice(0, 1).toLocaleUpperCase(locale)}</div>
        <div>
          <p className={s.kicker}>{tr ? "Hoş geldiniz," : "Welcome,"}</p>
          <h2>{customer.name}</h2>
        </div>
      </div>
      <p className={s.description}>{tr ? "Kahve molanızın kontrolü sizde. Bugün nereden başlayalım?" : "Your coffee break, your way. Where shall we start?"}</p>
      <nav className={s.accountLinks} aria-label={tr ? "Hesap kısayolları" : "Account shortcuts"}>
        {links.map((link) => (
          <Link key={link.kind} href={link.href}>
            <span className={s.shortcutIcon}><AccountIcon kind={link.kind} /></span>
            <span className={s.shortcutCopy}><strong>{link.title}</strong><small>{link.description}</small></span>
            <span className={s.shortcutArrow} aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
      <div className={s.profileDetails}>
        <h3>{tr ? "Üyelik bilgileriniz" : "Your account details"}</h3>
        <dl>
          <div><dt>{tr ? "Ad soyad" : "Full name"}</dt><dd>{customer.name}</dd></div>
          <div><dt>{tr ? "E-posta adresi" : "Email address"}</dt><dd>{customer.email}</dd></div>
        </dl>
        <span className={customer.emailVerifiedAt ? s.verified : s.pending}>
          {customer.emailVerifiedAt ? (tr ? "✓ E-posta doğrulandı" : "✓ Email verified") : (tr ? "Doğrulama bekleniyor" : "Verification pending")}
        </span>
      </div>
      <ProfileForm customer={customer} locale={locale} onUpdated={onUpdated} />
      {error && <p className={s.error} role="alert">{error}</p>}
      <Link className={s.primary} href={pagePath(locale, "shop")}>{tr ? "Mağazayı keşfet" : "Explore the store"}<span aria-hidden="true">↗</span></Link>
      <button className={s.textButton} onClick={onLogout} disabled={busy}>{busy ? (tr ? "Lütfen bekleyin…" : "Please wait…") : (tr ? "Çıkış yap" : "Sign out")}</button>
    </div>
  );
}
