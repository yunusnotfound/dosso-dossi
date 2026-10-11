/** Destructive fixture resets must only use an explicitly selected local test DB. */
export function testDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL gerekli: ayrı bir local *_test veritabanı kullanın.');
  const url = new URL(value);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !name.endsWith('_test') || name === 'dosso_dossi') {
    throw new Error('Testler yalnız açıkça seçilen local *_test veritabanında çalışır.');
  }
  return value;
}
