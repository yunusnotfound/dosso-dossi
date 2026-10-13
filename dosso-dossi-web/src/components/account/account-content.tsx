"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { pagePath, type Locale } from "@/lib/site";
import {
  accountError,
  accountPath,
  CustomerRequestError,
  customerRequest,
  readActionToken,
  type AccountView,
  type Customer,
  type DeliveryResponse,
} from "@/lib/customer-account";
import s from "./account.module.css";
import { ordersPath } from "@/lib/web-orders";
import { addressesPath, cartPath } from "@/lib/web-commerce";

function notifyCustomerSessionChanged() {
  window.dispatchEvent(new CustomEvent("dosso-customer-session-changed"));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("dosso-web-customer");
    channel.postMessage("session-changed");
    channel.close();
  }
}

const copy = {
  tr: {
    eyebrow: "DOSSO DOSSI COFFEE · HESABIM",
    title: "Bir sonraki kahvemizde\nbuluşalım.",
    intro: "Sevdiğiniz kahvelere bir adım daha yakın.",
    brandNote: "İyi kahve. Güzel bir buluşma.",
    login: "Giriş yap",
    register: "Üye ol",
    loginTitle: "Tekrar hoş geldiniz.",
    registerTitle: "Aramıza hoş geldiniz.",
    loginIntro: "Dosso Dossi hesabınıza giriş yapın.",
    registerIntro:
      "Hesabınızı oluşturun, e-postanızı doğrulayın ve keşfetmeye başlayın.",
    email: "E-posta adresi",
    password: "Şifre",
    repeat: "Şifreyi tekrar yazın",
    name: "Ad soyad",
    show: "Göster",
    hide: "Gizle",
    passwordHint: "12–128 karakter. Kolay tahmin edilmeyen bir şifre seçin.",
    mismatch: "Şifreler eşleşmiyor.",
    passwordLength: "Şifreniz 12–128 karakter uzunluğunda olmalı.",
    forgot: "Şifremi unuttum",
    resend: "Doğrulama e-postasını tekrar gönder",
    back: "Girişe dön",
    forgotTitle: "Yeni bir başlangıç.",
    forgotIntro:
      "Hesabınıza ait e-posta adresini girin; şifrenizi yenilemek için bağlantı isteyin.",
    resendTitle: "E-postanızı doğrulayın.",
    resendIntro:
      "Hesabınıza ait e-posta adresini girerek yeni bir doğrulama bağlantısı isteyin.",
    sendReset: "Şifre yenileme bağlantısı gönder",
    sendVerification: "Doğrulama bağlantısı gönder",
    busy: "Lütfen bekleyin…",
    sentTitle: "İsteğiniz alındı.",
    sentVerify:
      "Bu adres için doğrulama gerekiyorsa gelen kutunuzu ve spam klasörünü kontrol edin. E-posta gelmezse birkaç dakika sonra yeni bir bağlantı isteyebilirsiniz.",
    sentReset:
      "Bu adrese ait bir hesap varsa gelen kutunuzu ve spam klasörünü kontrol edin. E-posta gelmezse birkaç dakika sonra yeni bir bağlantı isteyebilirsiniz.",
    preview:
      "Yerel geliştirme modu: gerçek e-posta gönderilmez. Uygun hesaplar için geliştiriciye özel bir e-posta önizlemesi hazırlanır.",
    another: "Başka bir e-posta adresi kullan",
    checkSession: "Hesabınız yükleniyor…",
    retry: "Tekrar dene",
    welcome: "Hoş geldiniz,",
    profileIntro: "Kahve molanıza eşlik etmek için buradayız.",
    profile: "Üyelik bilgileriniz",
    verified: "E-posta doğrulandı",
    pending: "Doğrulama bekleniyor",
    logout: "Çıkış yap",
    store: "Mağazayı keşfet",
    home: "Ana sayfa",
    verifyTitle: "Hesabınızı tamamlayın.",
    verifyIntro:
      "E-postanızı doğrulayın ve hesabınızın şifresini belirleyin. Kayıtta seçtiğiniz şifreyi kullanabilir veya yeni bir şifre seçebilirsiniz.",
    verify: "E-postamı doğrula ve hesabımı aç",
    verifiedTitle: "E-postanız doğrulandı.",
    verifiedIntro:
      "Hesabınız hazır. Şimdi e-posta adresiniz ve şifrenizle giriş yapabilirsiniz.",
    invalidTitle: "Yeni bir bağlantı gerekiyor.",
    invalidIntro:
      "E-postanızdaki bağlantıyı yeniden açın veya yeni bir bağlantı isteyin.",
    resetTitle: "Yeni şifrenizi belirleyin.",
    resetIntro:
      "Hesabınız için güçlü ve yalnızca burada kullandığınız bir şifre seçin.",
    reset: "Şifremi yenile",
    resetDone: "Şifreniz yenilendi.",
    resetDoneIntro:
      "Güvenliğiniz için önceki oturumlarınız kapatıldı. Yeni şifrenizle giriş yapabilirsiniz.",
    requestReset: "Yeni şifre yenileme bağlantısı iste",
    requestVerify: "Yeni doğrulama bağlantısı iste",
    checkingLink: "Bağlantı hazırlanıyor…",
  },
  en: {
    eyebrow: "DOSSO DOSSI COFFEE · MY ACCOUNT",
    title: "See you over\nour next coffee.",
    intro: "One step closer to the coffee you love.",
    brandNote: "Good coffee. Great company.",
    login: "Sign in",
    register: "Create account",
    loginTitle: "Welcome back.",
    registerTitle: "Make yourself at home.",
    loginIntro: "Sign in to your Dosso Dossi account.",
    registerIntro:
      "Create your account, verify your email and start exploring.",
    email: "Email address",
    password: "Password",
    repeat: "Confirm password",
    name: "Full name",
    show: "Show",
    hide: "Hide",
    passwordHint: "12–128 characters. Choose a password that is hard to guess.",
    mismatch: "Your passwords do not match.",
    passwordLength: "Your password must be between 12 and 128 characters.",
    forgot: "Forgot password?",
    resend: "Resend verification email",
    back: "Back to sign in",
    forgotTitle: "A fresh start.",
    forgotIntro:
      "Enter the email address for your account to request a password reset link.",
    resendTitle: "Verify your email.",
    resendIntro:
      "Enter the email address for your account to request a new verification link.",
    sendReset: "Send password reset link",
    sendVerification: "Send verification link",
    busy: "Please wait…",
    sentTitle: "Request received.",
    sentVerify:
      "If this address needs verification, check your inbox and spam folder. If no email arrives, you can request another link in a few minutes.",
    sentReset:
      "If an account exists for this address, check your inbox and spam folder. If no email arrives, you can request another link in a few minutes.",
    preview:
      "Local development mode: no real email is sent. For eligible accounts, an email preview is prepared for the developer.",
    another: "Use another email address",
    checkSession: "Loading your account…",
    retry: "Try again",
    welcome: "Welcome,",
    profileIntro: "Here to keep you company on your coffee break.",
    profile: "Your account details",
    verified: "Email verified",
    pending: "Verification pending",
    logout: "Sign out",
    store: "Explore the store",
    home: "Home",
    verifyTitle: "Complete your account.",
    verifyIntro:
      "Verify your email and set your account password. You can use the password you chose at registration or choose a new one.",
    verify: "Verify my email and activate account",
    verifiedTitle: "Your email is verified.",
    verifiedIntro:
      "Your account is ready. You can now sign in with your email address and password.",
    invalidTitle: "You need a new link.",
    invalidIntro: "Reopen the link in your email or request a new one.",
    resetTitle: "Choose a new password.",
    resetIntro: "Choose a strong password that you only use for this account.",
    reset: "Reset my password",
    resetDone: "Your password is updated.",
    resetDoneIntro:
      "Your previous sessions have been closed for your security. Sign in with your new password.",
    requestReset: "Request a new password reset link",
    requestVerify: "Request a new verification link",
    checkingLink: "Preparing your link…",
  },
};
type Mode = "login" | "register" | "forgot" | "resend";

function useAccountError(locale: Locale) {
  const [failure, setFailure] = useState<unknown>(null);
  const message =
    failure === "PASSWORD_MISMATCH"
      ? copy[locale].mismatch
      : failure === "PASSWORD_LENGTH"
        ? copy[locale].passwordLength
        : failure
          ? accountError(failure, locale)
          : "";
  return [message, setFailure] as const;
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
function Seal({ success = false }: { success?: boolean }) {
  return (
    <div
      className={`${s.seal} ${success ? s.sealSuccess : ""}`}
      aria-hidden="true"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        {success ? (
          <path d="m5 12 4 4L19 6" />
        ) : (
          <>
            <rect x="3" y="5" width="18" height="14" rx="1" />
            <path d="m3 6 9 7 9-7" />
          </>
        )}
      </svg>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  locale,
  repeat = false,
  hint = false,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  repeat?: boolean;
  hint?: boolean;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = repeat ? "password-confirm" : "password";
  const t = copy[locale];
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      <div className={s.passwordWrap}>
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={hint || repeat ? "new-password" : "current-password"}
          required
          minLength={hint || repeat ? 12 : undefined}
          maxLength={128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? "password-hint" : undefined}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
          aria-controls={id}
          disabled={disabled}
        >
          {visible ? t.hide : t.show}
        </button>
      </div>
      {hint && <small id="password-hint">{t.passwordHint}</small>}
    </div>
  );
}

function AccountForm({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useAccountError(locale);
  const [notVerified, setNotVerified] = useState(false);
  const [sent, setSent] = useState<DeliveryResponse | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const mounted = useRef(true);

  async function loadSession() {
    setLoading(true);
    setError("");
    setSessionError(false);
    try {
      const result = await customerRequest<{ customer: Customer }>("session");
      if (mounted.current) setCustomer(result.customer);
    } catch (caught) {
      if (
        mounted.current &&
        !(caught instanceof CustomerRequestError && caught.status === 401)
      ) {
        setError(caught);
        setSessionError(true);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    const desired = new URLSearchParams(window.location.search).get("islem");
    if (desired === "sifre" || desired === "dogrulama")
      setMode(desired === "sifre" ? "forgot" : "resend");
    void loadSession();
    return () => {
      mounted.current = false;
    };
    // Session is loaded once. Language changes preserve this form's in-memory state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setSent(null);
    setPassword("");
    setRepeat("");
    setNotVerified(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotVerified(false);
    if (mode === "register") {
      if (password.length < 12 || password.length > 128) {
        setError("PASSWORD_LENGTH");
        return;
      }
      if (password !== repeat) {
        setError("PASSWORD_MISMATCH");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await customerRequest<{ customer: Customer }>("login", {
          email: email.trim(),
          password,
        });
        notifyCustomerSessionChanged();
        setCustomer(result.customer);
        setPassword("");
      } else {
        const endpoint =
          mode === "register"
            ? "register"
            : mode === "forgot"
              ? "forgot-password"
              : "resend-verification";
        const result = await customerRequest<DeliveryResponse>(endpoint, {
          email: email.trim(),
          locale,
          ...(mode === "register" ? { name: name.trim(), password } : {}),
        });
        setSent(result);
        setPassword("");
        setRepeat("");
      }
    } catch (caught) {
      setError(caught);
      setNotVerified(
        caught instanceof CustomerRequestError &&
          caught.code === "EMAIL_NOT_VERIFIED",
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await customerRequest("logout", {});
      notifyCustomerSessionChanged();
      setCustomer(null);
      changeMode("login");
    } catch (caught) {
      if (caught instanceof CustomerRequestError && caught.status === 401) {
        notifyCustomerSessionChanged();
        setCustomer(null);
        changeMode("login");
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className={s.loading} role="status">
        <span className={s.loadingDot} />
        {t.checkSession}
      </div>
    );
  if (sessionError)
    return (
      <div className={s.feedback}>
        <Seal />
        <h2>{t.loginTitle}</h2>
        <p role="alert">{error}</p>
        <button className={s.primary} onClick={loadSession}>
          {t.retry}
          <Arrow />
        </button>
      </div>
    );
  if (customer)
    return (
      <div className={s.profile}>
        <div className={s.monogram} aria-hidden="true">
          {customer.name.trim().slice(0, 1).toLocaleUpperCase(locale)}
        </div>
        <p className={s.kicker}>{t.welcome}</p>
        <h2>{customer.name}</h2>
        <p className={s.description}>{t.profileIntro}</p>
        <div className={s.profileDetails}>
          <h3>{t.profile}</h3>
          <dl>
            <div>
              <dt>{t.name}</dt>
              <dd>{customer.name}</dd>
            </div>
            <div>
              <dt>{t.email}</dt>
              <dd>{customer.email}</dd>
            </div>
          </dl>
          <span className={s.verified}>
            {customer.emailVerifiedAt ? "✓ " + t.verified : t.pending}
          </span>
        </div>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <div className={s.accountLinks}>
          <Link href={ordersPath(locale)}>
            {locale === "tr" ? "Siparişlerim" : "My orders"}
            <Arrow />
          </Link>
          <Link href={cartPath(locale)}>
            {locale === "tr" ? "Sepetim" : "My bag"}
            <Arrow />
          </Link>
          <Link href={addressesPath(locale)}>
            {locale === "tr" ? "Teslimat adreslerim" : "My delivery addresses"}
            <Arrow />
          </Link>
        </div>
        <Link className={s.primary} href={pagePath(locale, "shop")}>
          {t.store}
          <Arrow />
        </Link>
        <button className={s.textButton} onClick={logout} disabled={busy}>
          {busy ? t.busy : t.logout}
        </button>
      </div>
    );
  if (sent)
    return (
      <div className={s.feedback}>
        <Seal />
        <h2>{t.sentTitle}</h2>
        <p>{mode === "forgot" ? t.sentReset : t.sentVerify}</p>
        <p className={s.emailAddress}>{email.trim()}</p>
        {sent.delivery === "preview" && (
          <p className={s.previewNotice}>{t.preview}</p>
        )}
        <button className={s.primary} onClick={() => changeMode("login")}>
          {t.back}
          <Arrow />
        </button>
        <button
          className={s.textButton}
          onClick={() => {
            setSent(null);
            setError("");
          }}
        >
          {t.another}
        </button>
      </div>
    );

  return (
    <>
      {(mode === "login" || mode === "register") && (
        <div
          className={s.tabs}
          aria-label={locale === "tr" ? "Üyelik işlemi" : "Account action"}
        >
          <button
            type="button"
            aria-pressed={mode === "login"}
            disabled={busy}
            onClick={() => changeMode("login")}
          >
            {t.login}
          </button>
          <button
            type="button"
            aria-pressed={mode === "register"}
            disabled={busy}
            onClick={() => changeMode("register")}
          >
            {t.register}
          </button>
        </div>
      )}
      {(mode === "forgot" || mode === "resend") && (
        <button
          className={s.backButton}
          onClick={() => changeMode("login")}
          disabled={busy}
        >
          ← {t.back}
        </button>
      )}
      <h2>
        {mode === "register"
          ? t.registerTitle
          : mode === "forgot"
            ? t.forgotTitle
            : mode === "resend"
              ? t.resendTitle
              : t.loginTitle}
      </h2>
      <p className={s.description}>
        {mode === "register"
          ? t.registerIntro
          : mode === "forgot"
            ? t.forgotIntro
            : mode === "resend"
              ? t.resendIntro
              : t.loginIntro}
      </p>
      <form className={s.form} onSubmit={submit}>
        {mode === "register" && (
          <div className={s.field}>
            <label htmlFor="name">{t.name}</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        )}
        <div className={s.field}>
          <label htmlFor="email">{t.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        {(mode === "login" || mode === "register") && (
          <PasswordField
            locale={locale}
            label={t.password}
            value={password}
            onChange={setPassword}
            hint={mode === "register"}
            disabled={busy}
          />
        )}
        {mode === "register" && (
          <PasswordField
            locale={locale}
            label={t.repeat}
            value={repeat}
            onChange={setRepeat}
            repeat
            disabled={busy}
          />
        )}
        {mode === "login" && (
          <button
            className={s.forgotButton}
            type="button"
            onClick={() => changeMode("forgot")}
            disabled={busy}
          >
            {t.forgot}
          </button>
        )}
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        {notVerified && (
          <button
            className={s.inlineResend}
            type="button"
            onClick={() => changeMode("resend")}
          >
            {t.resend}
          </button>
        )}
        <button className={s.primary} type="submit" disabled={busy}>
          {busy
            ? t.busy
            : mode === "register"
              ? t.register
              : mode === "forgot"
                ? t.sendReset
                : mode === "resend"
                  ? t.sendVerification
                  : t.login}
          <Arrow />
        </button>
      </form>
      {mode === "login" && !notVerified && (
        <button className={s.textButton} onClick={() => changeMode("resend")}>
          {t.resend}
        </button>
      )}
    </>
  );
}

function ActionForm({
  locale,
  view,
}: {
  locale: Locale;
  view: "verify" | "reset";
}) {
  const t = copy[locale];
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const captured = useRef(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useAccountError(locale);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    setToken(readActionToken(window.location.hash));
    if (window.location.hash || window.location.search)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    setReady(true);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token) return;
    setError("");
    if (password.length < 12 || password.length > 128) {
      setError("PASSWORD_LENGTH");
      return;
    }
    if (password !== repeat) {
      setError("PASSWORD_MISMATCH");
      return;
    }
    setBusy(true);
    try {
      await customerRequest(
        view === "verify" ? "verify-email" : "reset-password",
        { token, password },
      );
      if (view === "reset") notifyCustomerSessionChanged();
      setDone(true);
      setToken(null);
      setPassword("");
      setRepeat("");
    } catch (caught) {
      setError(caught);
      if (
        caught instanceof CustomerRequestError &&
        (/TOKEN/.test(caught.code) || caught.status === 410)
      ) {
        setInvalid(true);
        setToken(null);
      }
    } finally {
      setBusy(false);
    }
  }
  const retryPath = `${accountPath(locale)}?islem=${view === "verify" ? "dogrulama" : "sifre"}`;
  if (!ready)
    return (
      <p className={s.loading} role="status">
        {t.checkingLink}
      </p>
    );
  if (done)
    return (
      <div className={s.feedback}>
        <Seal success />
        <h2>{view === "verify" ? t.verifiedTitle : t.resetDone}</h2>
        <p>{view === "verify" ? t.verifiedIntro : t.resetDoneIntro}</p>
        <Link className={s.primary} href={accountPath(locale)}>
          {t.login}
          <Arrow />
        </Link>
      </div>
    );
  if (!token || invalid)
    return (
      <div className={s.feedback}>
        <Seal />
        <h2>{t.invalidTitle}</h2>
        <p role={error ? "alert" : undefined}>{error || t.invalidIntro}</p>
        <Link className={s.primary} href={retryPath}>
          {view === "verify" ? t.requestVerify : t.requestReset}
          <Arrow />
        </Link>
        <Link className={s.textButton} href={accountPath(locale)}>
          {t.back}
        </Link>
      </div>
    );
  return (
    <>
      <Seal />
      <h2>{view === "verify" ? t.verifyTitle : t.resetTitle}</h2>
      <p className={s.description}>
        {view === "verify" ? t.verifyIntro : t.resetIntro}
      </p>
      <form className={s.form} onSubmit={submit}>
        <>
          <PasswordField
            locale={locale}
            label={t.password}
            value={password}
            onChange={setPassword}
            hint
            disabled={busy}
          />
          <PasswordField
            locale={locale}
            label={t.repeat}
            value={repeat}
            onChange={setRepeat}
            repeat
            disabled={busy}
          />
        </>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <button className={s.primary} type="submit" disabled={busy}>
          {busy ? t.busy : view === "verify" ? t.verify : t.reset}
          <Arrow />
        </button>
      </form>
      <Link className={s.textButton} href={retryPath}>
        {view === "verify" ? t.requestVerify : t.requestReset}
      </Link>
    </>
  );
}

export function AccountContent({
  locale,
  view,
}: {
  locale: Locale;
  view: AccountView;
}) {
  const t = copy[locale];
  return (
    <section className={s.accountSection}>
      <div className={s.breadcrumb}>
        <Link href={pagePath(locale, "home")}>{t.home}</Link>
        <span aria-hidden="true">/</span>
        <span>{locale === "tr" ? "Hesabım" : "My account"}</span>
      </div>
      <div className={s.accountGrid}>
        <div className={s.story}>
          <p className={s.kicker}>{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className={s.intro}>{t.intro}</p>
          <div className={s.storyImage}>
            <Image
              src="/images/editorial/coffee-moment.webp"
              alt=""
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
              priority
            />
            <div className={s.photoCaption}>
              <span>DOSSO DOSSI</span>
              <p>{t.brandNote}</p>
            </div>
          </div>
        </div>
        <div className={s.card}>
          {view === "account" ? (
            <AccountForm locale={locale} />
          ) : (
            <ActionForm locale={locale} view={view} />
          )}
        </div>
      </div>
    </section>
  );
}
