const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../../src/core/registry');
const { compareShape, shapeSignature } = require('../../src/core/response-contract');

test('every registry operation projects a bounded adapted response contract', () => {
  assert.equal(registry.length, 18);
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

test('adapted shape comparison detects missing, extra, and changed fields', () => {
  const expected = shapeSignature({ date: '2026-07-18', base: 'USD', quote: 'JPY', rate: 162.35 });
  assert.equal(compareShape({ date: '2026-07-19', base: 'USD', quote: 'JPY', rate: 162.41 }, expected).ok, true);
  const drift = compareShape({ date: '2026-07-19', base: 'USD', rates: { JPY: 162.41 } }, expected);
  assert.equal(drift.ok, false);
  assert.ok(drift.missing.includes('$.rate'));
  assert.ok(drift.extra.includes('$.rates'));
});
