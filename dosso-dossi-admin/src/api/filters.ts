// Inclusive Istanbul business days, independent of the operator's device zone.
// Turkey uses UTC+03:00 throughout the application's operating period.
export function addDateRange(params: URLSearchParams, from: string, to: string): void {
  if (from) params.set('from', new Date(`${from}T00:00:00+03:00`).toISOString());
  if (to) params.set('to', new Date(`${to}T23:59:59.999+03:00`).toISOString());
}
