const test = require('node:test');
const assert = require('node:assert/strict');
const { CHOREOGRAPHY_DEADLINES } = require('../../src/core/mcp');

test('artifact and repair choreography allow measured composition time', () => {
  assert.deepEqual(CHOREOGRAPHY_DEADLINES.concept, { firstMs: 60000, finalMs: 120000 });
  assert.deepEqual(CHOREOGRAPHY_DEADLINES.artifact, { firstMs: 300000, finalMs: 900000 });
  assert.deepEqual(CHOREOGRAPHY_DEADLINES.repair, { firstMs: 300000, finalMs: 900000 });
});
