const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Worker deployment manifest points to static assets, D1, and an hourly health trigger', () => {
  const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.main, 'src/worker.mjs');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.deepEqual(config.triggers.crons, ['0 * * * *']);
  assert.match(fs.readFileSync('migrations/0001_initial.sql', 'utf8'), /CREATE TABLE IF NOT EXISTS runs/);
});
