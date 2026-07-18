const test = require('node:test');
const assert = require('node:assert/strict');
const { CHOREOGRAPHY_DEADLINES, startChoreography, noteChoreographyActivity } = require('../../src/core/choreography');

test('artifact and repair choreography allow measured composition time', () => {
  assert.deepEqual(CHOREOGRAPHY_DEADLINES.concept, { firstMs: 180000, finalMs: 300000, absoluteMs: 600000 });
  assert.deepEqual(CHOREOGRAPHY_DEADLINES.artifact, { firstMs: 300000, finalMs: 600000, absoluteMs: 1200000 });
  assert.deepEqual(CHOREOGRAPHY_DEADLINES.repair, { firstMs: 300000, finalMs: 600000, absoluteMs: 1200000 });
});

test('phase activity resets inactivity without moving the absolute backstop', () => {
  const run = { phase: 'spinned', choreography: startChoreography('spinned', 1000) };
  run.choreography.reSteered = true;
  const absolute = run.choreography.absoluteDeadlineAt;
  noteChoreographyActivity(run, 120000);
  assert.equal(run.choreography.lastActivityAt, 120000);
  assert.equal(run.choreography.idleDeadlineAt, 180000 + 120000);
  assert.equal(run.choreography.absoluteDeadlineAt, absolute);
  assert.equal(run.choreography.reSteered, false);
});
