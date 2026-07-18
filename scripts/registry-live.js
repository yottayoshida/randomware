const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../src/core/registry');

async function check(entry) {
  const operation = entry.operations[0]; const url = `https://${entry.upstreamHosts[0]}${operation.pathTemplate}`;
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'Randomware/0.1 bounded registry check' }, signal: AbortSignal.timeout(Math.min(operation.timeoutMs, 6000)) });
    const type = response.headers.get('content-type') || ''; const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok) return { id: entry.id, status: 'disabled', reason: `http_${response.status}`, url };
    if (!type.includes('json') && !type.includes('javascript')) return { id: entry.id, status: 'disabled', reason: 'unexpected_content_type', url };
    if (bytes.byteLength > operation.maxRawBytes) return { id: entry.id, status: 'disabled', reason: 'raw_bytes_over_cap', url };
    JSON.parse(bytes.toString('utf8')); return { id: entry.id, status: 'healthy', bytes: bytes.byteLength, url };
  } catch (error) { return { id: entry.id, status: 'unavailable', reason: error?.name === 'TimeoutError' ? 'timeout' : 'network_error', url }; }
}

(async () => {
  const report = [];
  for (let index = 0; index < registry.length; index += 3) report.push(...await Promise.all(registry.slice(index, index + 3).map(check)));
  const payload = { checkedAt: new Date().toISOString(), entries: report, healthy: report.filter((entry) => entry.status === 'healthy').length };
  const target = path.join(path.resolve(__dirname, '..'), '.runtime', 'registry-live.json');
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`registry:verify:live checked ${report.length} entries; healthy=${payload.healthy}; report=${path.relative(process.cwd(), target)}`);
  if (payload.healthy < 10 && process.env.RANDOMWARE_LIVE_ALLOW_OFFLINE !== '1') process.exitCode = 1;
})();
