/// Panel API istemcisi.
/// Access token 15 dk ömürlü; 401 alınca refresh ile bir kez yenilenip istek
/// tekrarlanır. Eşzamanlı 401'ler tek yenilemede buluşur (kuyruk), aksi halde
/// her istek ayrı rotasyon başlatır ve rotasyon zinciri reuse'a takılırdı.

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

const ACCESS_KEY = 'dd_admin_access';
const REFRESH_KEY = 'dd_admin_refresh';

export interface ApiErrorShape {
  code: string;
  message: string;
}

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
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/// Oturum tamamen düştüğünde tetiklenir (refresh de reddedildi).
type SessionLostHandler = () => void;
let onSessionLost: SessionLostHandler = () => {};
export function setSessionLostHandler(fn: SessionLostHandler): void {
  onSessionLost = fn;
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;

  const res = await fetch(`${BASE}/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    tokens.clear();
    return false;
  }
  const data = (await res.json()) as { token: string; refreshToken: string };
  tokens.set(data.token, data.refreshToken);
  return true;
}

async function ensureRefreshed(): Promise<boolean> {
  // Tek uçuş: paralel 401'ler aynı yenilemeyi bekler.
  refreshing ??= refreshTokens().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /// Giriş/refresh gibi token gerektirmeyen uçlar için.
  anonymous?: boolean;
}

export async function api<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const access = tokens.access;
    if (!opts.anonymous && access) headers.Authorization = `Bearer ${access}`;

    return fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  };

  let res = await send();

  if (res.status === 401 && !opts.anonymous) {
    const ok = await ensureRefreshed();
    if (!ok) {
      onSessionLost();
      throw new ApiError('UNAUTHORIZED', 401, 'Oturum sona erdi');
    }
    res = await send();
    if (res.status === 401) {
      tokens.clear();
      onSessionLost();
    }
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: ApiErrorShape;
    } | null;
    throw new ApiError(
      payload?.error?.code ?? 'INTERNAL',
      res.status,
      payload?.error?.message ?? 'Beklenmeyen bir hata oluştu',
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/// Dosya indirme.
///
/// Düz `<a href>` ile indirilemez: tarayıcı o isteğe Authorization başlığını
/// eklemez, uç 401 döner ve kullanıcı boş dosya/hata alır. Bu yüzden dosya
/// yetkili fetch ile blob olarak çekilip indirme programatik tetiklenir.
/// 401 durumunda normal akıştaki gibi token yenilenip bir kez tekrar denenir.
export async function download(path: string, fallbackName: string): Promise<void> {
  const send = async (): Promise<Response> => {
    const access = tokens.access;
    return fetch(`${BASE}${path}`, {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
    });
  };

  let res = await send();
  if (res.status === 401) {
    const ok = await ensureRefreshed();
    if (!ok) {
      onSessionLost();
      throw new ApiError('UNAUTHORIZED', 401, 'Oturum sona erdi');
    }
    res = await send();
  }
  if (!res.ok) {
    throw new ApiError('INTERNAL', res.status, 'Dosya indirilemedi');
  }

  // Sunucu dosya adını Content-Disposition ile bildirir (CORS'ta bu başlık
  // Access-Control-Expose-Headers ile açıldı); okunamazsa yedek ad kullanılır.
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Blob'u hemen serbest bırakmak bazı tarayıcılarda indirmeyi kesiyor.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
