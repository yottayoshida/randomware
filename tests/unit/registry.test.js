const test = require('node:test');
const assert = require('node:assert/strict');
const { registry, getRegistryEntry } = require('../../src/core/registry');

test('launch registry has 20 fixed entries with bounded operations and attribution', () => {
  assert.equal(registry.length, 20);
  for (const entry of registry) {
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(entry.docsUrl.startsWith('https://'));
    assert.ok(entry.termsUrl.startsWith('https://'));
    assert.ok(entry.attribution.text.length > 0);
    assert.ok(entry.upstreamHosts.length > 0);
    assert.ok(entry.operations.length > 0);
    assert.match(entry.symbol, /\S/u);
    for (const operation of entry.operations) {
      assert.equal(operation.method, 'GET');
      assert.match(operation.pathTemplate, /^\//);
      if (entry.id === 'librivox') assert.equal(operation.timeoutMs, 10000);
      else assert.ok(operation.timeoutMs <= 6000);
      if (['nasa-images', 'loc-photos'].includes(entry.id)) assert.equal(operation.maxRawBytes, 200_000);
      assert.equal(operation.paramsSchema.additionalProperties, false);
    }
  }
});

test('registry symbols are the owner-curated display-only strip', () => {
  assert.deepEqual(Object.fromEntries(registry.map((entry) => [entry.id, entry.symbol])), {
    'deck-of-cards': '🃏', poetrydb: '📜', datamuse: '🔤', artic: '🖼️', 'dog-ceo': '🐕', 'radio-browser': '📻', 'open-meteo': '🌤️', frankfurter: '💱', randomuser: '👤', 'wiki-onthisday': '📅', 'usgs-quakes': '🌋', 'met-museum': '🏛️', 'nager-date': '🗓️', tvmaze: '📺', rickandmorty: '🛸', 'open-food-facts': '🥫', librivox: '🎧', themealdb: '🍲', 'nasa-images': '🪐', 'loc-photos': '📚'
  });
});

test('new visual sources use fixed bounded operations and fixture-confirmed asset hosts', () => {
  const nasa = getRegistryEntry('nasa-images');
  assert.equal(nasa.operations[0].pathTemplate, '/search?q=PIA12348&media_type=image');
  assert.deepEqual(nasa.assetPolicy.allowedHosts, ['images-assets.nasa.gov']);
  assert.deepEqual(nasa.assetPolicy.resolvedPaths, ['items.*.imageUrl']);
  const loc = getRegistryEntry('loc-photos');
  assert.equal(loc.operations[0].pathTemplate, '/photos/?q=moon&fo=json&c=2');
  assert.deepEqual(loc.assetPolicy.allowedHosts, ['tile.loc.gov']);
  assert.deepEqual(loc.assetPolicy.resolvedPaths, ['results.*.imageUrl']);
  assert.equal(loc.dailyBudget, 240);
  assert.equal(loc.operations[0].cacheTtlSeconds, 300);
  assert.throws(() => getRegistryEntry('gbif'), /unknown_registry_entry/);
});

test('registry lookup rejects arbitrary IDs and returns immutable operation metadata', () => {
  const entry = getRegistryEntry('open-meteo');
  assert.equal(entry.id, 'open-meteo');
  assert.throws(() => getRegistryEntry('https://evil.example/'), /unknown_registry_entry/);
  assert.throws(() => entry.operations.push({}), /Cannot add property|object is not extensible/);
});
