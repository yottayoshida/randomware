const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Worker deployment manifest points to static assets, D1, and an hourly health trigger', () => {
  const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.main, 'src/worker.mjs');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.deepEqual(config.assets.run_worker_first, ['/', '/index.html']);
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.deepEqual(config.triggers.crons, ['0 * * * *']);
  assert.match(fs.readFileSync('migrations/0001_initial.sql', 'utf8'), /CREATE TABLE IF NOT EXISTS runs/);
  assert.match(fs.readFileSync('migrations/0002_run_metadata.sql', 'utf8'), /ALTER TABLE runs ADD COLUMN metadata_json/);
  assert.match(fs.readFileSync('migrations/0003_media_tokens.sql', 'utf8'), /CREATE TABLE IF NOT EXISTS media_tokens/);
  assert.match(fs.readFileSync('migrations/0004_asset_tokens.sql', 'utf8'), /CREATE TABLE IF NOT EXISTS asset_tokens/);
  assert.match(fs.readFileSync('migrations/0005_media_stream_leases.sql', 'utf8'), /ADD COLUMN stream_lease TEXT/);
  const curation = fs.readFileSync('migrations/0006_curate_showcase.sql', 'utf8');
  assert.match(curation, /'\$\.listed', json\('false'\)/);
  assert.match(curation, /artifact_revisions\.created_at/);
  assert.match(curation, /1784392071657/);
  assert.match(curation, /synthetic-\*/);
});
