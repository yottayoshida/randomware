const test = require('node:test');
const assert = require('node:assert/strict');
const { RunStore, phases } = require('../../src/core/store');

test('run store enforces concept before artifact and immutable selected APIs', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'r1', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  assert.equal(run.phase, phases.SPINNED);
  store.acceptConcept(run.id, { requestId: 'c1', appName: 'Weather Dealer', premise: 'A weather auction', apiIds: ['open-meteo'] });
  assert.equal(store.getRun(run.id).phase, phases.CONCEPT_ACCEPTED);
  assert.throws(() => store.acceptConcept(run.id, { requestId: 'c2', appName: 'Other', premise: 'Other', apiIds: ['deck-of-cards'] }), /phase_or_idempotency/);
});

test('concept reroll records history without creating an artifact', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'rr1', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  const rerolled = store.rerollConcept(run.id, { requestId: 'rr2', appName: 'Odd Weather', premise: 'A different collision premise.' });
  assert.equal(rerolled.phase, phases.SPINNED);
  assert.equal(rerolled.revisions.length, 0);
  assert.equal(rerolled.conceptHistory.length, 1);
});

test('dataflow distinguishes pending, observed, and expired unused APIs', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'flow', selectedApis: [{ apiId: 'a', operationIds: ['x'] }, { apiId: 'b', operationIds: ['y'] }] });
  assert.deepEqual(store.dataflow(run.id).map((row) => row.status), ['pending', 'pending']);
  store.logRuntime(run.id, { apiId: 'a', operationId: 'x', status: 'ok', bytes: 1 });
  assert.deepEqual(store.dataflow(run.id).map((row) => row.status), ['observed', 'pending']);
  run.lastCapabilityExpiresAt = Date.now() - 1;
  assert.deepEqual(store.dataflow(run.id).map((row) => row.status), ['observed', 'unused']);
});

test('repair is accepted once only after a failed artifact and preserves revisions', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'r2', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  store.acceptConcept(run.id, { requestId: 'c2', appName: 'Weather Dealer', premise: 'A weather auction', apiIds: ['open-meteo'] });
  store.recordArtifactFailure(run.id, { requestId: 'a1', code: 'policy_blocked', html: '<bad>' });
  assert.equal(store.getRun(run.id).phase, phases.REPAIR_REQUESTED);
  store.acceptRepair(run.id, { requestId: 'p1', html: 'replacement' });
  assert.equal(store.getRun(run.id).revisions.length, 2);
  assert.equal(store.getRun(run.id).phase, phases.COMPLETED);
  assert.throws(() => store.acceptRepair(run.id, { requestId: 'p2', html: 'again' }), /repair_limit/);
});

test('invalid repair becomes a terminal failed creation after one received repair', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'repair-fail-spin', selectedApis: [{ apiId: 'deck', operationIds: ['draw'] }] });
  store.acceptConcept(run.id, { requestId: 'repair-fail-concept', apiIds: ['deck'] });
  store.recordArtifactFailure(run.id, { requestId: 'repair-fail-artifact', code: 'policy_blocked', html: '<bad>' });
  const failed = store.recordRepairFailure(run.id, { requestId: 'repair-fail-repair', code: 'policy_blocked', html: '<still-bad>' });
  assert.equal(failed.phase, phases.FAILED);
  assert.equal(failed.repairCount, 1);
  assert.equal(failed.revisions.length, 2);
  assert.throws(() => store.recordRepairFailure(run.id, { requestId: 'repair-fail-again', code: 'policy_blocked', html: '<again>' }), /repair_limit/);
});
