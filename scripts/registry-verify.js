const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../src/core/registry');

if (registry.length < 10 || registry.length > 21) throw new Error(`registry_count_out_of_bounds:${registry.length}`);
const root = path.resolve(__dirname, '..');
for (const entry of registry) {
  if (!entry.docsUrl || !entry.termsUrl || !entry.attribution?.url) throw new Error(`missing_policy_metadata:${entry.id}`);
  if (!entry.semanticTags?.length) throw new Error(`missing_semantic_tags:${entry.id}`);
  if (!entry.upstreamHosts.length) throw new Error(`missing_hosts:${entry.id}`);
  for (const op of entry.operations) {
    if (op.method !== 'GET' || !op.fixturePath || !op.paramsSchema || !op.outputSchema || !op.responseExample || !op.semanticFieldPaths?.length || !op.shapeSignature || !/^\//.test(op.pathTemplate)) throw new Error(`invalid_operation:${entry.id}/${op.id}`);
    const fixture = path.join(root, 'docs', 'api-candidates', 'samples', op.fixturePath);
    if (!fs.existsSync(fixture)) throw new Error(`missing_fixture:${entry.id}:${fixture}`);
    JSON.parse(fs.readFileSync(fixture, 'utf8'));
    const adapted = path.join(root, op.adaptedFixturePath);
    if (!fs.existsSync(adapted)) throw new Error(`missing_adapted_fixture:${entry.id}:${adapted}`);
    JSON.parse(fs.readFileSync(adapted, 'utf8'));
  }
}
console.log(`registry:verify passed (${registry.length} enabled entries)`);
