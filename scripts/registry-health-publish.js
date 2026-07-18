const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const target = path.join(path.resolve(__dirname, '..'), '.runtime', 'registry-live.json');
const publishTarget = path.join(path.dirname(target), 'registry-publish.json');

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function mapStatus(entry) {
  if (entry.status === 'healthy') return { status: 'healthy', failures: 0, successes: 1, reason: null };
  if (entry.status === 'disabled') return { status: 'disabled', failures: 3, successes: 0, reason: entry.reason || 'disabled' };
  return { status: 'degraded', failures: 1, successes: 0, reason: entry.reason || 'unavailable' };
}

function buildHealthSql(report) {
  const checkedAt = Date.parse(report.checkedAt);
  if (!Number.isFinite(checkedAt)) throw new Error('live_report_timestamp_invalid');
  const values = report.entries.map((entry) => {
    const mapped = mapStatus(entry);
    return `(${quote(entry.id)}, ${quote(mapped.status)}, ${mapped.failures}, ${mapped.successes}, ${checkedAt}, ${mapped.reason === null ? 'NULL' : quote(mapped.reason)})`;
  });
  return `INSERT INTO api_health (api_id, status, consecutive_failures, consecutive_successes, checked_at, reason) VALUES ${values.join(', ')} ON CONFLICT(api_id) DO UPDATE SET status = excluded.status, consecutive_failures = excluded.consecutive_failures, consecutive_successes = excluded.consecutive_successes, checked_at = excluded.checked_at, reason = excluded.reason;`;
}

function publishReport(report, execute = (sql) => spawnSync('npx', ['--yes', 'wrangler', 'd1', 'execute', 'randomware', '--remote', '--command', sql], { stdio: 'inherit' })) {
  if ((report.healthy || 0) < 10) throw new Error(`healthy_registry_below_minimum:${report.healthy || 0}`);
  const result = execute(buildHealthSql(report));
  if (result && result.status !== 0) throw new Error(`d1_health_publish_failed:${result.status}`);
  const published = { publishedAt: new Date().toISOString(), sourceCheckedAt: report.checkedAt, healthy: report.healthy, entries: report.entries.filter((entry) => entry.status === 'healthy').map((entry) => entry.id) };
  fs.writeFileSync(publishTarget, `${JSON.stringify(published, null, 2)}\n`);
  return published;
}

if (require.main === module) {
  if (!fs.existsSync(target)) throw new Error('live_report_missing');
  const report = JSON.parse(fs.readFileSync(target, 'utf8'));
  const published = publishReport(report);
  console.log(`registry:health:publish wrote ${published.healthy} healthy rows to production D1; report=${path.relative(process.cwd(), publishTarget)}`);
}

module.exports = { buildHealthSql, mapStatus, publishReport };
