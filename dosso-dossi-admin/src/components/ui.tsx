import type { ReactNode } from 'react';

/// Panelin ortak yüzey elemanları. Ham renk yerine tema token'ları kullanılır.

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[--radius-card] bg-surface p-5 ring-1 ring-line ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-ink-muted uppercase">
      {children}
    </h2>
  );
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'gold';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  gold: 'bg-gold text-on-gold',
};

/// Mobildeki soft-renk rozet dili: soluk zemin + koyu metin.
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[--radius-pill] px-2.5 py-1 text-xs font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[--radius-pill] px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-light'
      : 'bg-transparent text-ink hover:bg-surface-sunken';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/// KPI kutusu. `hint` ikincil bir kırılım gösterir (ör. sipariş/QR ayrımı).
export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {tone ? <Badge tone={tone}>bugün</Badge> : null}
      </div>
      <p className="tnum mt-2 font-[family-name:--font-display] text-3xl font-extrabold text-ink">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[--radius-card] border border-dashed border-line p-8 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-10">
      <div className="size-8 animate-spin rounded-full border-3 border-line border-t-brand" />
    </div>
  );
}

/// Para ve tarih biçimleri panelde tek yerden.
export const fmtTL = (n: number): string =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);

export const fmtNum = (n: number): string =>
  new Intl.NumberFormat('tr-TR').format(n);

export const fmtDayShort = (iso: string): string =>
  new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(
    new Date(`${iso}T00:00:00`),
  );
