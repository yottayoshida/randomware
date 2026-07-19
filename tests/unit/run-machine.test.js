const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { RunStore, phases } = require('../../src/core/store');

test('run store enforces concept before artifact and immutable selected APIs', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'r1', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }], styleId: 'teletext', styleHistory: ['board-game'] });
  assert.equal(run.phase, phases.SPINNED);
  assert.equal(run.styleId, 'teletext');
  assert.deepEqual(run.styleHistory, ['board-game']);
  store.acceptConcept(run.id, { requestId: 'c1', appName: 'Weather Dealer', premise: 'A weather auction', apiIds: ['open-meteo'], styleId: 'teletext' });
  assert.equal(store.getRun(run.id).phase, phases.CONCEPT_ACCEPTED);
  assert.throws(() => store.acceptConcept(run.id, { requestId: 'c2', appName: 'Other', premise: 'Other', apiIds: ['deck-of-cards'] }), /phase_or_idempotency/);
});

test('synthetic and browser gate creations are persisted as unlisted', () => {
  for (const [requestId, appName] of [['synthetic-next-gate', 'A generated test'], ['owner-looking-id', 'Browser Chrome Check']]) {
    const store = new RunStore();
    const run = store.createRun({ requestId, selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
    store.acceptConcept(run.id, { requestId: `${requestId}-concept`, appName, apiIds: ['open-meteo'] });
    const accepted = store.acceptArtifact(run.id, { requestId: `${requestId}-artifact`, html: 'fixture', bytes: 7 });
    assert.equal(accepted.listed, false);
  }
});

test('rejected-phase activity refreshes the inactivity deadline but not the absolute backstop', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'activity', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  const absolute = run.choreography.absoluteDeadlineAt;
  store.noteActivity(run.id, run.createdAt + 240000);
  assert.equal(run.choreography.lastActivityAt, run.createdAt + 240000);
  assert.equal(run.choreography.idleDeadlineAt, run.createdAt + 420000);
  assert.equal(run.choreography.absoluteDeadlineAt, absolute);
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

test('failed artifact revisions retain bounded source bytes and hashes', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'inspect-failure', selectedApis: [{ apiId: 'deck', operationIds: ['draw'] }] });
  store.acceptConcept(run.id, { requestId: 'inspect-concept', apiIds: ['deck'] });
  const firstSource = '<!doctype html><html><head></head><body>rejected first</body></html>';
  store.recordArtifactFailure(run.id, { requestId: 'inspect-artifact', code: 'artifact_schema', html: firstSource, bytes: Buffer.byteLength(firstSource), sha256: crypto.createHash('sha256').update(firstSource).digest('hex') });
  const secondSource = '<!doctype html><html><head></head><body>rejected repair</body></html>';
  const failed = store.recordRepairFailure(run.id, { requestId: 'inspect-repair', code: 'artifact_schema', html: secondSource, bytes: Buffer.byteLength(secondSource), sha256: crypto.createHash('sha256').update(secondSource).digest('hex') });
  assert.equal(failed.revisions[0].html, firstSource);
  assert.equal(failed.revisions[0].bytes, Buffer.byteLength(firstSource));
  assert.equal(failed.revisions[0].sha256, crypto.createHash('sha256').update(firstSource).digest('hex'));
  assert.equal(failed.revisions[1].html, secondSource);
  assert.equal(failed.revisions[1].bytes, Buffer.byteLength(secondSource));
  assert.equal(failed.revisions[1].sha256, crypto.createHash('sha256').update(secondSource).digest('hex'));
});

test('media stream leases are last-connection-wins and old cleanup cannot clear the replacement', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'media-lease-run', selectedApis: [{ apiId: 'radio-browser', operationIds: ['station'] }] });
  store.createMediaToken(run.id, { tokenId: 'media-lease-token', creationId: 'creation', revision: 1, apiId: 'radio-browser', operationId: 'station', resolvedUrl: 'https://radio.example/live.mp3', expiresAt: Date.now() + 60000, maxBytes: 1024 });
  const first = store.startMediaStream('media-lease-token');
  const second = store.startMediaStream('media-lease-token');
  assert.notEqual(first.streamLease, second.streamLease);
  store.finishMediaStream('media-lease-token', 100, first.streamLease);
  assert.equal(store.getMediaToken('media-lease-token').active, true);
  assert.equal(store.getMediaToken('media-lease-token').streamLease, second.streamLease);
  store.finishMediaStream('media-lease-token', 200, second.streamLease);
  assert.equal(store.getMediaToken('media-lease-token').active, false);
  assert.equal(store.getMediaToken('media-lease-token').bytesServed, 300);
});
