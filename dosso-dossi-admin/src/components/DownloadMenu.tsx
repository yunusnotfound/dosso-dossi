import { useEffect, useRef, useState } from 'react';
import { ApiError, download } from '../api/client';

interface Item {
  label: string;
  hint: string;
  path: string;
  fallbackName: string;
}

/// Dışa aktarma menüsü. İndirme yetkili fetch ile yapılır — düz bağlantı
/// Authorization başlığı taşıyamadığı için 401 alırdı.
export function DownloadMenu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca kapansın
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  async function run(item: Item) {
    setBusy(item.path);
    setError('');
    try {
      await download(item.path, item.fallbackName);
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Dosya indirilemedi');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-[--radius-pill] bg-surface px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-surface-sunken"
      >
        Dışa aktar
        <span className="text-xs text-ink-muted">▾</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-[--radius-card] bg-surface shadow-xl ring-1 ring-line">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => void run(item)}
              disabled={busy !== null}
              className="flex w-full flex-col items-start gap-0.5 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface-tint disabled:opacity-50"
            >
              <span className="text-sm font-semibold text-ink">
                {busy === item.path ? 'Hazırlanıyor…' : item.label}
              </span>
              <span className="text-xs text-ink-muted">{item.hint}</span>
            </button>
          ))}
          {error ? (
            <p className="bg-bad-soft px-4 py-2 text-xs text-bad">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
