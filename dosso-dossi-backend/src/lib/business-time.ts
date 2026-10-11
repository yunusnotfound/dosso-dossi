export const BUSINESS_TIME_ZONE = 'Europe/Istanbul';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function businessNow(): Date { return new Date(); }

export function businessParts(date = businessNow()) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  };
}

export function businessDayKey(date = businessNow()): string {
  const p = businessParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function businessHour(date = businessNow()): number { return businessParts(date).hour; }

/** Convert a Turkish calendar date to an instant without relying on the server's TZ. */
export function businessDateTime(p: { year: number; month: number; day: number; hour?: number; minute?: number }): Date {
  const desired = Date.UTC(p.year, p.month - 1, p.day, p.hour ?? 0, p.minute ?? 0);
  let candidate = desired;
  for (let i = 0; i < 3; i++) {
    const actual = businessParts(new Date(candidate));
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate += desired - represented;
  }
  return new Date(candidate);
}

export function startOfBusinessDay(date = businessNow()): Date {
  const { year, month, day } = businessParts(date);
  return businessDateTime({ year, month, day });
}

export function addBusinessDays(date: Date, days: number): Date {
  const p = businessParts(date);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return businessDateTime({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() });
}
