const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicFiles = ['public/index.html', 'public/app.js', 'public/styles.css'].map((file) => path.join(root, file));
const forbidden = [/window\.openai/i, /https?:\/\//i, /(?:localStorage|sessionStorage|indexedDB)/i, /document\.cookie/i];
const findings = [];
for (const file of publicFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) if (pattern.test(source)) findings.push(`${path.relative(root, file)} contains ${pattern}`);
}
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else console.log('security:scan passed (public surface has no direct upstream, storage, or OpenAI calls)');
