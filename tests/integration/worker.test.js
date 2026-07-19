const test = require('node:test');
const assert = require('node:assert/strict');
const { createWebHandler } = require('../../src/web');
const { Broker } = require('../../src/core/broker');
const { RunStore } = require('../../src/core/store');
const { CapabilitySigner } = require('../../src/core/capability');
const { RUNTIME_CONTRACT_CUTOFF_MS } = require('../../src/core/presentation');

test('Cloudflare-shaped fetch handler serves health, MCP, and spin without a listener', async () => {
  const fetchHandler = createWebHandler({ broker: new Broker({ fixtureMode: true }) });
  const health = await fetchHandler(new Request('https://randomware.example/healthz'));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).registry, 21);
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
  assert.match(spinBody.statusUrl, /^https:\/\/randomware\.example\/api\/runs\//);
  assert.equal(spinBody.creationUrl, null);
  const mcpSpin = await fetchHandler(new Request('https://randomware.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'spin_apis', arguments: { seed: 'mcp-worker', requestId: 'mcp-worker-spin' } } }) }));
  const mcpSpinBody = await mcpSpin.json();
  const mcpRunId = mcpSpinBody.result.structuredContent.runId;
  assert.match(mcpSpinBody.result.structuredContent.statusUrl, /^https:\/\/randomware\.example\/api\/runs\//);
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

test('public run status permits foreign-origin widget reads and preflight', async () => {
  const store = new RunStore();
  const fetchHandler = createWebHandler({ store, broker: new Broker({ fixtureMode: true }) });
  const run = store.createRun({ requestId: 'widget-status-cors', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  const url = `https://randomware.example/api/runs/${run.id}`;
  const origin = 'https://web-sandbox.oaiusercontent.com';

  const status = await fetchHandler(new Request(url, { headers: { origin } }));
  assert.equal(status.status, 200);
  assert.equal(status.headers.get('access-control-allow-origin'), '*');
  assert.equal((await status.json()).runId, run.id);

  const preflight = await fetchHandler(new Request(url, {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'GET' }
  }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /GET/);
});

test('Worker inspection and report views stay closed after owner unpublish', async () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'worker-unpublish', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  store.acceptConcept(run.id, { requestId: 'worker-unpublish-concept', appName: 'Retired Clerk', apiIds: ['open-meteo'] });
  const accepted = store.acceptArtifact(run.id, { requestId: 'worker-unpublish-artifact', html: 'frozen source', bytes: 13 });
  store.unpublishCreation(accepted.creationId);
  const fetchHandler = createWebHandler({ store, broker: new Broker({ fixtureMode: true }) });
  for (const suffix of ['source', 'requests', 'requests?format=raw', 'dataflow', 'dataflow?format=raw', 'report']) {
    const result = await fetchHandler(new Request(`https://randomware.example/api/creations/${accepted.creationId}/${suffix}`));
    assert.equal(result.status, 200);
    assert.match(await result.text(), /Creation removed/);
  }
});

test('Worker refuses to execute a preserved pre-runtime-contract artifact', async () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'worker-early-runtime', selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }] });
  store.acceptConcept(run.id, { requestId: 'worker-early-concept', appName: 'Early Weather Clerk', apiIds: ['open-meteo'] });
  store.acceptArtifact(run.id, { requestId: 'worker-early-artifact', html: '<script>window.earlyArtifactExecuted=true</script>', bytes: 50 });
  run.revisions[0].at = RUNTIME_CONTRACT_CUTOFF_MS - 1;
  const fetchHandler = createWebHandler({ store, broker: new Broker({ fixtureMode: true }) });

  const response = await fetchHandler(new Request(`https://randomware.example/run/${run.creationId}`));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Runtime retired/);
  assert.match(html, /pre-contract specimen is not executed/);
  assert.doesNotMatch(html, /window\.randomware|earlyArtifactExecuted/);
  assert.equal(run.lastCapabilityExpiresAt, undefined);
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

test('Worker records a bounded runtime timeout retry before the successful request', async () => {
  const store = new RunStore();
  const signer = new CapabilitySigner('worker-retry-test-secret');
  let calls = 0;
  const broker = new Broker({ fetcher: async () => {
    calls += 1;
    if (calls === 1) throw new DOMException('timed out', 'TimeoutError');
    return new Response(JSON.stringify({ date: '2026-07-18', base: 'USD', quote: 'JPY', rate: 162.35 }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const fetchHandler = createWebHandler({ store, signer, broker });
  const run = store.createRun({ requestId: 'runtime-retry-test', selectedApis: [{ apiId: 'frankfurter', operationIds: ['rates'] }] });
  store.acceptConcept(run.id, { requestId: 'runtime-retry-concept', apiIds: ['frankfurter'] });
  store.acceptArtifact(run.id, { requestId: 'runtime-retry-artifact', html: '<!doctype html>', sha256: 'test', bytes: 16 });
  const capability = signer.issue({ creationId: run.creationId, revision: 1, selected: [{ apiId: 'frankfurter', operationId: 'rates' }] });
  const response = await fetchHandler(new Request('https://randomware.example/api/runtime/call', {
    method: 'POST', headers: { origin: 'null', 'content-type': 'application/json' },
    body: JSON.stringify({ creationId: run.creationId, revision: 1, apiId: 'frankfurter', operationId: 'rates', params: {}, capability })
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.rate, 162.35);
  assert.deepEqual(store.findByCreation(run.creationId).runtimeRequests.map((row) => row.status), ['runtime_timeout_retry', 'ok']);
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
  const foreignOrigin = 'https://web-sandbox.oaiusercontent.com';
  const preflight = await fetchHandler(new Request(mediaUrl, { method: 'OPTIONS', headers: { origin: foreignOrigin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'range' } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /GET/);
  assert.match(preflight.headers.get('access-control-allow-headers') || '', /range/i);
  const streamed = await fetchHandler(new Request(mediaUrl, { headers: { origin: foreignOrigin } }));
  assert.equal(streamed.status, 200);
  assert.equal(streamed.headers.get('content-type'), 'audio/mpeg');
  assert.equal(streamed.headers.get('access-control-allow-origin'), '*');
  assert.equal(streamed.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal(Buffer.from(await streamed.arrayBuffer()).toString(), 'ID3bounded-audio');
  assert.equal(upstreamCalls, 2);
});

test('Worker media route heals a dropped abort cleanup and accepts a Range reconnect', async () => {
  const store = new RunStore();
  const signer = new CapabilitySigner('worker-media-reconnect-secret');
  const originalFinish = store.finishMediaStream.bind(store);
  let dropFirstCleanup = true;
  store.finishMediaStream = (tokenId, bytes, streamLease) => {
    if (dropFirstCleanup) { dropFirstCleanup = false; return store.getMediaToken(tokenId); }
    return originalFinish(tokenId, bytes, streamLease);
  };
  const fetcher = async (_target, options = {}) => {
    const range = options.headers?.range;
    let emitted = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (emitted >= 4) { controller.close(); return; }
        emitted += 1;
        controller.enqueue(new Uint8Array(4096).fill(emitted));
      }
    });
    return new Response(body, { status: range ? 206 : 200, headers: { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', ...(range ? { 'content-range': 'bytes 0-16383/16384' } : {}) } });
  };
  const fetchHandler = createWebHandler({ store, signer, broker: new Broker({ fixtureMode: true, fetcher }) });
  const run = store.createRun({ requestId: 'media-reconnect-run', selectedApis: [{ apiId: 'radio-browser', operationIds: ['station'] }] });
  store.acceptConcept(run.id, { requestId: 'media-reconnect-concept', apiIds: ['radio-browser'] });
  store.acceptArtifact(run.id, { requestId: 'media-reconnect-artifact', html: '<!doctype html>', sha256: 'test', bytes: 16 });
  const capability = signer.issue({ creationId: run.creationId, revision: 1, selected: [{ apiId: 'radio-browser', operationId: 'station' }] });
  const mediated = await fetchHandler(new Request('https://randomware.example/api/runtime/call', { method: 'POST', headers: { origin: 'null', 'content-type': 'application/json' }, body: JSON.stringify({ creationId: run.creationId, revision: 1, apiId: 'radio-browser', operationId: 'station', params: {}, capability }) }));
  const mediaUrl = (await mediated.json()).data.mediaUrl;
  const waitUntilTasks = [];
  const executionContext = { waitUntil: (task) => waitUntilTasks.push(Promise.resolve(task)) };
  const first = await fetchHandler(new Request(mediaUrl), {}, executionContext);
  const firstReader = first.body.getReader();
  const firstChunk = await firstReader.read();
  assert.ok(firstChunk.value.byteLength > 0);
  await firstReader.cancel('browser_reconnect');
  await Promise.all(waitUntilTasks);
  assert.ok(waitUntilTasks.length > 0);
  const reconnect = await fetchHandler(new Request(mediaUrl, { headers: { Range: 'bytes=0-4095' } }), {}, executionContext);
  assert.equal(reconnect.status, 206);
  assert.equal(reconnect.headers.get('cross-origin-resource-policy'), 'cross-origin');
  const reconnectReader = reconnect.body.getReader();
  assert.ok((await reconnectReader.read()).value.byteLength > 0);
  await reconnectReader.cancel('test_complete');
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

test('Worker media route serves signed Wikimedia Commons audio only from upload.wikimedia.org', async () => {
  const store = new RunStore();
  const signer = new CapabilitySigner('worker-commons-media-test-secret');
  const fetcher = async (target) => {
    assert.match(String(target), /^https:\/\/upload\.wikimedia\.org\//);
    return new Response(Buffer.from('OggScommons-audio'), { status: 200, headers: { 'content-type': 'application/ogg' } });
  };
  const fetchHandler = createWebHandler({ store, signer, broker: new Broker({ fixtureMode: true, fetcher }) });
  const run = store.createRun({ requestId: 'commons-media-route-test', selectedApis: [{ apiId: 'wikimedia-commons-audio', operationIds: ['recording'] }] });
  store.acceptConcept(run.id, { requestId: 'commons-media-route-concept', apiIds: ['wikimedia-commons-audio'] });
  store.acceptArtifact(run.id, { requestId: 'commons-media-route-artifact', html: '<!doctype html>', sha256: 'test', bytes: 16 });
  const capability = signer.issue({ creationId: run.creationId, revision: 1, selected: [{ apiId: 'wikimedia-commons-audio', operationId: 'recording' }] });
  const mediated = await fetchHandler(new Request('https://randomware.example/api/runtime/call', { method: 'POST', headers: { origin: 'null', 'content-type': 'application/json' }, body: JSON.stringify({ creationId: run.creationId, revision: 1, apiId: 'wikimedia-commons-audio', operationId: 'recording', params: {}, capability }) }));
  assert.equal(mediated.status, 200);
  const body = await mediated.json();
  assert.equal(body.data.recording.license, 'CC BY-SA 4.0');
  const streamed = await fetchHandler(new Request(body.data.mediaUrl, { headers: { origin: 'https://web-sandbox.oaiusercontent.com' } }));
  assert.equal(streamed.status, 200);
  assert.equal(streamed.headers.get('content-type'), 'audio/ogg');
  assert.equal(streamed.headers.get('access-control-allow-origin'), '*');
  assert.equal(Buffer.from(await streamed.arrayBuffer()).toString(), 'OggScommons-audio');
});

test('Worker asset route serves a signed allowlisted image and binds the page quota', async () => {
  const store = new RunStore();
  const signer = new CapabilitySigner('worker-asset-test-secret');
  const fetcher = async (target) => {
    assert.match(String(target), /^https:\/\/images\.dog\.ceo\//);
    return new Response(Buffer.from('bounded-image'), { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '13' } });
  };
  const fetchHandler = createWebHandler({ store, signer, broker: new Broker({ fixtureMode: true, fetcher }) });
  const run = store.createRun({ requestId: 'asset-route-test', selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }] });
  store.acceptConcept(run.id, { requestId: 'asset-route-concept', apiIds: ['dog-ceo'] });
  store.acceptArtifact(run.id, { requestId: 'asset-route-artifact', html: '<!doctype html>', sha256: 'test', bytes: 16 });
  const capability = signer.issue({ creationId: run.creationId, revision: 1, selected: [{ apiId: 'dog-ceo', operationId: 'random' }] });
  const mediated = await fetchHandler(new Request('https://randomware.example/api/runtime/call', { method: 'POST', headers: { origin: 'null', 'content-type': 'application/json' }, body: JSON.stringify({ creationId: run.creationId, revision: 1, apiId: 'dog-ceo', operationId: 'random', params: {}, capability }) }));
  assert.equal(mediated.status, 200);
  const assetUrl = (await mediated.json()).data.message;
  assert.match(assetUrl, /^https:\/\/randomware\.example\/api\/runtime\/asset\//);
  const asset = await fetchHandler(new Request(assetUrl));
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('content-type'), 'image/jpeg');
  assert.equal(asset.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal(Buffer.from(await asset.arrayBuffer()).toString(), 'bounded-image');
});
