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
  const mcpSpin = await fetchHandler(new Request('https://randomware.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'spin_apis', arguments: { seed: 'mcp-worker', requestId: 'mcp-worker-spin' } } }) }));
  const mcpSpinBody = await mcpSpin.json();
  const mcpRunId = mcpSpinBody.result.structuredContent.runId;
  const mcpGet = await fetchHandler(new Request('https://randomware.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_run', arguments: { runId: mcpRunId } } }) }));
  assert.equal((await mcpGet.json()).result.structuredContent.runId, mcpRunId);
});

test('MCP lifecycle negotiates, accepts initialized notifications, and exposes the widget resource', async () => {
  const fetchHandler = createWebHandler({ broker: new Broker({ fixtureMode: true }) });
  const post = (message, headers = {}) => fetchHandler(new Request('https://randomware.example/mcp', { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...headers }, body: JSON.stringify(message) }));

  const initialized = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } } });
  assert.equal(initialized.status, 200);
  const initialization = await initialized.json();
  assert.equal(initialization.result.protocolVersion, '2025-06-18');
  assert.equal(initialization.result.serverInfo.name, 'randomware');
  assert.ok(initialization.result.capabilities.tools);
  assert.ok(initialization.result.capabilities.resources);

  const ready = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(ready.status, 202);
  assert.equal(await ready.text(), '');

  const ping = await post({ jsonrpc: '2.0', id: 2, method: 'ping' });
  assert.deepEqual((await ping.json()).result, {});

  const listed = await post({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
  const resources = await listed.json();
  assert.equal(resources.result.resources.length, 1);
  assert.equal(resources.result.resources[0].uri, 'ui://widget/randomware.html');

  const read = await post({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'ui://widget/randomware.html' } });
  const resource = (await read.json()).result.contents[0];
  assert.equal(resource.mimeType, 'text/html;profile=mcp-app');
  assert.match(resource.text, /sequential/i);
  assert.equal(resource._meta.ui.csp.frameDomains, undefined);
  assert.deepEqual(resource._meta.ui.csp.connectDomains, ['https://randomware.example']);

  const tools = await post({ jsonrpc: '2.0', id: 5, method: 'tools/list' });
  const open = (await tools.json()).result.tools.find((tool) => tool.name === 'open_randomware');
  assert.equal(open._meta.ui.resourceUri, 'ui://widget/randomware.html');
  assert.equal(open._meta['openai/outputTemplate'], 'ui://widget/randomware.html');
  assert.equal(open._meta.ui.csp, undefined);

  const get = await fetchHandler(new Request('https://randomware.example/mcp', { headers: { accept: 'text/event-stream' } }));
  assert.equal(get.status, 405);
});
