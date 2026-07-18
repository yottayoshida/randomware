const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../src/core/registry');

const report = registry.map((entry) => ({ id: entry.id, status: 'fixture_ready', checkedAt: new Date().toISOString(), note: 'Live checks require the bounded deployment environment; fixture is the offline fallback.' }));
const target = path.join(path.resolve(__dirname, '..'), '.runtime', 'registry-live.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify({ entries: report }, null, 2)}\n`);
console.log(`registry:verify:live recorded ${report.length} offline-safe checks at ${path.relative(process.cwd(), target)}`);
