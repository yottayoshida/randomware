const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../../src/core/registry');
const { compareShape, shapeSignature } = require('../../src/core/response-contract');
const { Broker } = require('../../src/core/broker');
const { goldenMedia } = require('../../scripts/adapt-fixtures');

test('every registry operation projects a bounded adapted response contract', () => {
  assert.equal(registry.length, 20);
  for (const entry of registry) {
    for (const operation of entry.operations) {
      assert.ok(['object', 'array'].includes(operation.outputSchema.type), `${entry.id}:output_type`);
      if (operation.outputSchema.type === 'object') assert.ok(Object.keys(operation.outputSchema.properties || {}).length, `${entry.id}:vacuous_output_schema`);
      else assert.ok(Object.keys(operation.outputSchema.items || {}).length, `${entry.id}:vacuous_output_schema`);
      assert.ok(operation.responseExample && typeof operation.responseExample === 'object', `${entry.id}:response_example_missing`);
      assert.ok(JSON.stringify(operation.responseExample).length <= 6000, `${entry.id}:response_example_unbounded`);
      assert.ok(Array.isArray(operation.semanticFieldPaths) && operation.semanticFieldPaths.length, `${entry.id}:semantic_paths_missing`);
      assert.ok(operation.shapeSignature && typeof operation.shapeSignature === 'object', `${entry.id}:shape_signature_missing`);
      const golden = JSON.parse(fs.readFileSync(path.join(__dirname, '../..', operation.adaptedFixturePath), 'utf8'));
      assert.equal(golden.apiId, entry.id);
      assert.equal(golden.operationId, operation.id);
    }
  }
});

test('Frankfurter adapted golden and visible contract use the v2 flat rate shape', () => {
  const operation = registry.find((entry) => entry.id === 'frankfurter').operations[0];
  assert.deepEqual(Object.keys(operation.responseExample).sort(), ['base', 'date', 'quote', 'rate']);
  assert.ok(operation.semanticFieldPaths.includes('rate'));
  assert.ok(operation.outputSchema.required.includes('rate'));
  assert.equal(operation.outputSchema.properties.rates, undefined);
});

test('adapted shape comparison detects key and container drift without scalar false positives', () => {
  const expected = shapeSignature({ date: '2026-07-18', base: 'USD', quote: 'JPY', rate: 162.35, meta: { source: 'ECB' } });
  assert.equal(compareShape({ date: null, base: 'USD', quote: 'JPY', rate: '162.41', meta: { source: 'ECB' } }, expected).ok, true);
  const drift = compareShape({ date: '2026-07-19', base: 'USD', rates: { JPY: 162.41 }, meta: [] }, expected);
  assert.equal(drift.ok, false);
  assert.ok(drift.missing.includes('$.rate'));
  assert.ok(drift.extra.includes('$.rates'));
  assert.ok(drift.changed.some((change) => change.path === '$.meta'));
});

test('fixture-mode broker data conforms to every model-visible adapted contract', async () => {
  const broker = new Broker({ fixtureMode: true });
  for (const entry of registry) {
    const operation = entry.operations[0];
    const media = goldenMedia(entry.id, operation.id);
    media.tokenSigner.issueAsset = ({ tokenId }) => `fixture-asset-${tokenId}`;
    media.tokenSigner.issueMedia = ({ tokenId }) => `fixture-media-${tokenId}`;
    const result = await broker.call({ selectedApis: [{ apiId: entry.id, operationIds: [operation.id] }], apiId: entry.id, operationId: operation.id, params: {}, media });
    const drift = compareShape(result.data, operation.shapeSignature);
    assert.equal(drift.ok, true, `${entry.id}:${JSON.stringify(drift)}`);
  }
});

test('fixture conformance mints usable active-origin asset fallbacks instead of golden placeholders', async () => {
  const created = [];
  const broker = new Broker({ fixtureMode: true });
  const result = await broker.call({ selectedApis: [{ apiId: 'deck-of-cards', operationIds: ['draw'] }], apiId: 'deck-of-cards', operationId: 'draw', params: {}, media: { origin: 'https://local.randomware.test', runId: 'fixture-assets', creationId: 'fixture-creation', revision: 1, capability: { nonce: 'fixture-page', expiresAt: Date.now() + 600000 }, tokenSigner: { issueAsset: ({ tokenId }) => `signed-${tokenId}` }, mediaStore: { createAssetToken: async (_runId, record) => created.push(record) } } });
  const urls = [result.data.cards[0].image, result.data.cards[0].images.png, result.data.cards[0].images.svg];
  assert.ok(urls.every((url) => url.startsWith('https://local.randomware.test/api/runtime/asset/signed-')));
  assert.equal(created.length, urls.length);
  assert.ok(created.every((record) => /^https:\/\/deckofcardsapi\.com\//.test(record.resolvedUrl)));
  assert.doesNotMatch(JSON.stringify(result.data), /golden-asset|randomware\.example/);
});
