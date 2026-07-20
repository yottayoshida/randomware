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

test('default runtime and per-API daily budgets remain hard caps for uncached calls', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'default-quota', selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }] });
  for (let index = 0; index < 30; index += 1) store.logRuntime(run.id, { apiId: 'dog-ceo', status: 'ok', bytes: 1 });
  assert.throws(() => store.assertRuntimeQuota(run.id), /capacity_reached/);

  const dayOne = Date.UTC(2026, 6, 20, 12);
  for (let index = 0; index < 250; index += 1) store.consumeDailyBudget('api:dog-ceo', 250, dayOne);
  assert.throws(() => store.consumeDailyBudget('api:dog-ceo', 250, dayOne), /capacity_reached/);
  assert.deepEqual(store.consumeDailyBudget('api:dog-ceo', 250, dayOne + 86_400_000), { scope: 'api:dog-ceo', utcDate: '2026-07-21', count: 1, limit: 250 });
});
