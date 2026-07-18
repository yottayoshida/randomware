const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const roots = ['src', 'tests', 'scripts', 'public'];
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(?:js|json|css|html)$/.test(entry.name)) files.push(target);
  }
}

for (const folder of roots) walk(path.join(root, folder));
const failures = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${path.relative(root, file)}:${index + 1}: trailing whitespace`);
  });
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`format:check passed (${files.length} files)`);
}
