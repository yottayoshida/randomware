const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'public'), { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css']) {
  fs.copyFileSync(path.join(root, 'public', file), path.join(dist, 'public', file));
}
fs.copyFileSync(path.join(root, 'src', 'server.js'), path.join(dist, 'server.js'));
console.log('build passed (dist/public and server entry prepared)');
