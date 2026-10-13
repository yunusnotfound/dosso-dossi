"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { AdminApiError, adminRequest, draftKey, mediaUrl, newVariant, prepareProduct, slugify, statusLabels, stockChanged, type AdminProduct, type GrindDraft, type ProductDraft, type ProductImage, type ProductStatus, type ProductType, type VariantDraft } from "@/lib/admin-catalog";
import styles from "./admin.module.css";

type Props = { initial: ProductDraft; original?: AdminProduct; onSaved: (product: AdminProduct, wasSaved?: boolean) => void; onClose: () => void; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void; onExpired: () => void; onDraftChange: (draft: ProductDraft) => void };

export function ProductEditor({ initial, original, onSaved, onClose, onDirty, onBusy, onExpired, onDraftChange }: Props) {
  const [draft, setDraft] = useState(initial);
  const draftRef = useRef(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const errorsRef = useRef<HTMLDivElement>(null);
  const isCoffee = draft.type === "COFFEE";
  const changedStock = stockChanged(draft, original);
  const disabled = saving || uploading || reloading;

  useEffect(() => { onBusy(disabled); }, [disabled, onBusy]);
  useEffect(() => () => onBusy(false), [onBusy]);

  function change(patch: Partial<ProductDraft> | ((current: ProductDraft) => ProductDraft)) {
    const current = draftRef.current;
    const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
    draftRef.current = next; setDraft(next); onDraftChange(next); onDirty(JSON.stringify(next) !== JSON.stringify(initial));
  }
  function editVariant(key: string, patch: Partial<VariantDraft>) { change(current => ({ ...current, variants: current.variants.map(variant => variant.key === key ? { ...variant, ...patch } : variant) })); }
  function editGrind(key: string, patch: Partial<GrindDraft>) { change(current => ({ ...current, grindOptions: current.grindOptions.map(grind => grind.key === key ? { ...grind, ...patch } : grind) })); }
  function editImage(mediaId: string, patch: Partial<ProductImage>) { change(current => ({ ...current, images: current.images.map(image => image.mediaId === mediaId ? { ...image, ...patch } : image) })); }
  function removeImage(mediaId: string) { change(current => ({ ...current, images: current.images.filter(image => image.mediaId !== mediaId), variants: current.variants.map(variant => variant.imageId === mediaId ? { ...variant, imageId: null } : variant) })); }
  function moveImage(index: number, direction: -1 | 1) { change(current => { const images = [...current.images]; [images[index], images[index + direction]] = [images[index + direction], images[index]]; return { ...current, images }; }); }
  function changeType(type: ProductType) {
    change(current => ({ ...current, type, variants: current.variants.map(variant => ({ ...variant, weight: type === "COFFEE" ? variant.weight || "250" : "", volume: type === "THERMOS" ? variant.volume : "", colorNameTr: null, colorNameEn: null, colorHex: null })), grindOptions: [] }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (disabled) return;
    setErrors([]); setConflict(false);
    const result = prepareProduct(draftRef.current, original);
    if (!result.payload) { setErrors(result.errors); requestAnimationFrame(() => errorsRef.current?.focus()); return; }
    setSaving(true);
    try { const response = await adminRequest<{ product: AdminProduct }>(original ? `/products/${encodeURIComponent(original.id)}` : "/products", { method: original ? "PUT" : "POST", body: JSON.stringify(result.payload) }); onSaved(response.product); }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) onExpired();
      else {
        setConflict(error instanceof AdminApiError && error.status === 409);
        setErrors([error instanceof Error ? error.message : "Ürün kaydedilemedi. Yeniden deneyin."]);
        requestAnimationFrame(() => errorsRef.current?.focus());
      }
    } finally { setSaving(false); }
  }
  async function reloadLatest() {
    if (!original || !window.confirm("Sunucudaki güncel ürünü yüklemek bu formdaki kaydedilmemiş değişiklikleri kaldırır. Devam edilsin mi?")) return;
    setReloading(true);
    try { const result = await adminRequest<{ product: AdminProduct }>(`/products/${encodeURIComponent(original.id)}`); onSaved(result.product, false); }
    catch (error) { if (error instanceof AdminApiError && error.status === 401) onExpired(); else setErrors([error instanceof Error ? error.message : "Güncel ürün yüklenemedi."]); }
    finally { setReloading(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (!files.length) return;
    setUploadError("");
    if (draftRef.current.images.length + files.length > 20) { setUploadError("Ürün başına en fazla 20 görsel eklenebilir. Daha az dosya seçin veya mevcut görsellerden birini kaldırın."); return; }
    const invalid = files.find(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0);
    if (invalid) { setUploadError(`${invalid.name}: JPG, PNG veya WebP biçiminde, en fazla 5 MB olan bir görsel seçin.`); return; }
    setUploading(true);
    for (const file of files) {
      try {
        const data = await fileBase64(file);
        const result = await adminRequest<{ media: { id: string; url: string } }>("/media", { method: "POST", body: JSON.stringify({ filename: file.name, mimeType: file.type, data }) });
        change(current => ({ ...current, images: [...current.images, { mediaId: result.media.id, url: result.media.url, altTr: current.nameTr, altEn: current.nameEn, sortOrder: current.images.length }] }));
      } catch (error) {
        if (error instanceof AdminApiError && error.status === 401) onExpired();
        else setUploadError(`${file.name}: ${error instanceof Error ? error.message : "Görsel yüklenemedi."} Kalan görseller için yeniden yükleme yapabilirsiniz.`);
        break;
      }
    }
    setUploading(false);
  }

  return <form onSubmit={save} noValidate>
    <div className={styles.editorHeading}><button type="button" className={styles.backLink} onClick={onClose} disabled={disabled}>← Ürün listesi</button><div className={styles.editorTitle}><div><p className={styles.eyebrow}>{original ? "ÜRÜNÜ DÜZENLE" : "YENİ ÜRÜN"}</p><h1>{original?.nameTr || "Rafınıza yeni bir ürün."}</h1></div><div className={styles.headingActions}><button type="button" className={styles.secondary} onClick={onClose} disabled={disabled}>Vazgeç</button><button type="submit" className={styles.primary} disabled={disabled}>{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button></div></div></div>
    {errors.length > 0 && <div className={styles.errorSummary} role="alert" ref={errorsRef} tabIndex={-1}><strong>Ürün kaydedilemedi</strong><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>{conflict && original && <div><p>Formunuz korunuyor. Ürün başka bir oturumda güncellenmiş veya stok kodu/adres zaten kullanılıyor olabilir. Çakışan alanları kontrol edin.</p><button className={styles.secondary} type="button" onClick={() => void reloadLatest()} disabled={disabled}>Sunucudaki güncel ürünü yükle</button></div>}</div>}
    <fieldset className={styles.formFieldset} disabled={disabled}>
      <div className={styles.editorGrid}><div className={styles.editorSections}>
        <section className={styles.formCard}><SectionHeading step="01" title="Ürün bilgileri" description="Mağazanın iki dilinde de görünecek ad ve açıklamalar." />
          <div className={styles.twoCols}><Field label="Ürün adı · Türkçe" required><input value={draft.nameTr} maxLength={160} onChange={event => change({ nameTr: event.target.value })} placeholder="Örn. Türk Kahvesi" /></Field><Field label="Ürün adı · İngilizce" required><input value={draft.nameEn} maxLength={160} onChange={event => change({ nameEn: event.target.value })} placeholder="Örn. Turkish Coffee" /></Field></div>
          <div className={styles.twoCols}><Field label="Açıklama · Türkçe"><textarea rows={5} value={draft.descriptionTr} maxLength={10000} onChange={event => change({ descriptionTr: event.target.value })} placeholder="Ürünün tadını, malzemesini veya kullanım özelliklerini anlatın." /></Field><Field label="Açıklama · İngilizce"><textarea rows={5} value={draft.descriptionEn} maxLength={10000} onChange={event => change({ descriptionEn: event.target.value })} placeholder="Ürün açıklamasının İngilizce karşılığı." /></Field></div>
          <div className={styles.slugRow}><Field label="Ürün adresi (slug)" required hint="Küçük İngilizce harf, rakam ve tire kullanın. Her ürün için benzersiz olmalıdır."><input value={draft.slug} maxLength={180} onChange={event => change({ slug: event.target.value })} placeholder="turk-kahvesi" autoCapitalize="none" spellCheck={false} /></Field><button type="button" className={styles.secondary} onClick={() => change({ slug: slugify(draft.nameTr) })} disabled={!draft.nameTr.trim()}>İsimden oluştur</button></div>
        </section>
        <section className={styles.formCard}><SectionHeading step="02" title="Ürün görselleri" description="İlk görsel ürünün kapak fotoğrafıdır. Sıralamayı oklarla değiştirebilirsiniz." />
          <label className={`${styles.uploadArea} ${uploading ? styles.uploading : ""}`}><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => void upload(event)} disabled={disabled} /><span className={styles.uploadIcon} aria-hidden="true">↑</span><strong>{uploading ? "Görseller yükleniyor…" : "Görsel seçin ve yükleyin"}</strong><span>JPG, PNG veya WebP · Her dosya en fazla 5 MB</span></label>
          <p className={styles.help}>Görselleri ürüne bağlamak ve sıralamayı uygulamak için ürünü kaydedin.</p>
          {uploadError && <p className={styles.error} role="alert">{uploadError}</p>}
          {draft.images.length > 0 && <div className={styles.gallery}>{draft.images.map((image, index) => <div className={styles.galleryItem} key={image.mediaId}><div className={styles.galleryPreview}><img src={mediaUrl(image.url)} alt={image.altTr || "Yüklenen ürün görseli"} />{index === 0 && <span>Kapak görseli</span>}</div><div className={styles.galleryFields}><Field label="Görsel açıklaması · TR"><input value={image.altTr} maxLength={250} onChange={event => editImage(image.mediaId, { altTr: event.target.value })} /></Field><Field label="Görsel açıklaması · EN"><input value={image.altEn} maxLength={250} onChange={event => editImage(image.mediaId, { altEn: event.target.value })} /></Field><div className={styles.galleryActions}><span>{index + 1}. görsel</span><button type="button" className={styles.iconButton} disabled={index === 0} onClick={() => moveImage(index, -1)} aria-label={`${index + 1}. görseli öne al`}>↑</button><button type="button" className={styles.iconButton} disabled={index === draft.images.length - 1} onClick={() => moveImage(index, 1)} aria-label={`${index + 1}. görseli sona al`}>↓</button><button type="button" className={styles.dangerButton} onClick={() => removeImage(image.mediaId)}>Kaldır</button></div></div></div>)}</div>}
        </section>
        <section className={styles.formCard}><SectionHeading step="03" title={isCoffee ? "Gramaj, fiyat ve stok" : "Renk, fiyat ve stok"} description={isCoffee ? "Her gramaj için ayrı bir stok kodu ve fiyat tanımlayın. Öğütüm seçenekleri bu stoktan kullanılır." : "Her renk ve hacim için ayrı bir stok kodu, görsel, fiyat ve stok tanımlayın."} />
          <div className={styles.variantList}>{draft.variants.map((variant, index) => <div className={`${styles.variant} ${!variant.active ? styles.inactiveVariant : ""}`} key={variant.key}><div className={styles.variantHeader}><h3>{String(index + 1).padStart(2, "0")} <span>{variant.labelTr || "Yeni varyant"}</span></h3><label className={styles.check}><input type="checkbox" checked={variant.active} onChange={event => editVariant(variant.key, { active: event.target.checked })} /> Aktif</label>{!variant.id && draft.variants.length > 1 && <button className={styles.dangerButton} type="button" onClick={() => change(current => ({ ...current, variants: current.variants.filter(item => item.key !== variant.key) }))}>Kaldır</button>}</div>
            <div className={styles.twoCols}><Field label="Varyant adı · Türkçe" required><input value={variant.labelTr} maxLength={120} onChange={event => editVariant(variant.key, { labelTr: event.target.value })} placeholder={isCoffee ? "250 g" : "Turuncu · 500 ml"} /></Field><Field label="Varyant adı · İngilizce" required><input value={variant.labelEn} maxLength={120} onChange={event => editVariant(variant.key, { labelEn: event.target.value })} placeholder={isCoffee ? "250 g" : "Orange · 500 ml"} /></Field></div>
            <div className={styles.twoCols}><Field label="Stok kodu (SKU)" required hint="Tüm ürünler arasında benzersiz olmalıdır."><input value={variant.sku} maxLength={80} autoCapitalize="none" spellCheck={false} onChange={event => editVariant(variant.key, { sku: event.target.value })} placeholder={isCoffee ? "DD-TK-250" : "DD-TERMOS-ORANGE"} /></Field>{isCoffee ? <Field label="Gramaj (g)" required><input inputMode="numeric" value={variant.weight} onChange={event => editVariant(variant.key, { weight: event.target.value })} placeholder="250" /></Field> : <Field label="Hacim (ml)" hint="İsteğe bağlı."><input inputMode="numeric" value={variant.volume} onChange={event => editVariant(variant.key, { volume: event.target.value })} placeholder="500" /></Field>}</div>
            {!isCoffee && <div className={styles.threeCols}><Field label="Renk adı · Türkçe" required><input value={variant.colorNameTr || ""} maxLength={60} onChange={event => editVariant(variant.key, { colorNameTr: event.target.value })} placeholder="Turuncu" /></Field><Field label="Renk adı · İngilizce" required><input value={variant.colorNameEn || ""} maxLength={60} onChange={event => editVariant(variant.key, { colorNameEn: event.target.value })} placeholder="Orange" /></Field><Field label="Renk kodu" required><span className={styles.colorInput}><input type="color" aria-label={`${index + 1}. varyant için renk seç`} value={/^#[a-fA-F0-9]{6}$/.test(variant.colorHex || "") ? variant.colorHex! : "#b65b35"} onChange={event => editVariant(variant.key, { colorHex: event.target.value })} /><input value={variant.colorHex || ""} maxLength={7} placeholder="#B65B35" aria-label={`${index + 1}. varyant renk kodu`} onChange={event => editVariant(variant.key, { colorHex: event.target.value })} /></span></Field></div>}
            <div className={styles.threeCols}><Field label="Satış fiyatı (₺)" required hint="KDV dahil fiyat. Örn. 350,00"><input inputMode="decimal" value={variant.price} onChange={event => editVariant(variant.key, { price: event.target.value })} placeholder="350,00" /></Field><Field label="Stok (adet)" required><input inputMode="numeric" value={variant.stock} onChange={event => editVariant(variant.key, { stock: event.target.value })} /></Field><Field label="Varyant görseli"><select value={variant.imageId || ""} onChange={event => editVariant(variant.key, { imageId: event.target.value || null })}><option value="">Ürünün kapak görseli</option>{draft.images.map((image, imageIndex) => <option value={image.mediaId} key={image.mediaId}>{imageIndex + 1}. {image.altTr || "Görsel"}</option>)}</select></Field></div>
            {!variant.active && <p className={styles.help}>Pasif varyant mağazada seçenek olarak gösterilmez. Kaydı ve stok bilgisi korunur.</p>}
          </div>)}</div>
          <button type="button" className={styles.addButton} onClick={() => change(current => ({ ...current, variants: [...current.variants, newVariant(current.type)] }))}>＋ {isCoffee ? "Gramaj varyantı ekle" : "Renk / hacim varyantı ekle"}</button>
          {original && <div className={styles.stockReason}><Field label="Stok değişiklik nedeni" required={changedStock} hint="Stok miktarını değiştirdiğinizde, hareket geçmişi için nedenini belirtin."><input value={draft.stockReason} maxLength={500} onChange={event => change({ stockReason: event.target.value })} placeholder="Örn. Yeni ürün teslimatı veya sayım düzeltmesi" /></Field></div>}
        </section>
        {isCoffee && <section className={styles.formCard}><SectionHeading step="04" title="Öğütüm seçenekleri" description="Aynı gramaj stokunu paylaşan seçenekler ekleyin. Öğütüm için ayrı stok oluşturulmaz." />
          {!draft.grindOptions.length && <p className={styles.inlineEmpty}>Henüz öğütüm seçeneği eklenmedi. Çekirdek, espresso veya filtre gibi ürününüze uygun seçenekler tanımlayabilirsiniz.</p>}
          {draft.grindOptions.map((grind, index) => <div className={styles.grindCard} key={grind.key}><div className={styles.variantHeader}><h3>{String(index + 1).padStart(2, "0")} <span>{grind.nameTr || "Yeni öğütüm"}</span></h3><label className={styles.check}><input type="checkbox" checked={grind.active} onChange={event => editGrind(grind.key, { active: event.target.checked })} /> Aktif</label>{!grind.id && <button type="button" className={styles.dangerButton} onClick={() => change(current => ({ ...current, grindOptions: current.grindOptions.filter(item => item.key !== grind.key) }))}>Kaldır</button>}</div><div className={styles.twoCols}><Field label="Öğütüm adı · Türkçe" required><input value={grind.nameTr} maxLength={100} onChange={event => editGrind(grind.key, { nameTr: event.target.value })} placeholder="Espresso" /></Field><Field label="Öğütüm adı · İngilizce" required><input value={grind.nameEn} maxLength={100} onChange={event => editGrind(grind.key, { nameEn: event.target.value })} placeholder="Espresso" /></Field><Field label="Seçenek kodu" required hint="Harf, rakam, alt çizgi veya tire kullanın."><input value={grind.code} maxLength={60} autoCapitalize="none" spellCheck={false} onChange={event => editGrind(grind.key, { code: event.target.value })} placeholder="espresso" /></Field><Field label="Ek ücret (₺)" required hint="Ücret farkı yoksa 0 girin."><input inputMode="decimal" value={grind.price} onChange={event => editGrind(grind.key, { price: event.target.value })} /></Field></div></div>)}
          <button type="button" className={styles.addButton} onClick={() => change(current => ({ ...current, grindOptions: [...current.grindOptions, { key: draftKey(), code: "", nameTr: "", nameEn: "", price: "0,00", sortOrder: current.grindOptions.length, active: true }] }))}>＋ Öğütüm seçeneği ekle</button>
        </section>}
        {original && <StockHistory productId={original.id} onExpired={onExpired} />}
      </div><aside className={styles.editorAside}>
        <section className={styles.formCard}><h2>Yayın ayarları</h2><Field label="Ürün tipi"><select value={draft.type} disabled={Boolean(original)} onChange={event => changeType(event.target.value as ProductType)}><option value="COFFEE">Kahve</option><option value="THERMOS">Termos</option></select></Field>{original && <p className={styles.help}>Ürün tipi oluşturulduktan sonra değiştirilemez.</p>}<Field label="Durum"><select value={draft.status} onChange={event => change({ status: event.target.value as ProductStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><p className={styles.statusHelp}>{draft.status === "PUBLISHED" ? "Kaydettiğinizde ürün ve aktif seçenekleri mağazada görünür." : draft.status === "ARCHIVED" ? "Arşivlenen ürün mağazada görünmez. Bilgileri korunur, yeniden yayımlanabilir." : "Taslak ürünü hazırlayıp daha sonra yayımlayabilirsiniz. Mağazada görünmez."}</p><Field label="Sıralama" hint="Küçük değerler mağazada önce gösterilir."><input inputMode="numeric" value={draft.sortOrder} onChange={event => change({ sortOrder: event.target.value })} /></Field></section>
        <section className={styles.editorNote}><span aria-hidden="true">↗</span><h3>İki dil, tek katalog.</h3><p>Fiyatlar Türk lirasıdır. Türkçe ve İngilizce mağaza aynı ürün, görsel ve stok bilgilerini kullanır.</p>{draft.id && draft.status === "PUBLISHED" && <a href={`/alisveris?product=${encodeURIComponent(draft.id)}`} target="_blank" rel="noopener noreferrer">Mağazada görüntüle ↗</a>}</section>
        <p className={styles.requiredNote}><span>*</span> Zorunlu alanlar</p>
      </aside></div>
    </fieldset>
    <div className={styles.saveBar}><span>{original ? `Son yüklenen sürüm: ${draft.version}` : "Yeni ürün"}{uploading ? " · Görseller yükleniyor…" : ""}</span><button type="submit" className={styles.primary} disabled={disabled}>{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button></div>
  </form>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <label className={styles.field}><span>{label}{required && <em aria-label="zorunlu"> *</em>}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function SectionHeading({ step, title, description }: { step: string; title: string; description: string }) {
  return <div className={styles.sectionHeading}><span>{step}</span><div><h2>{title}</h2><p>{description}</p></div></div>;
}
function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const value = reader.result; if (typeof value !== "string" || !value.includes(",")) reject(new Error("Görsel okunamadı.")); else resolve(value.slice(value.indexOf(",") + 1)); };
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
}

type StockAdjustment = { id: string; sku: string; previous: number; current: number; reason: string; createdAt: string; admin: { name: string } | null };

function StockHistory({ productId, onExpired }: { productId: string; onExpired: () => void }) {
  const [adjustments, setAdjustments] = useState<StockAdjustment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    if (busy) return;
    setBusy(true); setError("");
    try { const result = await adminRequest<{ adjustments: StockAdjustment[] }>(`/products/${encodeURIComponent(productId)}/history`); setAdjustments(result.adjustments); }
    catch (issue) { if (issue instanceof AdminApiError && issue.status === 401) onExpired(); else setError(issue instanceof Error ? issue.message : "Stok hareketleri yüklenemedi."); }
    finally { setBusy(false); }
  }
  return <details className={`${styles.formCard} ${styles.history}`} onToggle={event => { if (event.currentTarget.open && adjustments === null && !busy && !error) void load(); }}><summary>Stok hareketleri <span>Son 100 kayıt</span></summary><p className={styles.help}>Kaydedilen stok değişikliklerinin nedeni, tarihi ve sorumlu yöneticisi.</p>{busy ? <p className={styles.help} role="status">Hareketler yükleniyor…</p> : error ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" className={styles.textButton} onClick={() => void load()}>Yeniden dene</button></div> : adjustments?.length === 0 ? <p className={styles.inlineEmpty}>Bu ürün için henüz stok hareketi yok.</p> : adjustments ? <div className={styles.historyEntries}>{adjustments.map(adjustment => <article key={adjustment.id}><div><strong>{adjustment.sku}</strong><span>{adjustment.previous} → {adjustment.current} adet</span></div><p>{adjustment.reason}</p><small>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(adjustment.createdAt))} · {adjustment.admin?.name || "İlk katalog kurulumu"}</small></article>)}</div> : null}</details>;
}
