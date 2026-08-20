import type { ReactNode } from 'react';
import { Card, EmptyState, Spinner } from './ui';

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
  empty = 'Kayıt yok',
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: string;
}) {
  if (loading) return <Spinner />;
  if (!rows || rows.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs tracking-wide text-ink-muted uppercase">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-5 py-3 font-semibold ${c.numeric ? 'text-right' : ''}`}
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
              className={`border-b border-line last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-surface-tint/60' : ''
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-5 py-3 ${c.numeric ? 'tnum text-right' : ''}`}
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
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-ink-muted">
      <span className="tnum">
        {total} kayıt · sayfa {page}/{pages}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-[--radius-pill] px-3 py-1 disabled:opacity-40 hover:bg-surface-sunken"
        >
          ‹ Önceki
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-[--radius-pill] px-3 py-1 disabled:opacity-40 hover:bg-surface-sunken"
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
        <h1 className="font-[family-name:--font-display] text-3xl font-extrabold text-ink">
          {title}
        </h1>
        {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}
