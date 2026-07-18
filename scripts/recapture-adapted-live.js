const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../src/core/registry');
const { Broker } = require('../src/core/broker');
const { capture } = require('./adapt-fixtures');

const root = path.resolve(__dirname, '..');

async function main() {
  const broker = new Broker({ fixtureMode: false });
  const failures = [];
  for (const entry of registry) {
    const operation = entry.operations[0];
    try {
      const fixture = await capture(broker, entry, operation);
      fs.writeFileSync(path.join(root, operation.adaptedFixturePath), `${JSON.stringify(fixture, null, 2)}\n`);
      console.log(`captured ${entry.id}/${operation.id}`);
    } catch (error) {
      failures.push(`${entry.id}/${operation.id}:${error.message}`);
      console.error(`capture failed ${failures.at(-1)}`);
    }
  }
  if (failures.length) throw new Error(`live_adapted_capture_incomplete:${failures.join(',')}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
