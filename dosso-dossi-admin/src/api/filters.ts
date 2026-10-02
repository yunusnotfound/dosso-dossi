// Inclusive calendar days in the operator's device time zone. List and export
// use this same conversion so the selected period cannot silently change.
export function addDateRange(params: URLSearchParams, from: string, to: string): void {
  if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
  if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
}
