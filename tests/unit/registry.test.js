const test = require('node:test');
const assert = require('node:assert/strict');
const { registry, getRegistryEntry } = require('../../src/core/registry');

test('launch registry has 21 compatibility entries and 20 selectable entries with bounded operations and attribution', () => {
  assert.equal(registry.length, 21);
  assert.equal(registry.filter((entry) => entry.selectionEnabled !== false).length, 20);
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
      if (['nasa-images', 'loc-photos', 'wikimedia-commons-audio'].includes(entry.id)) assert.equal(operation.maxRawBytes, 200_000);
      assert.equal(operation.paramsSchema.additionalProperties, false);
      assert.ok(operation.cacheMs === 0 || operation.cacheMs === 300_000);
    }
  }
});

test('registry classifies replay-random operations as uncached and every other operation at five minutes', () => {
  const uncached = new Set(['deck-of-cards/draw', 'poetrydb/random', 'dog-ceo/random', 'radio-browser/station', 'randomuser/person', 'themealdb/meal']);
  const policies = Object.fromEntries(registry.flatMap((entry) => entry.operations.map((operation) => [`${entry.id}/${operation.id}`, operation.cacheMs])));
  assert.equal(Object.keys(policies).length, 21);
  for (const [key, cacheMs] of Object.entries(policies)) assert.equal(cacheMs, uncached.has(key) ? 0 : 300_000, key);
});

test('registry symbols are the owner-curated display-only strip', () => {
  assert.deepEqual(Object.fromEntries(registry.map((entry) => [entry.id, entry.symbol])), {
    'deck-of-cards': '🃏', poetrydb: '📜', datamuse: '🔤', artic: '🖼️', 'dog-ceo': '🐕', 'radio-browser': '📻', 'open-meteo': '🌤️', frankfurter: '💱', randomuser: '👤', 'wiki-onthisday': '📅', 'usgs-quakes': '🌋', 'met-museum': '🏛️', 'nager-date': '🗓️', tvmaze: '📺', rickandmorty: '🛸', 'open-food-facts': '🥫', librivox: '🎧', themealdb: '🍲', 'nasa-images': '🪐', 'loc-photos': '📚', 'wikimedia-commons-audio': '🔔'
  });
});

test('LibriVox remains runtime-compatible but disabled for selection', () => {
  const entry = getRegistryEntry('librivox');
  assert.equal(entry.selectionEnabled, false);
  assert.equal(entry.operations[0].id, 'book');
});

test('Wikimedia Commons audio uses one fixed bounded search and exact media host policy', () => {
  const entry = getRegistryEntry('wikimedia-commons-audio');
  const operation = entry.operations[0];
  assert.equal(entry.symbol, '🔔');
  assert.equal(entry.category, 'audio');
  assert.equal(operation.id, 'recording');
  assert.equal(operation.maxRawBytes, 200_000);
  assert.equal(operation.paramsSchema.additionalProperties, false);
  assert.match(operation.pathTemplate, /gsrsearch=field%20recording%20filetype%3Aaudio%20filesize%3A%3E100/);
  assert.match(operation.pathTemplate, /gsrlimit=4/);
  assert.match(operation.pathTemplate, /iiprop=url%7Csize%7Cmime%7Cextmetadata/);
  assert.match(operation.pathTemplate, /iiextmetadatafilter=LicenseShortName/);
  assert.doesNotMatch(operation.pathTemplate, /100\.\.2000/);
  assert.deepEqual(entry.mediaPolicy, { kind: 'wikimedia-commons', allowedHosts: ['upload.wikimedia.org'] });
  assert.match(entry.attribution.text, /recording\.license/);
  assert.equal(entry.attribution.license, 'file-specific LicenseShortName');
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
  assert.equal(loc.operations[0].cacheMs, 300_000);
  assert.throws(() => getRegistryEntry('gbif'), /unknown_registry_entry/);
});

test('registry lookup rejects arbitrary IDs and returns immutable operation metadata', () => {
  const entry = getRegistryEntry('open-meteo');
  assert.equal(entry.id, 'open-meteo');
  assert.throws(() => getRegistryEntry('https://evil.example/'), /unknown_registry_entry/);
  assert.throws(() => entry.operations.push({}), /Cannot add property|object is not extensible/);
});
