const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../../src/server');
const { createArtifact } = require('../../src/core/artifact');

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { response, body };
}

test('generated runtime is contained and unknown calls are denied', async (t) => {
  const server = createServer({ fixtureMode: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const spin = await request(base, '/api/spin', { method: 'POST', body: JSON.stringify({ seed: 'containment', requestId: 'containment-spin' }) });
  const apiIds = spin.body.selectedApis.map((entry) => entry.id);
  const concept = await request(base, `/api/runs/${spin.body.runId}/concept`, { method: 'POST', body: JSON.stringify({ requestId: 'containment-concept', appName: 'Contained Test', premise: 'A bounded containment test where selected signals stage a careful little ritual.', playerAction: 'Press the test button to reveal the mediated specimen.', noveltyDelta: 'The signals are staged as a ritual instead of a dashboard.', apiIds, apiRoles: spin.body.selectedApis.map((entry) => ({ apiId: entry.id, essentialRole: `${entry.name} supplies one non-optional ritual signal.`, operations: entry.operations.map((operation) => operation.id) })), causalChain: spin.body.selectedApis.map((entry, index) => ({ order: index + 1, apiId: entry.id, action: `turn ${entry.name} into the next ritual rule` })), dependency: { fromApiId: apiIds[0], to: 'rules', toApiId: apiIds[1], explanation: 'The first source determines the next ritual rule.' }, interaction: { controls: ['perform test'], outcome: 'The button reveals the bounded result.' }, visualDirection: { style: 'maximalist containment theatre', palette: 'ink and cyan', typography: 'oversized serif', motion: 'signals cascade in order' }, bannedShapeAssessment: { plainDashboard: false, plainSearch: false, plainQuiz: false, randomFactDisplay: false, thinClone: false, plausibleStartupPitch: false, explanation: 'This is an explicit containment experiment.' } }) });
  assert.equal(concept.response.status, 200);
  const selected = spin.body.selectedApis.map((entry) => ({ apiId: entry.id, operationId: entry.operations[0].id }));
  const artifact = await request(base, `/api/runs/${spin.body.runId}/artifact`, { method: 'POST', body: JSON.stringify({ requestId: 'containment-artifact', html: createArtifact({ appName: 'Contained', selected }) }) });
  assert.equal(artifact.response.status, 200);
  const page = await fetch(`${base}/c/${artifact.body.creationId}`);
  assert.equal(page.headers.get('content-security-policy').includes("frame-src 'self'"), true);
  const ownerHtml = await page.text();
  assert.match(ownerHtml, /sandbox="allow-scripts"/);
  assert.doesNotMatch(ownerHtml, /sandbox="[^"]*(?:allow-same-origin|allow-forms|allow-popups|allow-top-navigation)/);
  const runtime = await fetch(`${base}/run/${artifact.body.creationId}`);
  assert.equal(runtime.headers.get('access-control-allow-origin'), 'null');
  assert.match(await runtime.text(), /window\.randomware/);
  const denied = await request(base, '/api/runtime/call', { method: 'POST', body: JSON.stringify({ creationId: artifact.body.creationId, revision: 1, apiId: 'not-selected', operationId: 'anything', capability: 'bad' }) });
  assert.equal(denied.response.status, 400);
  const originDenied = await request(base, '/api/runtime/call', { method: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ creationId: artifact.body.creationId, revision: 1, apiId: 'not-selected', operationId: 'anything', capability: 'bad' }) });
  assert.equal(originDenied.body.code, 'origin_not_allowed');
});
