const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory() && !['.git', 'node_modules', 'dist', '.runtime'].includes(entry.name)) walk(target);
    else if (entry.isFile() && !entry.name.endsWith('.headers')) files.push(target);
  }
}
walk(root);
const findings = [];
const patterns = [/(?:AKIA|ASIA)[A-Z0-9]{16}/, /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/, /gh[pousr]_[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9]{20,}/];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (patterns.some((pattern) => pattern.test(source))) findings.push(path.relative(root, file));
}
if (findings.length) {
  console.error(`secret-like content found: ${findings.join(', ')}`);
  process.exitCode = 1;
} else console.log(`secrets:scan passed (${files.length} files inspected)`);
