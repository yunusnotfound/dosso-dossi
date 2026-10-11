import assert from 'node:assert/strict';
import test from 'node:test';
import { promoExpiryPatch } from './promo-expiry.ts';

test('Resaving promo details preserves expiry unless explicitly changed or cleared', () => {
  assert.deepEqual(promoExpiryPatch('keep', ''), {});
  assert.deepEqual(promoExpiryPatch('clear', ''), { expiresAt: null });
  assert.deepEqual(promoExpiryPatch('set', '2026-10-11T23:30'), { expiresAt: '2026-10-11T20:30:00.000Z' });
  assert.throws(() => promoExpiryPatch('set', ''), /Geçerli/);
});
