"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  accountPath,
  customerRequest,
  CustomerRequestError,
  type Customer,
} from "@/lib/customer-account";
import {
  addressesPath,
  cartPath,
  commerceRequest,
  CommerceRequestError,
  type Address,
  type AddressInput,
} from "@/lib/web-commerce";
import type { Locale } from "@/lib/site";
import { provinceName, provinces } from "./address-provinces";
import s from "./address.module.css";

const copy = {
  tr: {
    account: "Hesabım",
    title: "Teslimat adreslerim.",
    intro:
      "Kahve keyfinizin ulaşacağı adresler. Teslimat yalnızca Türkiye sınırları içindedir.",
    eyebrow: "HER YERDE BİR KAHVE MOLASI",
    cart: "Sepetime dön",
    add: "Yeni adres ekle",
    empty: "İlk adresinizi ekleyin.",
    emptyIntro:
      "Evde, işte, bir sonraki kahve molanızda. Adreslerinizi hesabınızda saklayabilirsiniz.",
    loading: "Adresleriniz yükleniyor…",
    loginTitle: "Adresleriniz hesabınızda.",
    loginIntro:
      "Teslimat adreslerinizi görüntülemek ve düzenlemek için giriş yapın.",
    login: "Giriş yap",
    default: "Varsayılan adres",
    edit: "Düzenle",
    remove: "Sil",
    makeDefault: "Varsayılan yap",
    limit: "En fazla 10 teslimat adresi kaydedebilirsiniz.",
    newTitle: "Yeni bir adres.",
    editTitle: "Adresinizi düzenleyin.",
    formIntro: "Kargonun size ulaşabilmesi için adresi eksiksiz yazın.",
    label: "Adres başlığı",
    labelHint: "Örn. Evim, İş yerim",
    recipient: "Alıcı adı soyadı",
    phone: "Telefon numarası",
    phoneHint: "Türkiye numarası · Örn. 0532 123 45 67",
    country: "Ülke",
    countryName: "Türkiye",
    province: "İl",
    chooseProvince: "İl seçin",
    district: "İlçe",
    neighborhood: "Mahalle",
    line: "Açık adres",
    lineHint: "Cadde / sokak, bina, kat ve daire numarası",
    postal: "Posta kodu",
    postalHint: "İsteğe bağlı · Seçtiğiniz ile ait 5 haneli kod",
    setDefault: "Varsayılan teslimat adresim olarak kullan",
    save: "Adresi kaydet",
    saving: "Kaydediliyor…",
    cancel: "Vazgeç",
    saved: "Adresiniz kaydedildi.",
    deleted: "Adres silindi.",
    defaultSaved: "Varsayılan adresiniz güncellendi.",
    deleteTitle: "Bu adres silinsin mi?",
    deleteHint:
      "Sepetinizde seçiliyse teslimat adresini yeniden seçmeniz gerekir.",
    confirmDelete: "Adresi sil",
    deleting: "Siliniyor…",
    discard: "Kaydedilmemiş adres değişikliklerinizi bırakmak istiyor musunuz?",
    conflict:
      "Bu adres başka bir oturumda güncellenmiş. Formunuz korunuyor; güncel sürümü yükleyip yeniden düzenleyin.",
    reload: "Güncel adresi yükle",
    refresh: "Adresleri yenile",
    refreshConfirm:
      "Güncel adresi yüklemek kaydedilmemiş değişikliklerinizi kaldırır. Devam edilsin mi?",
    missing: "Bu adres artık kayıtlı değil. Adreslerinizi yenileyin.",
    validation:
      "Zorunlu alanları doldurun. Telefonunuzu ve varsa ilinizle eşleşen 5 haneli posta kodunu kontrol edin.",
    failed: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
    rate: "Çok fazla işlem yapıldı. Biraz bekleyip yeniden deneyin.",
    expired: "Oturumunuz sona erdi. Devam etmek için giriş yapın.",
    changed: "Hesabınız değişti. Adresleriniz yeniden yükleniyor.",
    retry: "Tekrar dene",
    required: "Zorunlu alan",
    noAddresses: "Kayıtlı adres yok",
    addressLabel: "Teslimat adresi",
    unexpected: "Güncel adres bilgileri alınamadı. Yeniden deneyin.",
    unsaved: "Kaydedilmemiş değişiklikler var.",
  },
  en: {
    account: "My account",
    title: "My delivery addresses.",
    intro:
      "The places where good coffee finds you. Delivery is available within Türkiye only.",
    eyebrow: "A COFFEE BREAK, WHEREVER YOU ARE",
    cart: "Back to my bag",
    add: "Add a new address",
    empty: "Add your first address.",
    emptyIntro:
      "At home, at work, for your next coffee break. Keep your delivery addresses in your account.",
    loading: "Loading your addresses…",
    loginTitle: "Your addresses, in your account.",
    loginIntro: "Sign in to view and manage your delivery addresses.",
    login: "Sign in",
    default: "Default address",
    edit: "Edit",
    remove: "Delete",
    makeDefault: "Set as default",
    limit: "You can save up to 10 delivery addresses.",
    newTitle: "A new address.",
    editTitle: "Edit your address.",
    formIntro: "Please enter a complete address so your delivery can find you.",
    label: "Address label",
    labelHint: "E.g. Home, Work",
    recipient: "Recipient’s full name",
    phone: "Phone number",
    phoneHint: "Türkiye number · E.g. +90 532 123 45 67",
    country: "Country",
    countryName: "Türkiye",
    province: "Province",
    chooseProvince: "Select a province",
    district: "District",
    neighborhood: "Neighbourhood",
    line: "Street address",
    lineHint: "Street, building, floor and apartment number",
    postal: "Postal code",
    postalHint: "Optional · 5 digits matching your province",
    setDefault: "Use as my default delivery address",
    save: "Save address",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Your address has been saved.",
    deleted: "Address deleted.",
    defaultSaved: "Your default address has been updated.",
    deleteTitle: "Delete this address?",
    deleteHint:
      "If selected in your bag, you will need to choose a delivery address again.",
    confirmDelete: "Delete address",
    deleting: "Deleting…",
    discard: "Discard your unsaved address changes?",
    conflict:
      "This address has changed in another session. Your form is preserved; load the latest version before editing again.",
    reload: "Load latest address",
    refresh: "Refresh addresses",
    refreshConfirm:
      "Loading the latest address will discard your unsaved changes. Continue?",
    missing: "This address no longer exists. Refresh your addresses.",
    validation:
      "Fill in the required fields. Check your phone number and, if entered, the 5-digit postal code matching your province.",
    failed: "We could not complete this request. Please try again.",
    rate: "Too many requests. Please wait a moment and try again.",
    expired: "Your session has ended. Sign in to continue.",
    changed: "Your account has changed. Reloading your addresses.",
    retry: "Try again",
    required: "Required field",
    noAddresses: "No saved addresses",
    addressLabel: "Delivery address",
    unexpected:
      "The latest address details could not be loaded. Please try again.",
    unsaved: "You have unsaved changes.",
  },
};

type Editor = { id?: string; version?: number; draft: AddressInput };
const emptyAddress: AddressInput = {
  title: "",
  recipientName: "",
  phone: "",
  country: "TR",
  provinceCode: "",
  district: "",
  neighborhood: "",
  addressLine: "",
  postalCode: "",
  isDefault: false,
};
function asInput(address: Address): AddressInput {
  const {
    title,
    recipientName,
    phone,
    country,
    provinceCode,
    district,
    neighborhood,
    addressLine,
    postalCode,
    isDefault,
  } = address;
  return {
    title,
    recipientName,
    phone,
    country,
    provinceCode,
    district,
    neighborhood,
    addressLine,
    postalCode,
    isDefault,
  };
}

export function AddressContent({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "guest" | "error">(
    "loading",
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState<
    "saved" | "deleted" | "defaultSaved" | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const generation = useRef(0);
  const owner = useRef<string | null>(null);
  const saving = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setState("loading");
    try {
      const session = await customerRequest<{ customer: Customer }>("session");
      if (request !== generation.current) return;
      const result = await commerceRequest<{
        customerId: string;
        addresses: Address[];
      }>("addresses");
      if (request !== generation.current) return;
      if (result.customerId !== session.customer.id)
        throw new CommerceRequestError("ACCOUNT_CHANGED", 409);
      if (owner.current !== null && owner.current !== result.customerId) {
        setEditor(null);
        setDirty(false);
        setNotice(null);
        setConfirmDelete(null);
        setFailure("");
      }
      owner.current = result.customerId;
      setAddresses(result.addresses);
      setState("ready");
    } catch (error) {
      if (request !== generation.current) return;
      if (
        (error instanceof CustomerRequestError ||
          error instanceof CommerceRequestError) &&
        error.status === 401
      ) {
        owner.current = null;
        setAddresses([]);
        setEditor(null);
        setDirty(false);
        setNotice(null);
        setFailure("");
        setState("guest");
      } else {
        setFailure(
          error instanceof CommerceRequestError &&
            error.code === "ACCOUNT_CHANGED"
            ? "changed"
            : "unexpected",
        );
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    void load();
    function invalidate() {
      ++generation.current;
      owner.current = null;
      setAddresses([]);
      setEditor(null);
      setDirty(false);
      setNotice(null);
      setConfirmDelete(null);
      setFailure("");
      setState("loading");
      if (document.visibilityState === "visible") void load();
    }
    function visibility() {
      if (document.visibilityState === "hidden") {
        ++generation.current;
        setState("loading");
      } else void load();
    }
    function pageHide() {
      ++generation.current;
      setState("loading");
    }
    function focus() {
      if (document.visibilityState === "visible" && !saving.current)
        void load();
    }
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("dosso-web-customer");
    if (channel) channel.onmessage = invalidate;
    window.addEventListener("dosso-customer-session-changed", invalidate);
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    window.addEventListener("pagehide", pageHide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      ++generation.current;
      channel?.close();
      window.removeEventListener("dosso-customer-session-changed", invalidate);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
      window.removeEventListener("pagehide", pageHide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const preventLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const interceptLink = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        !target ||
        target.target === "_blank" ||
        (target.hash &&
          target.pathname === window.location.pathname &&
          target.origin === window.location.origin) ||
        target.href === window.location.href ||
        target.pathname === addressesPath(locale === "tr" ? "en" : "tr")
      )
        return;
      if (busy || !window.confirm(copy[locale].discard)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", preventLeaving);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", preventLeaving);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [dirty, busy, locale]);

  function canLeave() {
    return !busy && (!dirty || window.confirm(t.discard));
  }
  function begin(address?: Address) {
    if (!canLeave()) return;
    setEditor(
      address
        ? { id: address.id, version: address.version, draft: asInput(address) }
        : { draft: { ...emptyAddress, isDefault: addresses.length === 0 } },
    );
    setDirty(false);
    setFailure("");
    setNotice(null);
    setConfirmDelete(null);
    requestAnimationFrame(() => {
      editorHeading.current?.focus();
      editorHeading.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }
  function cancel() {
    if (canLeave()) {
      setEditor(null);
      setDirty(false);
      setFailure("");
    }
  }
  function update(patch: Partial<AddressInput>) {
    setEditor((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : null,
    );
    setDirty(true);
    setNotice(null);
  }
  function fail(error: unknown) {
    if (error instanceof CommerceRequestError && error.status === 401) {
      owner.current = null;
      setAddresses([]);
      setEditor(null);
      setDirty(false);
      setState("guest");
      setFailure("expired");
    } else
      setFailure(
        error instanceof CommerceRequestError
          ? error.status === 409
            ? "conflict"
            : error.status === 404
              ? "missing"
              : error.status === 400 || error.status === 422
                ? "validation"
                : error.status === 429
                  ? "rate"
                  : "failed"
          : "failed",
      );
  }
  async function mutate(
    action: "save" | "delete" | "default",
    address?: Address,
  ) {
    if (saving.current || !owner.current || state !== "ready") return;
    const customerId = owner.current;
    saving.current = true;
    setBusy(true);
    setFailure("");
    setNotice(null);
    try {
      if (action === "delete" && address) {
        await commerceRequest(`addresses/${encodeURIComponent(address.id)}`, {
          method: "DELETE",
          body: { version: address.version },
        });
      } else {
        const target =
          action === "default" && address
            ? {
                id: address.id,
                version: address.version,
                draft: { ...asInput(address), isDefault: true },
              }
            : editor;
        if (!target) return;
        const result = await commerceRequest<{
          customerId: string;
          address: Address;
        }>(
          target.id
            ? `addresses/${encodeURIComponent(target.id)}`
            : "addresses",
          {
            method: target.id ? "PUT" : "POST",
            body: {
              ...target.draft,
              ...(target.version !== undefined
                ? { version: target.version }
                : {}),
            },
          },
        );
        if (result.customerId !== customerId) {
          void load();
          return;
        }
      }
      if (owner.current !== customerId) return;
      if (action === "save") {
        setEditor(null);
        setDirty(false);
      }
      setConfirmDelete(null);
      setNotice(
        action === "save"
          ? "saved"
          : action === "delete"
            ? "deleted"
            : "defaultSaved",
      );
      await load();
    } catch (error) {
      if (owner.current === customerId) fail(error);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function reloadLatest() {
    if (busy || (dirty && !window.confirm(t.refreshConfirm))) return;
    const editingId = editor?.id;
    const customerId = owner.current;
    setBusy(true);
    setFailure("");
    try {
      const result = await commerceRequest<{
        customerId: string;
        addresses: Address[];
      }>("addresses");
      if (owner.current !== customerId || result.customerId !== customerId) {
        void load();
        return;
      }
      setAddresses(result.addresses);
      const current = result.addresses.find((item) => item.id === editingId);
      setEditor(
        current
          ? {
              id: current.id,
              version: current.version,
              draft: asInput(current),
            }
          : null,
      );
      setDirty(false);
      setConfirmDelete(null);
      if (editingId && !current) setFailure("missing");
    } catch (error) {
      if (owner.current === customerId) fail(error);
    } finally {
      setBusy(false);
    }
  }

  const errorText = failure ? t[failure as keyof typeof t] || t.failed : "";
  return (
    <section className={s.page}>
      <div className={s.container}>
        <nav
          className={s.breadcrumb}
          aria-label={locale === "tr" ? "Sayfa yolu" : "Breadcrumb"}
        >
          <Link href={accountPath(locale)}>{t.account}</Link>
          <span aria-hidden="true">/</span>
          <span>{locale === "tr" ? "Adreslerim" : "Addresses"}</span>
        </nav>
        <header className={s.heading}>
          <div>
            <p className={s.eyebrow}>{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
          <Link className={s.back} href={cartPath(locale)}>
            {t.cart} <span aria-hidden="true">↗</span>
          </Link>
        </header>
        {state === "loading" ? (
          <div className={s.empty} role="status">
            <span className={s.loadingDot} />
            {t.loading}
          </div>
        ) : state === "guest" ? (
          <div className={s.empty}>
            <Pin />
            <h2>{t.loginTitle}</h2>
            <p>{t.loginIntro}</p>
            <Link className={s.primary} href={accountPath(locale)}>
              {t.login} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : state === "error" ? (
          <div className={s.empty}>
            <p role="alert">{errorText}</p>
            <button className={s.primary} onClick={() => void load()}>
              {t.retry}
            </button>
          </div>
        ) : (
          <>
            {notice && (
              <p className={s.notice} role="status">
                ✓ {t[notice]}
              </p>
            )}
            {failure && (
              <div className={s.error} role="alert">
                <p>{errorText}</p>
                {(failure === "conflict" || failure === "missing") && (
                  <button onClick={() => void reloadLatest()} disabled={busy}>
                    {editor?.id ? t.reload : t.refresh}
                  </button>
                )}
              </div>
            )}
            {editor ? (
              <form
                className={s.formCard}
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void mutate("save");
                }}
              >
                <div className={s.formHeading}>
                  <div>
                    <h2 ref={editorHeading} tabIndex={-1}>
                      {editor.id ? t.editTitle : t.newTitle}
                    </h2>
                    <p>{t.formIntro}</p>
                  </div>
                  <span>TR</span>
                </div>
                <fieldset disabled={busy} className={s.fields}>
                  <label className={s.field}>
                    <span>
                      {t.label} <em aria-label={t.required}>*</em>
                    </span>
                    <input
                      name="address-title"
                      autoComplete="off"
                      required
                      minLength={2}
                      maxLength={60}
                      placeholder={t.labelHint}
                      value={editor.draft.title}
                      onChange={(event) =>
                        update({ title: event.target.value })
                      }
                    />
                  </label>
                  <label className={s.field}>
                    <span>
                      {t.recipient} <em aria-label={t.required}>*</em>
                    </span>
                    <input
                      name="recipient-name"
                      autoComplete="shipping name"
                      required
                      minLength={2}
                      maxLength={120}
                      value={editor.draft.recipientName}
                      onChange={(event) =>
                        update({ recipientName: event.target.value })
                      }
                    />
                  </label>
                  <label className={s.field}>
                    <span>
                      {t.phone} <em aria-label={t.required}>*</em>
                    </span>
                    <input
                      name="recipient-phone"
                      autoComplete="shipping tel"
                      type="tel"
                      required
                      maxLength={24}
                      value={editor.draft.phone}
                      onChange={(event) =>
                        update({ phone: event.target.value })
                      }
                    />
                    <small>{t.phoneHint}</small>
                  </label>
                  <label className={s.field}>
                    <span>{t.country}</span>
                    <input
                      name="country"
                      value={t.countryName}
                      readOnly
                      aria-readonly="true"
                    />
                  </label>
                  <label className={s.field}>
                    <span>
                      {t.province} <em aria-label={t.required}>*</em>
                    </span>
                    <select
                      name="province"
                      autoComplete="shipping address-level1"
                      required
                      value={editor.draft.provinceCode}
                      onChange={(event) =>
                        update({ provinceCode: event.target.value })
                      }
                    >
                      <option value="">{t.chooseProvince}</option>
                      {provinces.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={s.field}>
                    <span>
                      {t.district} <em aria-label={t.required}>*</em>
                    </span>
                    <input
                      name="district"
                      autoComplete="shipping address-level2"
                      required
                      minLength={2}
                      maxLength={100}
                      value={editor.draft.district}
                      onChange={(event) =>
                        update({ district: event.target.value })
                      }
                    />
                  </label>
                  <label className={s.field}>
                    <span>
                      {t.neighborhood} <em aria-label={t.required}>*</em>
                    </span>
                    <input
                      name="neighborhood"
                      autoComplete="shipping address-level3"
                      required
                      minLength={2}
                      maxLength={120}
                      value={editor.draft.neighborhood}
                      onChange={(event) =>
                        update({ neighborhood: event.target.value })
                      }
                    />
                  </label>
                  <label className={s.field}>
                    <span>{t.postal}</span>
                    <input
                      name="postal-code"
                      autoComplete="shipping postal-code"
                      inputMode="numeric"
                      pattern={
                        editor.draft.provinceCode
                          ? `${editor.draft.provinceCode}[0-9]{3}`
                          : "[0-9]{5}"
                      }
                      maxLength={5}
                      value={editor.draft.postalCode}
                      onChange={(event) =>
                        update({ postalCode: event.target.value })
                      }
                    />
                    <small>{t.postalHint}</small>
                  </label>
                  <label className={`${s.field} ${s.fullWidth}`}>
                    <span>
                      {t.line} <em aria-label={t.required}>*</em>
                    </span>
                    <textarea
                      name="street-address"
                      autoComplete="shipping street-address"
                      required
                      minLength={10}
                      maxLength={500}
                      rows={3}
                      placeholder={t.lineHint}
                      value={editor.draft.addressLine}
                      onChange={(event) =>
                        update({ addressLine: event.target.value })
                      }
                    />
                  </label>
                  <label className={s.check}>
                    <input
                      type="checkbox"
                      checked={editor.draft.isDefault}
                      onChange={(event) =>
                        update({ isDefault: event.target.checked })
                      }
                    />
                    {t.setDefault}
                  </label>
                </fieldset>
                <div className={s.formActions}>
                  <span>{dirty ? t.unsaved : ""}</span>
                  <button
                    className={s.secondary}
                    type="button"
                    disabled={busy}
                    onClick={cancel}
                  >
                    {t.cancel}
                  </button>
                  <button className={s.primary} type="submit" disabled={busy}>
                    {busy ? t.saving : t.save}
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                {addresses.length ? (
                  <div className={s.addressGrid}>
                    {addresses.map((address) => (
                      <article
                        key={address.id}
                        className={`${s.addressCard} ${address.isDefault ? s.defaultCard : ""}`}
                        aria-label={`${address.title} · ${t.addressLabel}`}
                      >
                        <div className={s.addressTop}>
                          <Pin />
                          <span>{address.isDefault ? t.default : "TR"}</span>
                        </div>
                        <h2>{address.title}</h2>
                        <strong>{address.recipientName}</strong>
                        <address>
                          {address.neighborhood}
                          <br />
                          {address.addressLine}
                          <br />
                          {address.postalCode && `${address.postalCode} · `}
                          {address.district} /{" "}
                          {provinceName(address.provinceCode)}
                          <br />
                          {t.countryName}
                        </address>
                        <p className={s.phone}>{address.phone}</p>
                        {confirmDelete === address.id ? (
                          <div className={s.deleteConfirm}>
                            <strong>{t.deleteTitle}</strong>
                            <p>{t.deleteHint}</p>
                            <div>
                              <button
                                disabled={busy}
                                onClick={() => void mutate("delete", address)}
                              >
                                {busy ? t.deleting : t.confirmDelete}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => setConfirmDelete(null)}
                              >
                                {t.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={s.cardActions}>
                            <button
                              disabled={busy}
                              onClick={() => begin(address)}
                            >
                              {t.edit}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setConfirmDelete(address.id);
                                setNotice(null);
                              }}
                            >
                              {t.remove}
                            </button>
                            {!address.isDefault && (
                              <button
                                disabled={busy}
                                onClick={() => void mutate("default", address)}
                              >
                                {t.makeDefault}
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                    {addresses.length < 10 && (
                      <button
                        className={s.addCard}
                        disabled={busy}
                        onClick={() => begin()}
                      >
                        <span aria-hidden="true">＋</span>
                        <strong>{t.add}</strong>
                        <small>{t.limit}</small>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={s.empty}>
                    <Pin />
                    <h2>{t.empty}</h2>
                    <p>{t.emptyIntro}</p>
                    <button
                      className={s.primary}
                      disabled={busy}
                      onClick={() => begin()}
                    >
                      {t.add}
                      <span aria-hidden="true">＋</span>
                    </button>
                  </div>
                )}
                <p className={s.limit}>
                  {addresses.length} / 10 · {t.limit}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Pin() {
  return (
    <svg
      width="26"
      height="30"
      viewBox="0 0 24 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <path d="M21 11c0 7-9 14-9 14S3 18 3 11a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="11" r="3" />
    </svg>
  );
}
