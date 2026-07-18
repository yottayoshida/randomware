const test = require('node:test');
const assert = require('node:assert/strict');
const { deathCertificate, FAILURE_COPY } = require('../../src/core/failure');

test('death certificates cover every stable failure code without raw stack details', () => {
  for (const code of Object.keys(FAILURE_COPY)) {
    const result = deathCertificate(code, { specimenId: 'c1', detail: 'safe detail', revisions: [{ revision: 1, status: 'failed' }] });
    assert.equal(result.code, code);
    assert.equal(result.specimenId, 'c1');
    assert.equal(result.revisions[0].sha256, null);
    assert.ok(result.epitaph);
  }
});
