const test = require('node:test');
const assert = require('node:assert/strict');
const { createWebHandler } = require('../../src/web');
const { Broker } = require('../../src/core/broker');
const { RunStore } = require('../../src/core/store');
const { CapabilitySigner } = require('../../src/core/capability');

test('Cloudflare-shaped fetch handler serves health, MCP, and spin without a listener', async () => {
  const fetchHandler = createWebHandler({ broker: new Broker({ fixtureMode: true }) });
  const health = await fetchHandler(new Request('https://randomware.example/healthz'));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).registry, 18);
  const tools = await fetchHandler(new Request('https://randomware.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }));
  assert.equal((await tools.json()).result.tools.length, 8);
  const open = await fetchHandler(new Request('https://randomware.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1.1, method: 'tools/call', params: { name: 'open_randomware', arguments: {} } }) }));
  const openResult = (await open.json()).result;
  assert.deepEqual(openResult.content, [{ type: 'text', text: 'Randomware slot mounted.' }]);
  assert.equal(openResult.structuredContent.ok, true);
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
  assert.deepEqual(resource._meta.ui.csp.frameDomains, ['https://randomware.example']);
  assert.deepEqual(resource._meta.ui.csp.connectDomains, ['https://randomware.example']);

  const tools = await post({ jsonrpc: '2.0', id: 5, method: 'tools/list' });
  const open = (await tools.json()).result.tools.find((tool) => tool.name === 'open_randomware');
  assert.equal(open._meta.ui.resourceUri, 'ui://widget/randomware.html');
  assert.equal(open._meta['openai/outputTemplate'], 'ui://widget/randomware.html');
  assert.equal(open._meta.ui.csp, undefined);

  const get = await fetchHandler(new Request('https://randomware.example/mcp', { headers: { accept: 'text/event-stream' } }));
  assert.equal(get.status, 405);
});

test('Worker broker route handles opaque-origin preflight and records a mediated request', async () => {
  const store = new RunStore();
  const signer = new CapabilitySigner('worker-route-test-secret');
  const fetchHandler = createWebHandler({ store, signer, broker: new Broker({ fixtureMode: true }) });
  const run = store.createRun({ requestId: 'runtime-route-test', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  store.acceptConcept(run.id, { requestId: 'runtime-route-concept', apiIds: ['open-meteo'] });
  store.acceptArtifact(run.id, { requestId: 'runtime-route-artifact', html: '<!doctype html>', sha256: 'test', bytes: 16 });
  const capability = signer.issue({ creationId: run.creationId, revision: 1, selected: [{ apiId: 'open-meteo', operationId: 'forecast' }] });

  const preflight = await fetchHandler(new Request('https://randomware.example/api/runtime/call', {
    method: 'OPTIONS',
    headers: { origin: 'null', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' }
  }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'null');
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /POST/);

  const mediated = await fetchHandler(new Request('https://randomware.example/api/runtime/call', {
    method: 'POST',
    headers: { origin: 'null', 'content-type': 'application/json' },
    body: JSON.stringify({ creationId: run.creationId, revision: 1, apiId: 'open-meteo', operationId: 'forecast', params: {}, capability })
  }));
  assert.equal(mediated.status, 200);
  assert.equal((await mediated.json()).ok, true);
  assert.equal(store.findByCreation(run.creationId).runtimeRequests.length, 1);
});

test('Worker media route streams a signed radio response through a validated redirect', async () => {
  const store = new RunStore();
  const signer = new CapabilitySigner('worker-media-test-secret');
  let upstreamCalls = 0;
  const fetcher = async (target) => {
    upstreamCalls += 1;
    if (String(target).includes('stream.laut.fm')) return new Response(null, { status: 302, headers: { location: 'https://cdn.example/radio.mp3' } });
    if (String(target) === 'https://cdn.example/radio.mp3') return new Response(Buffer.from('ID3bounded-audio'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
    throw new Error(`unexpected_media_target:${target}`);
  };
  const fetchHandler = createWebHandler({ store, signer, broker: new Broker({ fixtureMode: true, fetcher }) });
  const run = store.createRun({ requestId: 'media-route-test', selectedApis: [{ apiId: 'radio-browser', operationIds: ['station'] }] });
  store.acceptConcept(run.id, { requestId: 'media-route-concept', apiIds: ['radio-browser'] });
  store.acceptArtifact(run.id, { requestId: 'media-route-artifact', html: '<!doctype html>', sha256: 'test', bytes: 16 });
  const capability = signer.issue({ creationId: run.creationId, revision: 1, selected: [{ apiId: 'radio-browser', operationId: 'station' }] });
  const mediated = await fetchHandler(new Request('https://randomware.example/api/runtime/call', { method: 'POST', headers: { origin: 'null', 'content-type': 'application/json' }, body: JSON.stringify({ creationId: run.creationId, revision: 1, apiId: 'radio-browser', operationId: 'station', params: {}, capability }) }));
  assert.equal(mediated.status, 200);
  const mediatedBody = await mediated.json();
  assert.match(mediatedBody.data.mediaUrl, /^https:\/\/randomware\.example\/media\//);
  assert.doesNotMatch(JSON.stringify(mediatedBody), /stream\.laut\.fm|url_resolved/);
  const mediaUrl = new URL(mediatedBody.data.mediaUrl);
  const streamed = await fetchHandler(new Request(mediaUrl));
  assert.equal(streamed.status, 200);
  assert.equal(streamed.headers.get('content-type'), 'audio/mpeg');
  assert.equal(Buffer.from(await streamed.arrayBuffer()).toString(), 'ID3bounded-audio');
  assert.equal(upstreamCalls, 2);
});

test('Worker media route applies the archive.org policy to LibriVox audio', async () => {
  const store = new RunStore();
  const signer = new CapabilitySigner('worker-librivox-media-test-secret');
  const fetcher = async (target) => {
    assert.match(String(target), /^https:\/\/(?:www\.)?archive\.org\//);
    return new Response(Buffer.from('ID3librivox-audio'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  const fetchHandler = createWebHandler({ store, signer, broker: new Broker({ fixtureMode: true, fetcher }) });
  const run = store.createRun({ requestId: 'librivox-media-route-test', selectedApis: [{ apiId: 'librivox', operationIds: ['book'] }] });
  store.acceptConcept(run.id, { requestId: 'librivox-media-route-concept', apiIds: ['librivox'] });
  store.acceptArtifact(run.id, { requestId: 'librivox-media-route-artifact', html: '<!doctype html>', sha256: 'test', bytes: 16 });
  const capability = signer.issue({ creationId: run.creationId, revision: 1, selected: [{ apiId: 'librivox', operationId: 'book' }] });
  const mediated = await fetchHandler(new Request('https://randomware.example/api/runtime/call', { method: 'POST', headers: { origin: 'null', 'content-type': 'application/json' }, body: JSON.stringify({ creationId: run.creationId, revision: 1, apiId: 'librivox', operationId: 'book', params: {}, capability }) }));
  const mediaUrl = new URL((await mediated.json()).data.mediaUrl);
  const streamed = await fetchHandler(new Request(mediaUrl));
  assert.equal(streamed.status, 200);
  assert.equal(streamed.headers.get('content-type'), 'audio/mpeg');
  assert.equal(Buffer.from(await streamed.arrayBuffer()).toString(), 'ID3librivox-audio');
});
