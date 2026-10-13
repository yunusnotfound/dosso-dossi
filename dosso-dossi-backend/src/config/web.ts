/** Web and mobile own separate databases, even when hosted by one PostgreSQL server. */
export type WebEnvironment = Record<string, string | undefined>;

export type WebSandboxPaymentConfiguration = {
  mode: 'sandbox'; apiKey: string; secretKey: string; callbackUrl: string; publicUrl: string;
};

/** Lazy and independent of mobile PAYMENT_PROVIDER; live payments are intentionally unsupported. */
export function readWebSandboxPaymentConfiguration(input: WebEnvironment): WebSandboxPaymentConfiguration | null {
  if ((input.WEB_PAYMENT_MODE ?? 'sandbox') !== 'sandbox') return null;
  const apiKey = input.WEB_IYZICO_API_KEY?.trim() ?? '';
  const secretKey = input.WEB_IYZICO_SECRET_KEY?.trim() ?? '';
  if (!/^sandbox-[A-Za-z0-9_-]{8,200}$/.test(apiKey) || !/^sandbox-[A-Za-z0-9_-]{8,200}$/.test(secretKey)) return null;
  try {
    const callback = new URL(input.WEB_IYZICO_CALLBACK_URL?.trim() ?? '');
    const publicUrl = new URL(input.WEB_PUBLIC_URL?.trim()
      || (['development', 'test'].includes(input.NODE_ENV ?? 'development') ? 'http://127.0.0.1:4000' : ''));
    const callbackHost = callback.hostname.toLowerCase().replace(/\.$/, '');
    // The callback is fixed server configuration, never a user supplied endpoint.
    // A local callback cannot be reached by iyzico; do not report it as configured.
    if (callback.protocol !== 'https:' || callback.username || callback.password || callback.port
      || callback.pathname !== '/web/payments/iyzico/callback' || callback.search || callback.hash
      || !callbackHost.includes('.') || /^[\d.]+$/.test(callbackHost) || callbackHost.includes(':')
      || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(callbackHost)
      || publicUrl.username || publicUrl.password || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash
      || !(publicUrl.protocol === 'https:' || (publicUrl.protocol === 'http:'
        && ['development', 'test'].includes(input.NODE_ENV ?? 'development')
        && ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname)))) return null;
    return { mode: 'sandbox', apiKey, secretKey, callbackUrl: callback.toString(), publicUrl: publicUrl.origin };
  } catch { return null; }
}

export type WebConfiguration =
  | { WEB_ENABLED: false; WEB_DATABASE_URL?: undefined; WEB_DATABASE_POOL_SIZE: number }
  | { WEB_ENABLED: true; WEB_DATABASE_URL: string; WEB_DATABASE_POOL_SIZE: number };

function parsePostgresUrl(value: string | undefined, label: string): URL {
  if (!value) throw new Error(`${label} gerekli.`);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${label} geçerli bir PostgreSQL adresi olmalı.`); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname ||
      !url.pathname.slice(1) || url.pathname.slice(1).includes('/') || url.hash) {
    throw new Error(`${label} açık bir PostgreSQL sunucusu ve veritabanı adı içermeli.`);
  }
  // Alternate connection target parameters could evade the database identity guard.
  for (const key of url.searchParams.keys()) {
    if (['host', 'hostaddr', 'port', 'dbname', 'database', 'user'].includes(key.toLowerCase())) {
      throw new Error(`${label} bağlantı hedefini sorgu parametresiyle değiştiremez.`);
    }
  }
  return url;
}

function canonicalHost(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host) ||
      /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(host)) return 'loopback';
  return host;
}

function databaseIdentity(value: string, label: string): string {
  const url = parsePostgresUrl(value, label);
  let database: string;
  try { database = decodeURIComponent(url.pathname.slice(1)); }
  catch { throw new Error(`${label} veritabanı adı geçerli değil.`); }
  // Credentials, schema and pool settings do not create a separate database.
  return JSON.stringify([canonicalHost(url.hostname), url.port || '5432', database]);
}

export function assertSeparateWebDatabase(webUrl: string, mobileUrl: string | undefined): void {
  if (!mobileUrl) throw new Error('DATABASE_URL gerekli: mobil ve web veritabanı ayrımı doğrulanamadı.');
  if (databaseIdentity(webUrl, 'WEB_DATABASE_URL') === databaseIdentity(mobileUrl, 'DATABASE_URL')) {
    throw new Error('WEB_DATABASE_URL mobil DATABASE_URL ile aynı veritabanını gösteremez; ayrı schema yeterli değildir.');
  }
}

function poolSize(value: string | undefined): number {
  const result = Number(value ?? '5');
  if (!Number.isInteger(result) || result < 1 || result > 20) {
    throw new Error('WEB_DATABASE_POOL_SIZE 1–20 arasında bir tam sayı olmalı.');
  }
  return result;
}

export function withWebPoolLimit(value: string, size: number): string {
  const url = parsePostgresUrl(value, 'WEB_DATABASE_URL');
  url.searchParams.set('connection_limit', String(size));
  // Bounded waits: a stopped web DB must not hold requests indefinitely.
  url.searchParams.set('pool_timeout', '5');
  url.searchParams.set('connect_timeout', '5');
  return url.toString();
}

export function readWebConfiguration(input: WebEnvironment): WebConfiguration {
  const flag = input.WEB_ENABLED ?? 'false';
  if (flag !== 'true' && flag !== 'false') throw new Error('WEB_ENABLED true veya false olmalı.');
  if (flag === 'false') return { WEB_ENABLED: false, WEB_DATABASE_POOL_SIZE: 5 };
  const url = input.WEB_DATABASE_URL;
  if (!url) throw new Error('WEB_ENABLED=true için WEB_DATABASE_URL gerekli.');
  assertSeparateWebDatabase(url, input.DATABASE_URL);
  const size = poolSize(input.WEB_DATABASE_POOL_SIZE);
  return { WEB_ENABLED: true, WEB_DATABASE_URL: withWebPoolLimit(url, size), WEB_DATABASE_POOL_SIZE: size };
}

/** Called before migration/seed commands, not only when the HTTP server starts. */
export function webCommandConfiguration(input: WebEnvironment): Extract<WebConfiguration, { WEB_ENABLED: true }> {
  const result = readWebConfiguration({ ...input, WEB_ENABLED: 'true' });
  if (!result.WEB_ENABLED) throw new Error('Web yapılandırması eksik.');
  return result;
}

/** Integration tests may only mutate an explicitly selected, distinct local *_test database. */
export function webTestDatabaseUrl(input: WebEnvironment): string {
  const value = input.WEB_TEST_DATABASE_URL;
  const url = parsePostgresUrl(value, 'WEB_TEST_DATABASE_URL');
  let name: string;
  try { name = decodeURIComponent(url.pathname.slice(1)); }
  catch { throw new Error('WEB_TEST_DATABASE_URL veritabanı adı geçerli değil.'); }
  if (canonicalHost(url.hostname) !== 'loopback' || !name.endsWith('_test')) {
    throw new Error('Web testleri yalnız açıkça seçilen yerel *_test veritabanında çalışır.');
  }
  const identity = databaseIdentity(value!, 'WEB_TEST_DATABASE_URL');
  if (!input.DATABASE_URL || !input.WEB_DATABASE_URL) {
    throw new Error('Web test ayrımı için DATABASE_URL ve WEB_DATABASE_URL gerekli.');
  }
  for (const key of ['DATABASE_URL', 'WEB_DATABASE_URL', 'TEST_DATABASE_URL'] as const) {
    const other = input[key];
    if (other && databaseIdentity(other, key) === identity) {
      throw new Error(`WEB_TEST_DATABASE_URL ${key} ile aynı veritabanını gösteremez.`);
    }
  }
  return withWebPoolLimit(value!, 2);
}
