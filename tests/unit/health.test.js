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
