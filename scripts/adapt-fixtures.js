const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../src/core/registry');
const { bounded } = require('../src/core/broker');

const root = path.resolve(__dirname, '..');
for (const entry of registry) {
  const operation = entry.operations[0];
  const source = path.join(root, 'docs', 'api-candidates', 'samples', operation.fixturePath);
  const target = path.join(root, operation.adaptedFixturePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const data = bounded(JSON.parse(fs.readFileSync(source, 'utf8')));
  fs.writeFileSync(target, `${JSON.stringify({ apiId: entry.id, operationId: operation.id, data }, null, 2)}\n`);
}
console.log(`adapted fixtures written for ${registry.length} entries`);
