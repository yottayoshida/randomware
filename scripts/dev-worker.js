const { spawnSync } = require('node:child_process');

const hasWrangler = spawnSync('wrangler', ['--version'], { stdio: 'ignore' }).status === 0;
if (hasWrangler) {
  const child = require('node:child_process').spawn('wrangler', ['dev'], { stdio: 'inherit' });
  child.on('exit', (code) => { process.exitCode = code || 0; });
} else {
  console.warn('Wrangler is not installed; using the local Node compatibility server. Install Wrangler to exercise the Worker/D1 adapter.');
  require('../src/server');
  require('node:child_process').spawn(process.execPath, ['src/server.js'], { stdio: 'inherit' }).on('exit', (code) => { process.exitCode = code || 0; });
}
