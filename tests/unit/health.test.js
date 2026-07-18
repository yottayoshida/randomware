const test = require('node:test');
const assert = require('node:assert/strict');
const { transition, runHealthCheck } = require('../../src/core/health');

test('health transitions degrade once and disable after three failures', () => {
  let row = transition({}, { apiId: 'x', ok: false, reason: 'timeout' }, 1);
  assert.equal(row.status, 'degraded');
  row = transition(row, { apiId: 'x', ok: false, reason: 'timeout' }, 2);
  row = transition(row, { apiId: 'x', ok: false, reason: 'timeout' }, 3);
  assert.equal(row.status, 'disabled');
  row = transition(row, { apiId: 'x', ok: true, latencyMs: 4 }, 4);
  assert.equal(row.status, 'disabled');
});

test('health runner uses one fixed operation per entry', async () => {
  const calls = [];
  const rows = await runHealthCheck({ entries: [{ id: 'x', operations: [{ id: 'op' }] }, { id: 'y', operations: [{ id: 'op2' }] }], broker: { call: async (input) => { calls.push(input); } }, now: 10 });
  assert.equal(rows.length, 2); assert.equal(calls.length, 2); assert.deepEqual(calls.map((call) => call.operationId), ['op', 'op2']);
});

test('hourly health path degrades adapted shape drift instead of re-enabling it', async () => {
  const operation = { id: 'rates', timeoutMs: 4000, shapeSignature: { '$': 'object', '$.rate': 'scalar' } };
  const rows = await runHealthCheck({ entries: [{ id: 'frankfurter', operations: [operation] }], broker: { call: async () => ({ data: { rates: { JPY: 162.4 } } }) }, now: 10 });
  assert.equal(rows[0].status, 'degraded');
  assert.match(rows[0].reason, /^adapted_shape_drift:/);
});

test('hourly health supplies signing context required by audio response contracts', async () => {
  let call;
  const operation = { id: 'station', timeoutMs: 4000, shapeSignature: { '$': 'object', '$.mediaUrl': 'scalar' } };
  const rows = await runHealthCheck({ entries: [{ id: 'radio-browser', operations: [operation] }], broker: { call: async (input) => { call = input; return { data: { mediaUrl: `${input.media.origin}/media/health-media` } }; } }, now: 10 });
  assert.equal(rows[0].status, 'healthy');
  assert.equal(call.media.tokenSigner.issueMedia(), 'health-media');
  assert.equal(typeof call.media.mediaStore.createMediaToken, 'function');
});
