const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { D1RunStore } = require('../../src/core/d1-store');
const { RUNTIME_CONTRACT_CUTOFF_MS } = require('../../src/core/presentation');

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync('migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(fs.readFileSync('migrations/0002_run_metadata.sql', 'utf8'));
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql); let values = [];
      return {
        bind(...args) { values = args; return this; },
        async run() { const result = statement.run(...values); return { meta: { changes: Number(result.changes) } }; },
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values) }; }
      };
    }
  };
}

test('D1 moderation flags survive a later narrow capability-expiry update', async () => {
  const db = database();
  const store = new D1RunStore(db);
  const run = await store.createRun({ requestId: 'd1-curated', selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }] });
  await store.acceptConcept(run.id, { requestId: 'd1-concept', appName: 'Dog Clerk', apiIds: ['dog-ceo'] });
  const accepted = await store.acceptArtifact(run.id, { requestId: 'd1-artifact', html: 'fixture', bytes: 7, sha256: 'hash' });
  assert.equal(accepted.listed, true);
  await store.reportCreation(accepted.creationId, 'broken');
  await store.setCapabilityExpiry(run.id, Date.now() + 600000);
  const reported = await store.getRun(run.id);
  assert.equal(reported.listed, false);
  assert.equal(reported.reported, true);
  assert.equal(reported.events.at(-1).type, 'reported');
  await store.unpublishCreation(accepted.creationId);
  await store.setCapabilityExpiry(run.id, Date.now() + 700000);
  const unpublished = await store.getRun(run.id);
  assert.equal(unpublished.listed, false);
  assert.equal(unpublished.reported, true);
  assert.equal(unpublished.unpublished, true);
  assert.equal(unpublished.events.at(-1).type, 'unpublished');
});

test('D1 run metadata persists the drawn style and style history', async () => {
  const store = new D1RunStore(database());
  const run = await store.createRun({ requestId: 'd1-style', selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }], styleId: 'teletext', styleHistory: ['vhs-jacket'] });
  const hydrated = await store.getRun(run.id);
  assert.equal(hydrated.styleId, 'teletext');
  assert.deepEqual(hydrated.styleHistory, ['vhs-jacket']);
});

test('D1 run metadata preserves the failed choreography phase for honest widget steps', async () => {
  const store = new D1RunStore(database());
  const run = await store.createRun({ requestId: 'd1-failure-phase', selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }] });
  await store.fail(run.id, 'choreography_timeout', 'artifact');
  const hydrated = await store.getRun(run.id);
  assert.deepEqual(hydrated.failure, { code: 'choreography_timeout', detail: 'artifact' });
});

test('showcase migration classifies a boundary-spanning run by accepted revision time', () => {
  const db = database();
  const insertRun = db.sqlite.prepare("INSERT INTO runs (id, request_id, phase, selected_apis_json, history_json, concept_json, created_at, creation_id, repair_count, metadata_json) VALUES (?, ?, 'completed', '[]', '[]', ?, ?, ?, 0, '{\"listed\":true}')");
  const insertRevision = db.sqlite.prepare("INSERT INTO artifact_revisions (run_id, revision, request_id, html, bytes, status, created_at) VALUES (?, 1, ?, 'fixture', 7, 'accepted', ?)");
  insertRun.run('run-before', 'owner-before', '{"appName":"Before"}', RUNTIME_CONTRACT_CUTOFF_MS - 10000, 'creation-before');
  insertRevision.run('run-before', 'artifact-before', RUNTIME_CONTRACT_CUTOFF_MS - 1);
  insertRun.run('run-spanning', 'owner-spanning', '{"appName":"Spanning"}', RUNTIME_CONTRACT_CUTOFF_MS - 10000, 'creation-spanning');
  insertRevision.run('run-spanning', 'artifact-spanning', RUNTIME_CONTRACT_CUTOFF_MS + 1);
  db.sqlite.exec(fs.readFileSync('migrations/0006_curate_showcase.sql', 'utf8'));
  assert.equal(JSON.parse(db.sqlite.prepare("SELECT metadata_json FROM runs WHERE id = 'run-before'").get().metadata_json).listed, false);
  assert.equal(JSON.parse(db.sqlite.prepare("SELECT metadata_json FROM runs WHERE id = 'run-spanning'").get().metadata_json).listed, true);
});
