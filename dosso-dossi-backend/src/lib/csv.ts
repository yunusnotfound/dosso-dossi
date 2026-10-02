import { AppError, ErrorCodes } from './errors.js';

/** Untrusted text is never emitted as an executable spreadsheet expression. */
export function csvCell(value: unknown): string {
  if (typeof value === 'number') return String(value);
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export const MAX_EXPORT_ROWS = 10_000;
export function assertExportSize(rows: readonly unknown[]): void {
  if (rows.length > MAX_EXPORT_ROWS) throw new AppError(
    ErrorCodes.VALIDATION_ERROR, 400,
    'Dışa aktarım 10.000 satırı aşıyor. Tarih veya arama filtresini daraltın; hiçbir satır sessizce atlanmadı.',
  );
}
