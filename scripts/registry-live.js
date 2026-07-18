const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../src/core/registry');
const { Broker } = require('../src/core/broker');
const { compareShape } = require('../src/core/response-contract');
const { capture } = require('./adapt-fixtures');

async function check(entry) {
  const operation = entry.operations[0];
  const url = `https://${entry.upstreamHosts[0]}${operation.pathTemplate}`;
  const started = Date.now();
  try {
    const fixture = await capture(new Broker({ fixtureMode: false }), entry, operation);
    const drift = compareShape(fixture.data, operation.shapeSignature);
    if (!drift.ok) {
      const detail = [...drift.missing.map((value) => `missing:${value}`), ...drift.extra.map((value) => `extra:${value}`), ...drift.changed.map((value) => `changed:${value.path}:${value.expected}->${value.actual}`)].slice(0, 8).join('|');
      return { id: entry.id, status: 'disabled', reason: `adapted_shape_drift:${detail}`, latencyMs: Date.now() - started, url };
    }
    return { id: entry.id, status: 'healthy', bytes: Buffer.byteLength(JSON.stringify(fixture.data)), latencyMs: Date.now() - started, shape: 'matched', url };
  } catch (error) {
    return { id: entry.id, status: 'unavailable', reason: error.message || 'network_error', latencyMs: Date.now() - started, url };
  }
}

(async () => {
  const report = [];
  for (let index = 0; index < registry.length; index += 3) report.push(...await Promise.all(registry.slice(index, index + 3).map(check)));
  const payload = { checkedAt: new Date().toISOString(), entries: report, healthy: report.filter((entry) => entry.status === 'healthy').length, shapeMatched: report.filter((entry) => entry.shape === 'matched').length };
  const target = path.join(path.resolve(__dirname, '..'), '.runtime', 'registry-live.json');
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`registry:verify:live checked ${report.length} entries; healthy=${payload.healthy}; shapeMatched=${payload.shapeMatched}; report=${path.relative(process.cwd(), target)}`);
  if (payload.healthy < 10 && process.env.RANDOMWARE_LIVE_ALLOW_OFFLINE !== '1') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
