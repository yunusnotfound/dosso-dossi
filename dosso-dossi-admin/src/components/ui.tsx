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
      className={`admin-card ${className}`}
    >
      {children}
    </div>
  );
}

export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (!error) return null;
  return <Card><div role="alert" className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-bad">{error instanceof Error ? error.message : 'Veriler yüklenemedi. Bağlantınızı kontrol edin.'}</p>
    <Button variant="outline" onClick={onRetry}>Yeniden dene</Button>
  </div></Card>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-semibold tracking-tight text-ink">
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
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  form,
  variant = 'primary',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  form?: string;
  variant?: 'primary' | 'ghost' | 'outline';
  disabled?: boolean;
  className?: string;
}) {
  const base =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-chip px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'border border-transparent bg-brand text-ink hover:bg-brand-light'
      : variant === 'outline'
        ? 'border border-line bg-surface text-ink hover:bg-surface-sunken'
        : 'border border-transparent bg-transparent text-ink hover:bg-surface-sunken';
  return (
    <button
      type={type}
      form={form}
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
  emphasis = false,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  emphasis?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className={`rounded-card border p-5 ${emphasis ? 'border-coffee bg-coffee text-on-dark' : 'border-line bg-surface text-ink'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${emphasis ? 'text-on-dark-muted' : 'text-ink-muted'}`}>{label}</p>
        {icon ? <span className={emphasis ? 'text-brand-light' : 'text-ink-muted'}>{icon}</span> : null}
        {tone ? <Badge tone={tone}>bugün</Badge> : null}
      </div>
      <p className="tnum mt-3 font-display text-3xl font-bold tracking-tight">
        {value}
      </p>
      {hint ? <p className={`mt-2 text-xs leading-relaxed ${emphasis ? 'text-on-dark-muted' : 'text-ink-muted'}`}>{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center p-10">
      <div aria-hidden="true" className="size-8 animate-spin rounded-full border-3 border-line border-t-brand" />
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}
