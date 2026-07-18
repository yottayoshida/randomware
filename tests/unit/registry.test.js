const test = require('node:test');
const assert = require('node:assert/strict');
const { registry, getRegistryEntry } = require('../../src/core/registry');

test('launch registry has 18 fixed entries with bounded operations and attribution', () => {
  assert.equal(registry.length, 18);
  for (const entry of registry) {
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(entry.docsUrl.startsWith('https://'));
    assert.ok(entry.termsUrl.startsWith('https://'));
    assert.ok(entry.attribution.text.length > 0);
    assert.ok(entry.upstreamHosts.length > 0);
    assert.ok(entry.operations.length > 0);
    for (const operation of entry.operations) {
      assert.equal(operation.method, 'GET');
      assert.match(operation.pathTemplate, /^\//);
      assert.ok(operation.timeoutMs <= 6000);
    }
  }
});

test('registry lookup rejects arbitrary IDs and returns immutable operation metadata', () => {
  const entry = getRegistryEntry('open-meteo');
  assert.equal(entry.id, 'open-meteo');
  assert.throws(() => getRegistryEntry('https://evil.example/'), /unknown_registry_entry/);
  assert.throws(() => entry.operations.push({}), /Cannot add property|object is not extensible/);
});
