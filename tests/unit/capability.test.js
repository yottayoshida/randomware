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

test('asset capability binds the exact upstream URL and page-load nonce', () => {
  const signer = new CapabilitySigner('test-secret');
  const token = signer.issueAsset({ tokenId: 'asset1', pageId: 'page1', creationId: 'c1', revision: 1, apiId: 'dog-ceo', operationId: 'random', resolvedUrl: 'https://images.dog.ceo/dog.jpg', now: 1000, ttlMs: 600000 });
  const data = signer.verifyAsset(token, { now: 2000, creationId: 'c1', revision: 1 });
  assert.equal(data.pageId, 'page1');
  assert.equal(data.resolvedUrl, 'https://images.dog.ceo/dog.jpg');
  assert.throws(() => signer.verifyAsset(token, { now: 601001 }), /asset_capability_invalid/);
});
