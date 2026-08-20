import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './ui';

/// Etiketli alan sarmalayıcı — tüm formlar aynı ritimde dursun.
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'rounded-[--radius-chip] bg-surface-sunken px-3 py-2 text-sm outline-none ring-brand/40 focus:ring-2 disabled:opacity-60';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[--color-brand]"
      />
      {label}
    </label>
  );
}

/// Sağdan açılan çekmece — detay ve form ekranları sayfayı terk ettirmesin.
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Esc ile kapanma: klavyeyle çalışan operatör fareye uzanmasın.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-canvas shadow-2xl">
        <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="font-[family-name:--font-display] text-xl font-extrabold text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-[--radius-pill] px-3 py-1 text-ink-muted hover:bg-surface-sunken"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? (
          <footer className="border-t border-line bg-surface px-6 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

/// Para/sadakat değiştiren işlemler gerekçesiz yapılamaz — sunucu da
/// zorunlu tutuyor; bu diyalog aynı kuralı arayüzde görünür kılar.
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel = 'Onayla',
  onConfirm,
  onClose,
  busy,
  error,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-[--radius-card-lg] bg-surface p-6">
        <h3 className="font-[family-name:--font-display] text-lg font-extrabold text-ink">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        ) : null}

        <div className="mt-4">
          <Field label="Gerekçe" hint="En az 5 karakter — kayda geçer ve geri alınamaz.">
            <Textarea
              rows={3}
              value={reason}
              autoFocus
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>

        {error ? (
          <p className="mt-3 rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={reason.trim().length < 5 || busy}
          >
            {busy ? 'İşleniyor…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[--radius-pill] bg-surface-sunken p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-[--radius-pill] px-4 py-1.5 text-sm font-semibold transition ${
            active === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
