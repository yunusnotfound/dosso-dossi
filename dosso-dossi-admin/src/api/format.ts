/// Para ve tarih biçimleri panelde tek yerden.
export const fmtTL = (n: number): string =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export const fmtNum = (n: number): string =>
  new Intl.NumberFormat('tr-TR').format(n);

export const fmtDayShort = (iso: string): string =>
  new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

export const fmtDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
