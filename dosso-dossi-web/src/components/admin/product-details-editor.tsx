import type { BrewingMethod, ProductDetails } from "@/lib/catalog";
import { brewingLabels, roastLabels } from "@/lib/product-helpers";
import s from "./admin.module.css";
export function ProductDetailsEditor({ type, details, onChange }: { type: "COFFEE" | "THERMOS"; details: ProductDetails; onChange: (details: ProductDetails) => void }) {
  function text(key: keyof ProductDetails, value: string) { const next = { ...details }; if (value) Object.assign(next, { [key]: value }); else delete next[key]; onChange(next); }
  const coffee = type === "COFFEE";
  return <section className={s.formCard}><div className={s.sectionHeading}><span>05</span><div><h2>{coffee ? "Kahve bilgileri ve demleme" : "Malzeme ve bakım"}</h2><p>Yalnız doğrulanmış ürün bilgilerini ekleyin. Boş alanlar müşteriye gösterilmez. Kahve bulucu ve ürün karşılaştırması bu bilgileri kullanır.</p></div></div>
    {coffee ? <>
      <div className={s.twoCols}>{(["Tr", "En"] as const).map(language => <label className={s.field} key={language}><span>Köken · {language.toUpperCase()}</span><input maxLength={160} value={details[`origin${language}`] ?? ""} onChange={event => text(`origin${language}`,event.target.value)} /></label>)}</div>
      <label className={s.field}><span>Kavurma profili</span><select value={details.roast ?? ""} onChange={event => text("roast",event.target.value)}><option value="">Belirtilmedi</option>{Object.entries(roastLabels).map(([key, label]) => <option key={key} value={key}>{label.tr}</option>)}</select></label>
      <div className={s.twoCols}>{(["Tr", "En"] as const).map(language => <label className={s.field} key={language}><span>Tat notları · {language.toUpperCase()}</span><input value={details[`tastingNotes${language}`]?.join(", ") ?? ""} onChange={event => onChange({ ...details, [`tastingNotes${language}`]: event.target.value.split(",").map(value => value.trim()) })} /><small>Virgülle ayırın. En fazla 8 not, her biri 80 karakter.</small></label>)}</div>
      <fieldset className={s.formFieldset}><legend>Uygun demleme yöntemleri</legend>{(Object.keys(brewingLabels) as BrewingMethod[]).map(method => <label key={method} className={s.check}><input type="checkbox" checked={details.brewingMethods?.includes(method) ?? false} onChange={event => onChange({ ...details, brewingMethods: event.target.checked ? [...(details.brewingMethods ?? []), method] : details.brewingMethods?.filter(value => value !== method) })} />{brewingLabels[method].tr}</label>)}</fieldset>
      <div className={s.twoCols}>{(["Tr", "En"] as const).map(language => <label className={s.field} key={language}><span>Demleme rehberi · {language.toUpperCase()}</span><textarea rows={5} maxLength={2000} value={details[`brewGuide${language}`] ?? ""} onChange={event => text(`brewGuide${language}`,event.target.value)} /><small>Ürüne uygun gramaj, su miktarı ve yöntem. Bilgi yoksa boş bırakın.</small></label>)}</div>
    </> : <>
      <div className={s.twoCols}>{(["Tr", "En"] as const).map(language => <label className={s.field} key={language}><span>Malzeme · {language.toUpperCase()}</span><input maxLength={200} value={details[`material${language}`] ?? ""} onChange={event => text(`material${language}`,event.target.value)} /></label>)}</div>
      <div className={s.twoCols}>{(["Tr", "En"] as const).map(language => <label className={s.field} key={language}><span>Kullanım ve bakım · {language.toUpperCase()}</span><textarea rows={5} maxLength={2000} value={details[`care${language}`] ?? ""} onChange={event => text(`care${language}`,event.target.value)} /></label>)}</div>
    </>}
  </section>;
}
