import { z } from 'zod';
import { refreshResponseSchema } from './schemas';

const rotationSchema = refreshResponseSchema.extend({
  session: z.string().min(1),
  rejectedAccess: z.string().nullable(),
  expiresAt: z.number().finite(),
});
type Rotation = z.infer<typeof rotationSchema>;
const STORE = 'rotation';

// A transaction commit is visible to the next Web Lock holder even when its
// renderer has not yet received another tab's localStorage updates.
function record<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let database: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    let finished = false;
    const finish = (error?: unknown, result?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      database?.close();
      if (error) reject(error); else resolve(result as T);
    };
    const timeout = setTimeout(() => {
      try { transaction?.abort(); } catch { /* A commit may already be queued. */ }
      finish(new Error('Oturum yenileme kaydı zaman aşımına uğradı.'));
    }, 5000);
    let opening: IDBOpenDBRequest;
    try { opening = indexedDB.open('dd-admin-refresh', 1); }
    catch (error) { finish(error); return; }
    opening.onupgradeneeded = () => { opening.result.createObjectStore(STORE); };
    opening.onerror = () => finish(opening.error);
    opening.onblocked = () => finish(new Error('Oturum yenileme kaydı kullanılamıyor.'));
    opening.onsuccess = () => {
      database = opening.result;
      if (finished) { database.close(); return; }
      database.onversionchange = () => database?.close();
      try {
        transaction = database.transaction(STORE, mode);
        const request = operation(transaction.objectStore(STORE));
        transaction.oncomplete = () => finish(undefined, request.result);
        transaction.onabort = () => finish(transaction?.error ?? new Error('Oturum yenileme kaydı yazılamadı.'));
      } catch (error) { finish(error); }
    };
  });
}

export async function readRotation(): Promise<Rotation | null> {
  const parsed = rotationSchema.safeParse(await record<unknown>('readonly', (store) => store.get('latest')));
  return parsed.success && parsed.data.expiresAt > Date.now() ? parsed.data : null;
}

export async function rememberRotation(rotation: Omit<Rotation, 'expiresAt'>): Promise<void> {
  await record('readwrite', (store) => store.put({ ...rotation, expiresAt: Date.now() + 30_000 }, 'latest'));
}

// Login/logout remain synchronous. Queue cleanup behind any in-flight rotation;
// exact session identity and a short expiry also fence stale cleanup/data races.
export function clearRotation(): void {
  if (!navigator.locks) return;
  void navigator.locks.request('dd-admin-refresh', () => record('readwrite', (store) => store.delete('latest'))).catch(() => {});
}
