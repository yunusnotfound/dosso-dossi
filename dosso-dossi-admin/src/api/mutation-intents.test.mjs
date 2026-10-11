import assert from 'node:assert/strict';
import test from 'node:test';
import { withDurableIntent } from './mutation-intents.ts';
const memory = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }; };

test('An uncertain financial result keeps the durable key across independent retries', async () => {
  const storage = memory(); const keys = [];
  await assert.rejects(withDurableIntent('admin:balance:user', { amount: 100, reason: 'Correction' }, async (key) => { keys.push(key); throw new Error('response lost'); }, storage));
  const result = await withDurableIntent('admin:balance:user', { reason: 'Correction', amount: 100 }, async (key) => { keys.push(key); return { balance: 200 }; }, storage);
  assert.equal(keys[0], keys[1]); assert.equal(result.balance, 200);
  await withDurableIntent('admin:balance:user', { amount: 100, reason: 'Correction' }, async (key) => keys.push(key), storage);
  assert.notEqual(keys[1], keys[2]);
});

test('No financial request is sent if durable storage fails or silently drops writes', async () => {
  for (const storage of [{ getItem() { return null; }, setItem() { throw new Error('quota'); } }, { getItem() { return null; }, setItem() {} }]) {
    let sent = false;
    await assert.rejects(withDurableIntent('balance', { amount: 100 }, async () => { sent = true; }, storage), /gönderilmedi/);
    assert.equal(sent, false);
  }
});

test('Pending intents are scoped to both actor and payload and do not store private data', async () => {
  const map = new Map(); const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) }; const keys = [];
  for (const [scope, amount] of [['admin-a:balance', 100], ['admin-b:balance', 100], ['admin-a:balance', 200]]) {
    await assert.rejects(withDurableIntent(scope, { amount, reason: 'private reason' }, async (key) => { keys.push(key); throw new Error('offline'); }, storage));
  }
  assert.equal(new Set(keys).size, 3); assert.equal(JSON.stringify([...map]).includes('private reason'), false);
});
