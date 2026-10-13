"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminRequest, AdminApiError, formatPrice } from "@/lib/admin-catalog";
import {
  prepareShipping,
  shippingDraft,
  shippingMoney,
  type ShippingDraft,
  type ShippingEditorState,
} from "@/lib/admin-shipping";
import type { ShippingSettings } from "@/lib/web-commerce";
import styles from "./admin.module.css";
import s from "./shipping.module.css";

export function ShippingEditor({
  value,
  onChange,
  onDirty,
  onBusy,
  onExpired,
}: {
  value: ShippingEditorState | null;
  onChange: (state: ShippingEditorState) => void;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
  onExpired: () => void;
}) {
  const [loading, setLoading] = useState(!value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = loading || saving;
  const dirty = value
    ? JSON.stringify(value.draft) !==
      JSON.stringify(shippingDraft(value.settings))
    : false;

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setConflict(false);
    setNotice("");
    try {
      const result = await adminRequest<{ shipping: ShippingSettings }>(
        "/shipping",
      );
      onChange({
        settings: result.shipping,
        draft: shippingDraft(result.shipping),
      });
    } catch (issue) {
      if (issue instanceof AdminApiError && issue.status === 401) onExpired();
      else
        setError(
          issue instanceof Error
            ? issue.message
            : "Kargo ayarları yüklenemedi.",
        );
    } finally {
      setLoading(false);
    }
  }, [onChange, onExpired]);
  useEffect(() => {
    if (!value) void load();
  }, [value, load]);
  function change(patch: Partial<ShippingDraft>) {
    if (value) onChange({ ...value, draft: { ...value.draft, ...patch } });
    setNotice("");
  }
  async function reload() {
    if (
      busy ||
      (dirty &&
        !window.confirm(
          "Güncel kargo ayarlarını yüklemek kaydedilmemiş değişikliklerinizi kaldırır. Devam edilsin mi?",
        ))
    )
      return;
    await load();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value || busy) return;
    setError("");
    setConflict(false);
    setNotice("");
    const result = prepareShipping(value.draft, value.settings.version);
    if (!result.payload) {
      setError(result.error || "Kargo ayarlarını kontrol edin.");
      return;
    }
    setSaving(true);
    try {
      const response = await adminRequest<{ shipping: ShippingSettings }>(
        "/shipping",
        { method: "PUT", body: JSON.stringify(result.payload) },
      );
      onChange({
        settings: response.shipping,
        draft: shippingDraft(response.shipping),
      });
      setNotice(
        "Kargo ayarları kaydedildi. Sepet tutarları güncel ayarlara göre hesaplanır.",
      );
    } catch (issue) {
      if (issue instanceof AdminApiError && issue.status === 401) onExpired();
      else {
        setConflict(issue instanceof AdminApiError && issue.status === 409);
        setError(
          issue instanceof Error
            ? issue.message
            : "Kargo ayarları kaydedilemedi.",
        );
      }
    } finally {
      setSaving(false);
    }
  }
  const fee = value ? shippingMoney(value.draft.fee) : null;
  const threshold = value?.draft.freeShipping
    ? shippingMoney(value.draft.threshold)
    : null;
  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>TESLİMAT VE KARGO</p>
          <h1>Kahvenin yolculuğu.</h1>
          <p>
            Türkiye içi teslimat ücretini ve ücretsiz kargo eşiğini belirleyin.
          </p>
        </div>
        <button
          className={styles.secondary}
          disabled={busy}
          onClick={() => void reload()}
        >
          Güncel ayarları yükle
        </button>
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className={styles.errorSummary} role="alert">
          <strong>{error}</strong>
          {conflict && (
            <>
              <p>
                Bu ayarlar başka bir oturumda değiştirilmiş. Formunuz korunuyor.
                Güncel ayarları yükleyip tekrar düzenleyin.
              </p>
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={() => void reload()}
              >
                Sunucudaki güncel ayarları yükle
              </button>
            </>
          )}
        </div>
      )}
      {loading && !value ? (
        <p className={styles.empty} role="status">
          Kargo ayarları yükleniyor…
        </p>
      ) : !value ? (
        <div className={styles.empty}>
          <p>Kargo ayarları yüklenemedi.</p>
          <button
            className={styles.primary}
            disabled={busy}
            onClick={() => void load()}
          >
            Yeniden dene
          </button>
        </div>
      ) : (
        <form onSubmit={save} noValidate>
          <div className={s.grid}>
            <section className={styles.formCard}>
              <div className={styles.sectionHeading}>
                <span>01</span>
                <div>
                  <h2>Kargo kuralları</h2>
                  <p>Tek bir standart ücret, tüm Türkiye için geçerlidir.</p>
                </div>
              </div>
              <fieldset className={styles.formFieldset} disabled={busy}>
                <label className={s.toggle}>
                  <div>
                    <strong>Türkiye içi kargo aktif</strong>
                    <span>
                      Kapatıldığında sepette teslimatın kullanılamadığı
                      belirtilir.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={value.draft.enabled}
                    onChange={(event) =>
                      change({ enabled: event.target.checked })
                    }
                  />
                </label>
                <div className={styles.twoCols}>
                  <label className={styles.field}>
                    <span>Teslimat ülkesi</span>
                    <input value="Türkiye" readOnly aria-readonly="true" />
                  </label>
                  <label className={styles.field}>
                    <span>Para birimi</span>
                    <input
                      value="Türk lirası · TRY ₺"
                      readOnly
                      aria-readonly="true"
                    />
                  </label>
                </div>
                <div className={s.feeSection}>
                  <label className={styles.field}>
                    <span>Standart kargo ücreti (TL)</span>
                    <input
                      name="shipping-fee"
                      inputMode="decimal"
                      value={value.draft.fee}
                      onChange={(event) => change({ fee: event.target.value })}
                      placeholder="Henüz belirlenmedi"
                    />
                    <small>
                      KDV dahil. Boş bırakılırsa ücret henüz belirlenmemiş
                      sayılır; ücretsiz kargo için 0 yazın.
                    </small>
                  </label>
                </div>
                <div className={s.threshold}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={value.draft.freeShipping}
                      onChange={(event) =>
                        change({ freeShipping: event.target.checked })
                      }
                    />{" "}
                    Belirli bir tutardan itibaren ücretsiz kargo
                  </label>
                  <p>
                    Eşik, ürünlerin toplam tutarı üzerinden hesaplanır. Kargo
                    ücreti bu tutara dahil değildir.
                  </p>
                  {value.draft.freeShipping && (
                    <label className={styles.field}>
                      <span>Ücretsiz kargo eşiği (TL)</span>
                      <input
                        name="free-shipping-threshold"
                        inputMode="decimal"
                        value={value.draft.threshold}
                        onChange={(event) =>
                          change({ threshold: event.target.value })
                        }
                        placeholder="Tutar girin"
                      />
                      <small>
                        Bu tutara eşit veya üzerindeki sepetlerde kargo
                        ücretsizdir.
                      </small>
                    </label>
                  )}
                </div>
              </fieldset>
            </section>
            <aside className={s.aside}>
              <section className={`${styles.formCard} ${s.summary}`}>
                <p className={styles.eyebrow}>AYAR ÖNİZLEMESİ</p>
                <h2>Türkiye’ye teslimat.</h2>
                <dl>
                  <div>
                    <dt>Kargo durumu</dt>
                    <dd>{value.draft.enabled ? "Aktif" : "Kapalı"}</dd>
                  </div>
                  <div>
                    <dt>Standart ücret</dt>
                    <dd>
                      {typeof fee === "number"
                        ? fee === 0
                          ? "Ücretsiz"
                          : formatPrice(fee)
                        : fee === null
                          ? "Henüz belirlenmedi"
                          : "Geçerli tutar girin"}
                    </dd>
                  </div>
                  <div>
                    <dt>Ücretsiz kargo eşiği</dt>
                    <dd>
                      {value.draft.freeShipping
                        ? typeof threshold === "number" && threshold > 0
                          ? formatPrice(threshold)
                          : "Tutar gerekli"
                        : "Uygulanmıyor"}
                    </dd>
                  </div>
                </dl>
                <small>
                  {dirty
                    ? "Bu önizleme kaydedilmemiş değişiklikleri içerir."
                    : `Kaydedilen sürüm: ${value.settings.version}`}
                </small>
              </section>
              {(fee === null || !value.draft.enabled) && (
                <div className={s.warning}>
                  <strong>
                    {!value.draft.enabled
                      ? "Kargo kapalı"
                      : "Kargo ücreti bekleniyor"}
                  </strong>
                  <p>
                    {!value.draft.enabled
                      ? "Teslimat tekrar açılana kadar müşterilere kesin kargo toplamı gösterilmez."
                      : "Ücret tanımlanana kadar sepette kargo ve genel toplam hesaplanmaz. Boş alan ücretsiz kargo olarak değerlendirilmez."}
                  </p>
                </div>
              )}
            </aside>
          </div>
          <div className={styles.saveBar}>
            <span>
              {dirty
                ? "Kaydedilmemiş değişiklikler var."
                : `Son yüklenen sürüm: ${value.settings.version}`}
            </span>
            <button
              type="submit"
              className={styles.primary}
              disabled={busy || !dirty}
            >
              {saving ? "Kaydediliyor…" : "Kargo ayarlarını kaydet"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
