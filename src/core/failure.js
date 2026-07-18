const FAILURE_COPY = Object.freeze({
  invalid_concept: ['Invalid concept', 'The collision contract did not cover its selected APIs.', 'The idea stopped before it could become a specimen.'],
  artifact_missing: ['Artifact missing', 'No complete HTML artifact reached the server.', 'The blank page was the honest result.'],
  artifact_schema: ['Artifact schema', 'The generated page did not satisfy the bounded artifact contract.', 'The specimen failed inspection before publication.'],
  html_parse: ['HTML parse', 'The submitted document was not a safe HTML5 document.', 'The parser found a crack in the shell.'],
  javascript_parse: ['JavaScript parse', 'The inline program could not be parsed safely.', 'The script tripped over its own syntax.'],
  policy_blocked: ['Policy blocked', 'The artifact requested a forbidden capability or unsafe field.', 'The sandbox door stayed closed.'],
  runtime_javascript: ['Runtime JavaScript', 'The specimen raised a runtime error after boot.', 'The little machine threw a gear.'],
  upstream_failure: ['Upstream failure', 'A selected public source failed while the broker was mediating it.', 'The outside world did not answer.'],
  response_shape_mismatch: ['Response shape', 'The source response did not match its bounded adapter.', 'The ingredient arrived in the wrong shape.'],
  runtime_timeout: ['Runtime timeout', 'A selected operation exceeded its bounded deadline.', 'Time won this spin.'],
  unused_api: ['Unused API', 'A selected API received no completed call before the capability expired.', 'One ingredient was left on the counter.'],
  repair_failed: ['Repair failed', 'The single replacement artifact did not pass validation.', 'The repair kit had one part, and it was not enough.'],
  choreography_timeout: ['Choreography timeout', 'The next required tool call did not arrive before its absolute deadline.', 'Silence became the final state.'],
  capacity_reached: ['Capacity reached', 'A bounded runtime or provider budget was exhausted.', 'The wallet remained closed.']
});

function deathCertificate(code, { detail = '', specimenId = 'unknown', elapsedMs = 0, revisions = [] } = {}) {
  const copy = FAILURE_COPY[code] || ['Unknown failure', 'The specimen stopped for an unclassified reason.', 'The machine declines to invent a cause.'];
  return { code, title: copy[0], detail: detail || copy[1], epitaph: copy[2], specimenId, elapsedMs, revisions: revisions.map((revision) => ({ revision: revision.revision, status: revision.status, sha256: revision.sha256 || null })) };
}

module.exports = { FAILURE_COPY, deathCertificate };
