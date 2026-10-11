import { useEffect, useId, type ReactNode } from 'react';
import { Card, EmptyState, QueryError, Spinner } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  /// Sayısal kolonlar sağa yaslanır ve tabular rakam kullanır.
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  error,
  onRetry,
  empty = 'Kayıt yok',
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: string;
}) {
  const rowHintId = useId();
  if (error) return <QueryError error={error} onRetry={onRetry ?? (() => {})} />;
  if (loading) return <Spinner />;
  if (!rows || rows.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <Card className="overflow-x-auto p-0">
      {onRowClick ? <span id={rowHintId} className="sr-only">Bu kaydı açmak için Enter veya boşluk tuşuna basın.</span> : null}
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas text-left text-xs text-ink-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-5 py-3.5 font-medium ${c.numeric ? 'text-right' : ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-describedby={onRowClick ? rowHintId : undefined}
              onKeyDown={onRowClick ? (event) => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
              className={`border-b border-line last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-surface-tint/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand' : ''
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-5 py-4 ${c.numeric ? 'tnum text-right' : ''}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number | undefined;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil((total ?? 0) / pageSize));
  useEffect(() => {
    if (total !== undefined && page > pages) onPage(pages);
  }, [page, pages, total, onPage]);
  if (pages <= 1 && page <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
      <span className="tnum">
        {total} kayıt · sayfa {page}/{pages}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-chip border border-line bg-surface px-3 py-2 hover:bg-surface-sunken disabled:opacity-40"
        >
          ‹ Önceki
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-chip border border-line bg-surface px-3 py-2 hover:bg-surface-sunken disabled:opacity-40"
        >
          Sonraki ›
        </button>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
