"use client";
import { useState, type FormEvent } from "react";
import { customerRequest, CustomerRequestError, accountError, type Customer } from "@/lib/customer-account";
import type { Locale } from "@/lib/site";
import s from "./account.module.css";
export function ProfileForm({ customer, locale, onUpdated }: { customer: Customer; locale: Locale; onUpdated: (customer: Customer) => void }) {
  const tr = locale === "tr";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [preferredLocale, setPreferredLocale] = useState(customer.locale);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const session = await customerRequest<{ customer: Customer }>("session");
      if (session.customer.id !== customer.id) throw new CustomerRequestError("SESSION_CHANGED", 401);
      const result = await customerRequest<{ customer: Customer }>("profile", { name: name.trim(), locale: preferredLocale }, "PATCH");
      if (result.customer.id !== customer.id) throw new CustomerRequestError("SESSION_CHANGED", 401);
      onUpdated(result.customer); setEditing(false); setMessage(tr ? "Bilgileriniz güncellendi." : "Your details were updated.");
    } catch (issue) {
      setError(issue instanceof CustomerRequestError && issue.status === 401 ? (tr ? "Oturumunuz değişti. Sayfayı yenileyip tekrar giriş yapın." : "Your session changed. Refresh and sign in again.") : issue instanceof CustomerRequestError && [400,422].includes(issue.status) ? (tr ? "Ad soyad 2–120 karakter olmalı." : "Your name must contain 2–120 characters.") : accountError(issue, locale));
    } finally { setBusy(false); }
  }
  return <section className={s.profileEditor}>
    {!editing ? <button className={s.textButton} onClick={() => { setName(customer.name); setPreferredLocale(customer.locale); setEditing(true); setMessage(""); setError(""); }}>{tr ? "Bilgilerimi düzenle" : "Edit my details"}</button> : <form onSubmit={save}>
      <div className={s.field}><label htmlFor="profile-name">{tr ? "Ad soyad" : "Full name"}</label><input id="profile-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={120} disabled={busy} /></div>
      <div className={s.field}><label htmlFor="profile-locale">{tr ? "Tercih ettiğiniz iletişim dili" : "Preferred communication language"}</label><select id="profile-locale" value={preferredLocale} onChange={event => setPreferredLocale(event.target.value as Locale)} disabled={busy}><option value="tr">Türkçe</option><option value="en">English</option></select></div>
      <button className={s.primary} disabled={busy}>{busy ? (tr ? "Kaydediliyor…" : "Saving…") : (tr ? "Değişiklikleri kaydet" : "Save changes")}</button><button type="button" className={s.textButton} disabled={busy} onClick={() => { setEditing(false); setError(""); }}>{tr ? "Vazgeç" : "Cancel"}</button>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p className={s.error} role="alert">{error}</p>}
  </section>;
}
