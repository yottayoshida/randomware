const fs = require('node:fs');
const path = require('node:path');
const target = path.join(path.resolve(__dirname, '..'), '.runtime', 'registry-live.json');
if (!fs.existsSync(target)) throw new Error('live_report_missing');
const report = JSON.parse(fs.readFileSync(target, 'utf8'));
if ((report.healthy || 0) < 10) throw new Error(`healthy_registry_below_minimum:${report.healthy || 0}`);
const published = { publishedAt: new Date().toISOString(), sourceCheckedAt: report.checkedAt, healthy: report.healthy, entries: report.entries.filter((entry) => entry.status === 'healthy').map((entry) => entry.id) };
fs.writeFileSync(path.join(path.dirname(target), 'registry-publish.json'), `${JSON.stringify(published, null, 2)}\n`);
console.log(`registry:health:publish recorded ${published.healthy} healthy rows for explicit D1 publication`);
