import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dosso-restore-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const backup = join(root, 'backup'), bin = join(root, 'bin'), source = join(root, 'media'), log = join(root, 'commands');
  for (const directory of [backup, bin, source]) mkdirSync(directory);
  writeFileSync(join(source, 'sample.webp'), 'test-image');
  assert.equal(spawnSync('tar', ['-czf', join(backup, 'media.tar.gz'), '-C', source, '.']).status, 0);
  writeFileSync(join(backup, 'database.dump'), 'mock-dump');
  writeFileSync(join(backup, 'COMPLETE'), '');
  writeFileSync(join(backup, 'SHA256SUMS'), ['database.dump', 'media.tar.gz'].map(name => `${createHash('sha256').update(readFileSync(join(backup, name))).digest('hex')}  ${name}\n`).join(''));
  writeFileSync(join(bin, 'pg_restore'), '#!/bin/sh\nprintf "pg_restore %s\\n" "$*" >> "$OPS_TEST_LOG"\n', { mode: 0o700 });
  writeFileSync(join(bin, 'psql'), '#!/bin/sh\nprintf "psql\\n" >> "$OPS_TEST_LOG"\nprintf "%s\\n" "${OPS_TEST_TABLES:-0}"\n', { mode: 0o700 });
  return { root, backup, log, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, OPS_TEST_LOG: log, PGSERVICE: 'isolated-test', PGDATABASE: 'dosso_restore_test', RESTORE_MEDIA_DIR: join(root, 'restored') } };
}

const script = resolve(import.meta.dirname, 'web-restore-check.sh');
test('default backup verification cannot execute SQL or restore media', t => {
  const f = fixture(t);
  const result = spawnSync('bash', [script, f.backup], { env: f.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(f.log, 'utf8'), /^pg_restore --list /);
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /psql|--dbname/);
});
test('restore refuses a production database name before connecting', t => {
  const f = fixture(t);
  const result = spawnSync('bash', [script, f.backup, '--restore-test'], { env: { ...f.env, PGDATABASE: 'dosso_dossi_web' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /non-test restore target/);
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /psql|--dbname/);
});
test('restore refuses a populated test database without applying the dump', t => {
  const f = fixture(t);
  const result = spawnSync('bash', [script, f.backup, '--restore-test'], { env: { ...f.env, OPS_TEST_TABLES: '4' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not empty/);
  assert.match(readFileSync(f.log, 'utf8'), /psql/);
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /pg_restore --dbname/);
});
