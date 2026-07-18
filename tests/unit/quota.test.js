const test = require('node:test');
const assert = require('node:assert/strict');
const { RunStore } = require('../../src/core/store');

test('runtime quota stops a capability after its bounded call budget', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'quota', selectedApis: [{ apiId: 'deck-of-cards', operationIds: ['draw'] }] });
  store.logRuntime(run.id, { status: 'ok', bytes: 4 });
  assert.deepEqual(store.assertRuntimeQuota(run.id, { jsonCalls: 2, adaptedBytes: 10 }), { completed: 1, bytes: 4 });
  store.logRuntime(run.id, { status: 'ok', bytes: 7 });
  assert.throws(() => store.assertRuntimeQuota(run.id, { jsonCalls: 2, adaptedBytes: 10 }), /capacity_reached/);
});
