const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHealthSql } = require('../../scripts/registry-health-publish');

test('health publication maps bounded live results to api_health SQL', () => {
  const sql = buildHealthSql({ checkedAt: '2026-07-18T04:18:11.632Z', entries: [
    { id: 'open-meteo', status: 'healthy' },
    { id: 'met-museum', status: 'disabled', reason: 'http_404' },
    { id: 'dog-ceo', status: 'unavailable', reason: 'timeout' }
  ] });
  assert.match(sql, /'open-meteo', 'healthy', 0, 1/);
  assert.match(sql, /'met-museum', 'disabled', 3, 0/);
  assert.match(sql, /'dog-ceo', 'degraded', 1, 0/);
  assert.match(sql, /ON CONFLICT\(api_id\) DO UPDATE/);
});
