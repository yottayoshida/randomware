const test = require('node:test');
const assert = require('node:assert/strict');
const { createWebHandler } = require('../../src/web');
const { Broker } = require('../../src/core/broker');

test('Cloudflare-shaped fetch handler serves health, MCP, and spin without a listener', async () => {
  const fetchHandler = createWebHandler({ broker: new Broker({ fixtureMode: true }) });
  const health = await fetchHandler(new Request('https://randomware.example/healthz'));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).registry, 18);
  const tools = await fetchHandler(new Request('https://randomware.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }));
  assert.equal((await tools.json()).result.tools.length, 8);
  const spin = await fetchHandler(new Request('https://randomware.example/api/spin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seed: 'worker', requestId: 'worker-spin' }) }));
  assert.equal(spin.status, 200);
  const spinBody = await spin.json();
  assert.equal(spinBody.selectedApis.length === 2 || spinBody.selectedApis.length === 3, true);
});
