const test = require('node:test');
const assert = require('node:assert/strict');
const { CapabilitySigner } = require('../../src/core/capability');

test('capability binds creation, revision, selected operations, nonce, and expiry', () => {
  const signer = new CapabilitySigner('test-secret');
  const token = signer.issue({ creationId: 'c1', revision: 1, selected: [{ apiId: 'open-meteo', operationId: 'forecast' }], now: 1000, ttlMs: 600000 });
  assert.deepEqual(signer.verify(token, { now: 2000 }).creationId, 'c1');
  assert.throws(() => signer.verify(token, { now: 601001 }), /capability_expired/);
  assert.throws(() => signer.verify(token, { now: 2000, creationId: 'c2' }), /capability_binding/);
  assert.equal(signer.verify(token, { now: 2000 }).quotas.jsonCalls, 30);
});
