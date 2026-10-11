import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './ui';
import { X } from 'lucide-react';

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

const inputCls = 'admin-input';

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
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-brand"
      />
      {label}
    </label>
  );
}

// Only the topmost dialog owns the keyboard when confirmation dialogs nest.
const modalStack: HTMLElement[] = [];
function useModalFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    modalStack.push(dialog);
    document.body.style.overflow = 'hidden';
    const focusables = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0);
    const focusFirst = () => (focusables()[0] ?? dialog).focus();
    if (!dialog.contains(document.activeElement)) focusFirst();
    const onKey = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = focusables();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (modalStack.at(-1) === dialog && !dialog.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      const wasTop = modalStack.at(-1) === dialog;
      const index = modalStack.indexOf(dialog);
      if (index >= 0) modalStack.splice(index, 1);
      if (!modalStack.length) document.body.style.overflow = previousOverflow === 'hidden' ? '' : previousOverflow;
      if (wasTop && previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
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
  const dialogRef = useModalFocus(open, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-coffee/35"
        onClick={onClose}
        aria-hidden
      />
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="relative flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-chip border border-line p-2 text-ink-muted hover:bg-surface-sunken"
          >
            <X size={18} aria-hidden="true" />
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
export function ReasonDialog(props: React.ComponentProps<typeof ReasonDialogContent>) {
  return props.open ? <ReasonDialogContent {...props} /> : null;
}

function ReasonDialogContent({
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
  const dialogRef = useModalFocus(true, () => { if (!busy) onClose(); });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-coffee/40" onClick={() => { if (!busy) onClose(); }} aria-hidden />
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-card-lg bg-surface p-6">
        <h3 className="font-display text-lg font-bold tracking-tight text-ink">
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
          <p className="mt-3 rounded-chip bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
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
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-pressed={active === t.id}
          className={`border-b-2 px-0.5 py-3 text-sm font-medium transition-colors ${
            active === t.id ? 'border-brand text-brand-ink' : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
