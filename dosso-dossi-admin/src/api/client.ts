/// Authenticated requests belong to the session that started them. A late
/// response or refresh must never install data/tokens in a different account.
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';
const ACCESS_KEY = 'dd_admin_access';
const REFRESH_KEY = 'dd_admin_refresh';
export const SESSION_KEY = 'dd_admin_session';

export interface ApiErrorShape { code: string; message: string }
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export const tokens = {
  get access(): string | null { return localStorage.getItem(ACCESS_KEY); },
  get refresh(): string | null { return localStorage.getItem(REFRESH_KEY); },
  get session(): string { return localStorage.getItem(SESSION_KEY) ?? (this.access ? 'legacy' : 'signed-out'); },
  // Rotation keeps the session identity; only login creates a new identity.
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  replace(access: string, refresh: string): void {
    this.set(access, refresh);
    localStorage.setItem(SESSION_KEY, crypto.randomUUID());
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(SESSION_KEY);
  },
};

type SessionLostHandler = () => void;
let onSessionLost: SessionLostHandler = () => {};
export function setSessionLostHandler(fn: SessionLostHandler): void { onSessionLost = fn; }
function assertSession(session: string): void {
  if (session !== tokens.session) throw new ApiError('SESSION_CHANGED', 401, 'Oturum değişti; eski istek iptal edildi');
}
function loseSession(session: string): void {
  assertSession(session);
  tokens.clear();
  onSessionLost();
}

// Bound network waits, including refresh/logout, without treating offline as logout.
async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) abort();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}

let refreshing: { session: string; promise: Promise<boolean> } | null = null;
async function refreshTokens(session: string, rejectedAccess: string | null): Promise<boolean> {
  const rotate = async () => {
    assertSession(session);
    // Another tab/request may have completed the rotation while this one waited.
    if (tokens.access && tokens.access !== rejectedAccess) return true;
    const refreshToken = tokens.refresh;
    if (!refreshToken) return false;
    const res = await timedFetch(`${BASE}/admin/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    assertSession(session);
    if (res.status === 401 || res.status === 403) return false;
    if (!res.ok) throw new ApiError('REFRESH_FAILED', res.status, 'Oturum yenilenemedi. Tekrar deneyin.');
    const data = (await res.json()) as { token: string; refreshToken: string };
    assertSession(session);
    tokens.set(data.token, data.refreshToken);
    return true;
  };
  // Same-origin tabs share a refresh token. Serialize rotation across tabs where
  // Web Locks is supported; the session guard still protects every response.
  return navigator.locks ? navigator.locks.request('dd-admin-refresh', rotate) : rotate();
}
async function ensureRefreshed(session: string, rejectedAccess: string | null): Promise<boolean> {
  if (refreshing?.session === session) return refreshing.promise;
  const pending = { session, promise: Promise.resolve(false) };
  pending.promise = refreshTokens(session, rejectedAccess).finally(() => {
    if (refreshing === pending) refreshing = null;
  });
  refreshing = pending;
  return pending.promise;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  anonymous?: boolean;
  signal?: AbortSignal;
}
type ResponseOptions = RequestOptions & { rawBody?: Blob };
async function response(path: string, opts: ResponseOptions): Promise<{ res: Response; session: string }> {
  const session = tokens.session;
  let sentAccess: string | null = null;
  const send = () => {
    if (!opts.anonymous) assertSession(session);
    const headers: Record<string, string> = {};
    if (opts.rawBody !== undefined) headers['Content-Type'] = opts.rawBody.type;
    else if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    sentAccess = tokens.access;
    if (!opts.anonymous && sentAccess) headers.Authorization = `Bearer ${sentAccess}`;
    return timedFetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET', headers, signal: opts.signal,
      body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
  };
  let res = await send();
  if (!opts.anonymous) assertSession(session);
  if (res.status === 401 && !opts.anonymous) {
    const ok = await ensureRefreshed(session, sentAccess);
    if (!ok) {
      loseSession(session);
      throw new ApiError('UNAUTHORIZED', 401, 'Oturum sona erdi. Yeniden giriş yapın.');
    }
    res = await send();
    assertSession(session);
    if (res.status === 401) loseSession(session);
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => null) as { error?: ApiErrorShape } | null;
    throw new ApiError(payload?.error?.code ?? 'INTERNAL', res.status,
      payload?.error?.message ?? 'İşlem tamamlanamadı. Tekrar deneyin.');
  }
  return { res, session };
}
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { res, session } = await response(path, opts);
  const result = res.status === 204 ? undefined : await res.json();
  if (!opts.anonymous) assertSession(session);
  return result as T;
}

// Uploads use the same timeout, refresh and session fence as JSON requests.
// A Blob remains reusable if the first attempt needs an access-token refresh.
export async function upload<T>(path: string, file: Blob, signal?: AbortSignal): Promise<T> {
  const { res, session } = await response(path, { method: 'POST', rawBody: file, signal });
  const result = await res.json();
  assertSession(session);
  return result as T;
}

export function mediaUrl(value: string): string {
  return value.startsWith('/media/') ? `${BASE.replace(/\/$/, '')}${value}` : value;
}

export async function download(path: string, fallbackName: string): Promise<void> {
  const { res, session } = await response(path, {});
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const blob = await res.blob();
  assertSession(session);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
