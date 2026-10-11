// Financial retries must keep their operation key across reloads. Only a hash of
// the payload is stored; customer details and adjustment reasons stay out of storage.
interface IntentStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export class DurableIntentError extends Error {}
const prefix = 'dd-admin-intent-v1:';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export async function withDurableIntent<T>(scope: string, payload: unknown, send: (key: string) => Promise<T>, storage: IntentStorage = localStorage): Promise<T> {
  const bytes = new TextEncoder().encode(JSON.stringify([scope, canonical(payload)]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const slot = prefix + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const acquire = () => {
    try {
      let key = storage.getItem(slot);
      if (key !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new Error('Invalid intent');
      if (!key) {
        key = crypto.randomUUID();
        storage.setItem(slot, key);
      }
      if (storage.getItem(slot) !== key) throw new Error('Intent was not persisted');
      return key;
    } catch {
      throw new DurableIntentError('İşlem güvenle kaydedilemedi; değişiklik gönderilmedi. Tarayıcı depolama iznini kontrol edip yeniden deneyin.');
    }
  };
  const key = typeof window !== 'undefined' && navigator.locks ? await navigator.locks.request(slot, acquire) : acquire();
  // Keep the same key for network errors, unknown responses and server errors.
  // Remove it only after a fully validated success. If cleanup fails, replaying
  // the completed result is safer than risking a duplicate financial mutation.
  const result = await send(key);
  try { if (storage.getItem(slot) === key) storage.removeItem(slot); } catch { /* safe replay */ }
  return result;
}
