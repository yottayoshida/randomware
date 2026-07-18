const { registry } = require('./registry');

function transition(previous = {}, result, now = Date.now()) {
  const failures = result.ok ? 0 : (previous.consecutiveFailures || 0) + 1;
  const successes = result.ok ? (previous.consecutiveSuccesses || 0) + 1 : 0;
  let status = previous.status || 'healthy';
  if (!result.ok || result.latencyMs > (result.latencyLimitMs || 6000)) status = failures >= 3 ? 'disabled' : 'degraded';
  else if (successes >= 2) status = 'healthy';
  return { apiId: result.apiId, status, consecutiveFailures: failures, consecutiveSuccesses: successes, latencyMs: result.latencyMs || null, checkedAt: now, reason: result.reason || null };
}

async function runHealthCheck({ broker, entries = registry, previous = new Map(), now = Date.now() } = {}) {
  const rows = [];
  for (const entry of entries) {
    const operation = entry.operations[0]; const started = Date.now(); let result;
    try { await broker.call({ selectedApis: [{ apiId: entry.id, operationIds: [operation.id] }], apiId: entry.id, operationId: operation.id, params: {} }); result = { apiId: entry.id, ok: true, latencyMs: Date.now() - started, latencyLimitMs: 6000 }; }
    catch (error) { result = { apiId: entry.id, ok: false, latencyMs: Date.now() - started, reason: error.message, latencyLimitMs: 6000 }; }
    rows.push(transition(previous.get(entry.id), result, now));
  }
  return rows;
}

async function publishHealth(db, rows) {
  const statements = rows.map((row) => db.prepare('INSERT INTO api_health (api_id, status, consecutive_failures, consecutive_successes, checked_at, reason) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(api_id) DO UPDATE SET status = excluded.status, consecutive_failures = excluded.consecutive_failures, consecutive_successes = excluded.consecutive_successes, checked_at = excluded.checked_at, reason = excluded.reason').bind(row.apiId, row.status, row.consecutiveFailures, row.consecutiveSuccesses, row.checkedAt, row.reason));
  if (statements.length) await db.batch(statements);
  return rows;
}

module.exports = { transition, runHealthCheck, publishHealth };
