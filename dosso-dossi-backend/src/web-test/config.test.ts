import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { assertSeparateWebDatabase, readWebConfiguration, webCommandConfiguration, webTestDatabaseUrl } from '../config/web.js';

const mobile = 'postgresql://mobile:secret@localhost:5433/dosso_dossi';
const web = 'postgresql://web:secret@localhost:5444/dosso_dossi_web';
const test = 'postgresql://web_test:secret@localhost:5444/dosso_dossi_web_test';
const base = { DATABASE_URL: mobile, WEB_DATABASE_URL: web, WEB_TEST_DATABASE_URL: test };

describe('optional web configuration', () => {
  it('does not require a web URL or initialize a web pool when disabled', () => {
    expect(readWebConfiguration({ DATABASE_URL: mobile })).toEqual({ WEB_ENABLED: false, WEB_DATABASE_POOL_SIZE: 5 });
    expect(readWebConfiguration({ WEB_ENABLED: 'false', WEB_DATABASE_URL: 'unfinished', WEB_DATABASE_POOL_SIZE: 'unfinished' }).WEB_ENABLED).toBe(false);
  });
  it('rejects an ambiguous flag and a missing enabled web URL', () => {
    expect(() => readWebConfiguration({ WEB_ENABLED: 'yes' })).toThrow('WEB_ENABLED');
    expect(() => readWebConfiguration({ DATABASE_URL: mobile, WEB_ENABLED: 'true' })).toThrow('WEB_DATABASE_URL');
  });
  it('requires the existing mobile URL for an isolation comparison', () => {
    expect(() => webCommandConfiguration({ WEB_DATABASE_URL: web })).toThrow('DATABASE_URL gerekli');
  });
  it('accepts separate databases on one server and caps the web pool', () => {
    const config = readWebConfiguration({ DATABASE_URL: mobile, WEB_DATABASE_URL: 'postgresql://w:s@localhost:5433/web?connection_limit=100', WEB_ENABLED: 'true' });
    expect(config.WEB_ENABLED).toBe(true);
    const parsed = new URL(config.WEB_DATABASE_URL!);
    expect(parsed.searchParams.get('connection_limit')).toBe('5');
    expect(parsed.searchParams.get('connect_timeout')).toBe('5');
    expect(parsed.searchParams.get('pool_timeout')).toBe('5');
  });
  it.each(['0', '-1', '21', '1.5', 'NaN'])('rejects invalid pool limit %s', (size) => {
    expect(() => readWebConfiguration({ ...base, WEB_ENABLED: 'true', WEB_DATABASE_POOL_SIZE: size })).toThrow('WEB_DATABASE_POOL_SIZE');
  });
});

describe('database identity guard', () => {
  it.each([
    'postgres://other:password@localhost:5433/dosso_dossi?schema=web',
    'postgresql://other:password@127.0.0.1:5433/dosso_dossi',
    'postgresql://other:password@[::1]:5433/dosso_dossi',
    'postgresql://other:password@LOCALHOST.:5433/dosso_dossi',
    'postgresql://other:password@[::ffff:127.0.0.1]:5433/dosso_dossi',
    'postgresql://other:password@localhost:5433/dosso%5Fdossi?connection_limit=1',
  ])('rejects alternate spelling of the same database (%#)', (url) => {
    expect(() => assertSeparateWebDatabase(url, mobile)).toThrow('aynı veritabanını');
  });
  it('treats omitted/default PostgreSQL ports as identical', () => {
    expect(() => assertSeparateWebDatabase('postgres://w:s@localhost/web', 'postgres://m:s@127.0.0.1:5432/web')).toThrow('aynı veritabanını');
  });
  it.each(['file:./db', 'postgres://host/', 'not-a-url', 'postgres://host/db?host=elsewhere'])('rejects invalid or ambiguous targets (%#)', (url) => {
    expect(() => assertSeparateWebDatabase(url, mobile)).toThrow('WEB_DATABASE_URL');
  });
  it('migration and seed entrypoint reject mobile targets before invoking Prisma', () => {
    for (const action of ['deploy', 'seed']) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/web-prisma.ts', action], {
        env: { ...process.env, DATABASE_URL: mobile, WEB_DATABASE_URL: mobile + '?schema=web' }, encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('aynı veritabanını');
      expect(result.stderr + result.stdout).not.toContain('secret');
    }
  });
});

describe('web test target guard', () => {
  it('accepts only an explicit, local, separate test database', () => {
    expect(new URL(webTestDatabaseUrl(base)).pathname).toBe('/dosso_dossi_web_test');
  });
  it.each([
    undefined,
    'postgres://w:s@localhost:5444/web',
    'postgres://w:s@production.example/web_test',
    mobile,
    web,
  ])('rejects unsafe test URL (%#)', (url) => {
    expect(() => webTestDatabaseUrl({ ...base, WEB_TEST_DATABASE_URL: url })).toThrow();
  });
  it.each(['DATABASE_URL', 'WEB_DATABASE_URL', 'TEST_DATABASE_URL'] as const)('rejects equality to %s even with different credentials/schema', (key) => {
    expect(() => webTestDatabaseUrl({ ...base, [key]: 'postgres://other:s@127.0.0.1:5444/dosso_dossi_web_test?schema=other' })).toThrow(key);
  });
});
