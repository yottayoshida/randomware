const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const commands = [
  ['format:check', 'scripts/check-format.js'],
  ['lint', 'scripts/check-lint.js'],
  ['typecheck', 'scripts/check-types.js'],
  ['unit', 'node_modules/.bin/placeholder'],
];
for (const [name, command] of commands.slice(0, 3)) {
  const result = spawnSync(process.execPath, [path.join(root, command)], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`acceptance:${name} passed`);
}
const testResult = spawnSync(process.execPath, ['--test', 'tests/unit/*.test.js'], { cwd: root, shell: true, stdio: 'inherit' });
if (testResult.status !== 0) process.exit(testResult.status || 1);
const integrationResult = spawnSync(process.execPath, ['--test', 'tests/integration/*.test.js'], { cwd: root, shell: true, stdio: 'inherit' });
if (integrationResult.status !== 0) process.exit(integrationResult.status || 1);
const e2eResult = spawnSync(process.execPath, ['--test', 'tests/e2e/*.test.js'], { cwd: root, shell: true, stdio: 'inherit' });
if (e2eResult.status !== 0) process.exit(e2eResult.status || 1);
const browserResult = spawnSync(process.env.PYTHON || 'python3', [path.join(root, 'scripts', 'browser-acceptance.py')], { cwd: root, stdio: 'inherit' });
if (browserResult.status !== 0) process.exit(browserResult.status || 1);
for (const script of ['build.js', 'registry-verify.js', 'security-scan.js', 'secrets-scan.js', 'document-check.js']) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const required of ['docs/PRD.md', 'docs/ARCHITECTURE.md', 'docs/PLAN.md', 'docs/ACCEPTANCE.md', 'docs/BUDGET.md', 'docs/BUILD_LOG.md', 'docs/DEMO_SCRIPT.md', 'LICENSE', 'README.md']) {
  if (!fs.existsSync(path.join(root, required))) {
    console.error(`required_document_missing:${required}`);
    process.exit(1);
  }
}
console.log('acceptance:machine passed (offline checks complete)');
