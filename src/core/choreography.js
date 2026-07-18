const CHOREOGRAPHY_DEADLINES = Object.freeze({
  concept: Object.freeze({ firstMs: 180000, finalMs: 300000, absoluteMs: 600000 }),
  artifact: Object.freeze({ firstMs: 300000, finalMs: 600000, absoluteMs: 1200000 }),
  repair: Object.freeze({ firstMs: 300000, finalMs: 600000, absoluteMs: 1200000 })
});

function phaseKey(phase) {
  if (phase === 'spinned') return 'concept';
  if (phase === 'concept_accepted' || phase === 'building') return 'artifact';
  if (phase === 'repair_requested') return 'repair';
  return null;
}

function startChoreography(phase, now = Date.now()) {
  const key = CHOREOGRAPHY_DEADLINES[phase] ? phase : phaseKey(phase);
  const limits = key ? CHOREOGRAPHY_DEADLINES[key] : null;
  if (!limits) return null;
  return {
    phase: key,
    startedAt: now,
    lastActivityAt: now,
    idleDeadlineAt: now + limits.firstMs,
    absoluteDeadlineAt: now + limits.absoluteMs,
    reSteered: false
  };
}

function noteChoreographyActivity(run, now = Date.now()) {
  const key = phaseKey(run.phase);
  if (!key) return run;
  const current = run.choreography;
  if (!current || current.phase !== key) {
    run.choreography = startChoreography(key, now);
    return run;
  }
  const limits = CHOREOGRAPHY_DEADLINES[key];
  run.choreography.lastActivityAt = now;
  run.choreography.idleDeadlineAt = Math.min(now + limits.firstMs, run.choreography.absoluteDeadlineAt);
  run.choreography.reSteered = false;
  return run;
}

function advanceChoreography(run, now = Date.now()) {
  const next = startChoreography(run.phase, now);
  if (next) run.choreography = next;
  else delete run.choreography;
  return run;
}

module.exports = { CHOREOGRAPHY_DEADLINES, phaseKey, startChoreography, noteChoreographyActivity, advanceChoreography };
