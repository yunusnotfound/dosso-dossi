"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/site";
import { franchisePhone } from "@/components/store3d/store-info-data";
import s from "./franchise-brief.module.css";

const copy = {
  tr: {
    eyebrow: "BİR SONRAKİ BULUŞMA NOKTAMIZ", title: ["BİRLİKTE", "BÜYÜYELİM."], intro: "Şehrini ve fikrini anlat. Dosso Dossi Coffee iş ortaklığı için ilk adımı at.",
    steps: ["Şehir", "Mekân", "Deneyim", "İletişim"], questions: ["Hangi şehirde hayal ediyorsun?", "Aklında bir yer var mı?", "Bu yolculuğa nereden başlıyorsun?", "Seni tanıyalım."],
    hints: ["Aklındaki şehri yaz.", "Henüz bir yer seçmemiş olabilirsin. Sana en yakın seçeneği işaretle.", "Kendini en iyi anlatan seçeneği işaretle.", "Başvurunu değerlendirebilmemiz için iletişim bilgilerini ve fikrini paylaş."],
    city: "Şehir", placeholder: "Örneğin, İstanbul", cityError: "En az iki karakterli bir şehir yaz.", choiceError: "Devam etmek için bir seçenek belirle.",
    space: ["Yerim hazır", "Yer arıyorum", "Henüz karar vermedim"], experience: ["İlk girişimim", "İşletmecilik deneyimim var"],
    next: "DEVAM ET", finish: "BAŞVURUMU GÖNDER", busy: "GÖNDERİLİYOR…", back: "Geri", step: "ADIM", ready: "BAŞVURUN KAYDEDİLDİ", result: "Tanıştığımıza memnun olduk.",
    local: "Başvurun ekibimizin değerlendirmesine iletilir. Bu form bir yatırım veya iş ortaklığı taahhüdü oluşturmaz.",
    name: "Ad soyad", email: "E-posta", phone: "Telefon (Türkiye)", message: "Fikrinden biraz bahset", privacy: "Bilgilerimin başvurumun değerlendirilmesi ve benimle iletişim kurulması için kullanılacağını okudum.", privacyLink: "Veri kullanımı hakkında", contact: "Bizimle iletişime geç", receipt: "Başvuru numaran", success: "İletişim bilgilerin ve fikrin kaydedildi. Başvuru numaranı saklayabilirsin.", failure: "Başvuru gönderilemedi. Bilgilerin korunuyor; lütfen yeniden dene.",
  },
  en: {
    eyebrow: "OUR NEXT MEETING PLACE", title: ["LET’S GROW", "TOGETHER."], intro: "Tell us about your city and your idea. Take the first step toward a Dosso Dossi Coffee partnership.",
    steps: ["City", "Space", "Experience", "Contact"], questions: ["Which city do you have in mind?", "Do you have a space in mind?", "Where does your journey begin?", "Let’s get to know you."],
    hints: ["Start with a city.", "You may still be looking. Choose the answer closest to your plans.", "Choose the answer that best describes you.", "Share your contact details and your idea so our team can review your inquiry."],
    city: "City", placeholder: "For example, Istanbul", cityError: "Enter a city of at least two characters.", choiceError: "Choose an option to continue.",
    space: ["I have a space", "I’m looking for a space", "I haven’t decided yet"], experience: ["This is my first venture", "I have business experience"],
    next: "CONTINUE", finish: "SEND MY INQUIRY", busy: "SENDING…", back: "Back", step: "STEP", ready: "INQUIRY RECEIVED", result: "A pleasure to meet you.",
    local: "Your inquiry is sent to our team for review. This form does not constitute an investment or partnership commitment.",
    name: "Full name", email: "Email", phone: "Phone (Türkiye)", message: "Tell us about your idea", privacy: "I have read that my details will be used to review my inquiry and contact me.", privacyLink: "About data use", contact: "Contact us", receipt: "Your reference", success: "Your contact details and idea have been saved. Please keep your reference number.", failure: "Your inquiry could not be sent. Your details are still here; please try again.",
  },
} as const;

export function FranchiseBrief({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [step, setStep] = useState(0), [city, setCity] = useState("");
  const [space, setSpace] = useState<number | null>(null), [experience, setExperience] = useState<number | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [privacy, setPrivacy] = useState(false), [busy, setBusy] = useState(false), [receipt, setReceipt] = useState("");
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLSpanElement>(null), shouldFocus = useRef(false);
  const id = useId();
  useEffect(() => { if (shouldFocus.current) { titleRef.current?.focus({ preventScroll: true }); titleRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); } shouldFocus.current = false; }, [step, receipt]);
  function changeStep(next: number) { shouldFocus.current = true; setError(""); setStep(next); }
  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step === 0 && city.trim().length < 2) { setError(t.cityError); return; }
    if ((step === 1 && space === null) || (step === 2 && experience === null)) { setError(t.choiceError); return; }
    if (step < 3) { changeStep(step + 1); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/web/franchise-inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...contact, city: city.trim(), space: ["READY", "SEARCHING", "UNDECIDED"][space!], experience: ["FIRST", "EXPERIENCED"][experience!], privacyAcknowledged: privacy }) });
      const result: { receipt?: string } = await response.json();
      if (!response.ok || !result.receipt) throw new Error(t.failure);
      shouldFocus.current = true; setReceipt(result.receipt);
    } catch { setError(t.failure); } finally { setBusy(false); }
  }
  return (
    <section id="franchise-form" className={s.brief} aria-labelledby={`${id}-title`}>
      <div className={s.intro}>
        <p className={s.eyebrow}><span />{t.eyebrow}</p><h3 id={`${id}-title`}>{t.title[0]}<br /><em>{t.title[1]}</em></h3>
        <p className={s.introText}>{t.intro}</p>
        <ol className={s.progress} aria-label={locale === "tr" ? "Başvuru adımları" : "Inquiry steps"}>{t.steps.map((label, index) => <li key={label} aria-current={!receipt && step === index ? "step" : undefined} data-complete={Boolean(receipt) || step > index}><span>{receipt || step > index ? "✓" : `0${index + 1}`}</span><strong>{label}</strong></li>)}</ol>
        <p className={s.localNote}>{t.local}</p>
      </div>
      <div className={s.workspace}>
        <p className={s.stepMeta}>{receipt ? t.ready : `${t.step} 0${step + 1} / 04`}<span aria-hidden="true">↗</span></p>
        {receipt ? <div className={s.result} role="status"><h4 className={s.resultTitle}><span ref={titleRef} tabIndex={-1}>{t.result}</span></h4><p>{t.success}</p><div className={s.receipt}><span>{t.receipt}</span><strong>{receipt}</strong></div><a className={s.phone} href={franchisePhone}><span>{t.contact}</span><strong>+90 212 242 21 21</strong></a></div> :
          <form className={s.form} onSubmit={advance} aria-busy={busy}>
            <fieldset className={s.fields} disabled={busy} aria-describedby={`${id}-hint`}>
              <legend><span ref={titleRef} tabIndex={-1}>{t.questions[step]}</span></legend><p id={`${id}-hint`} className={s.hint}>{t.hints[step]}</p>
              {step === 0 ? <div className={s.cityField}><label htmlFor={`${id}-city`}>{t.city}</label><input id={`${id}-city`} name="city" required minLength={2} maxLength={80} autoComplete="address-level2" value={city} placeholder={t.placeholder} onChange={e => { setCity(e.target.value); setError(""); }} /></div> : step < 3 ? <div className={s.options}>{(step === 1 ? t.space : t.experience).map((label, index) => <label key={`${step}-${index}`}><input type="radio" name={`${id}-step-${step}`} value={index} required checked={(step === 1 ? space : experience) === index} onChange={() => { if (step === 1) setSpace(index); else setExperience(index); setError(""); }} /><span>{label}</span><i aria-hidden="true">↗</i></label>)}</div> : <>
                <div className={s.contactGrid}>{(["name", "email", "phone"] as const).map(field => <label key={field}>{t[field]}<input name={field} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} autoComplete={field === "name" ? "name" : field === "phone" ? "tel" : "email"} required minLength={field === "name" ? 2 : undefined} maxLength={field === "name" ? 120 : field === "email" ? 254 : 32} pattern={field === "phone" ? "[+0-9 ()-]{10,32}" : undefined} placeholder={field === "phone" ? "+90 5xx xxx xx xx" : undefined} value={contact[field]} onChange={e => setContact({ ...contact, [field]: e.target.value })} /></label>)}</div>
                <label className={s.message}>{t.message}<textarea required minLength={10} maxLength={3000} rows={4} value={contact.message} onChange={e => setContact({ ...contact, message: e.target.value })} /></label>
                <label className={s.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={e => setContact({ ...contact, website: e.target.value })} /></label>
                <label className={s.privacy}><input type="checkbox" required checked={privacy} onChange={e => setPrivacy(e.target.checked)} /><span>{t.privacy} <Link href={`${locale === "en" ? "/en" : ""}/bilgilendirme/gizlilik#franchise`} target="_blank">{t.privacyLink} ↗</Link></span></label>
              </>}
            </fieldset>
            <p className={s.error} role="alert">{error}</p><div className={s.formActions}>{step > 0 ? <button className={s.back} type="button" disabled={busy} onClick={() => changeStep(step - 1)}>← {t.back}</button> : <span />}<button className={s.primary} type="submit" disabled={busy}>{busy ? t.busy : step === 3 ? t.finish : t.next}<span aria-hidden="true">→</span></button></div>
          </form>}
      </div>
    </section>
  );
}
