import { z } from 'zod';
import { AppError } from './errors.js';

const querySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  paginated: z.enum(['true', 'false']).optional(),
});
const cursorSchema = z.object({
  date: z.iso.datetime(),
  id: z.string().min(1).max(128),
}).strict();

export interface HistoryPage {
  limit: number;
  after?: { createdAt: Date; id: string };
}

/** Keyset pagination remains stable when new history arrives between pages. */
export function parseHistoryPage(query: unknown): HistoryPage {
  const input = querySchema.parse(query);
  if (!input.cursor) return { limit: input.limit };
  try {
    const value = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')));
    return { limit: input.limit, after: { createdAt: new Date(value.date), id: value.id } };
  } catch {
    throw new AppError('VALIDATION_ERROR', 400, 'Geçersiz geçmiş sayfası; listeyi yenileyin');
  }
}

export function historyBoundary(page: HistoryPage) {
  if (!page.after) return {};
  return { OR: [
    { createdAt: { lt: page.after.createdAt } },
    { createdAt: page.after.createdAt, id: { lt: page.after.id } },
  ] };
}

export function historyPageResult<T extends { id: string; createdAt: Date }, R>(
  rows: T[], page: HistoryPage, serialize: (row: T) => R,
) {
  const visible = rows.slice(0, page.limit);
  const last = visible.at(-1);
  return {
    items: visible.map(serialize),
    nextCursor: rows.length > page.limit && last
      ? Buffer.from(JSON.stringify({ date: last.createdAt.toISOString(), id: last.id })).toString('base64url')
      : null,
  };
}
