const { createArtifact } = require('../src/core/artifact');
const { randomUUID } = require('node:crypto');
const { runSynthetic } = require('./test-synthetic-deployed');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const baseArg = process.argv.find((arg) => arg.startsWith('--base-url='));
const base = (baseArg ? baseArg.slice('--base-url='.length) : process.env.RANDOMWARE_PUBLIC_URL || '').replace(/\/$/, '');
if (!base) { console.error('test:e2e:deployed requires --base-url=HTTPS_URL or RANDOMWARE_PUBLIC_URL'); process.exit(2); }
if (!/^https:\/\//i.test(base)) { console.error('deployed URL must use HTTPS'); process.exit(2); }
const nativeFetch = globalThis.fetch.bind(globalThis);
const fetch = async (input, init = {}) => {
  const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const method = String(init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
  const safeRead = target.origin === base && ['GET', 'HEAD', 'OPTIONS'].includes(method) && !target.pathname.startsWith('/media/') && !target.pathname.startsWith('/api/runtime/asset/');
  for (let attempt = 0; attempt <= (safeRead ? 1 : 0); attempt += 1) {
    try { return await nativeFetch(input, init); } catch (error) {
      if (attempt < (safeRead ? 1 : 0)) continue;
      throw new Error(`fetch_failed:${method}:${target.pathname}:${error?.message || 'network_error'}`);
    }
  }
  throw new Error(`fetch_failed:${method}:${target.pathname}:network_error`);
};

(async () => {
  const health = await fetch(`${base}/healthz`); if (!health.ok) throw new Error(`health_status:${health.status}`);
  const healthBody = await health.json(); if (healthBody.ok !== true || healthBody.registry < 10) throw new Error('health_contract_failed');
  const registryResponse = await fetch(`${base}/api/registry`); const deployedRegistry = await registryResponse.json(); if (!registryResponse.ok || deployedRegistry.length !== 21 || deployedRegistry.find((entry) => entry.id === 'librivox')?.selectionEnabled !== false || deployedRegistry.find((entry) => entry.id === 'wikimedia-commons-audio')?.symbol !== '🔔') throw new Error('audio_roster_contract_failed');
  const mcp = async (message) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return await fetch(`${base}/mcp`, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify(message) }); } catch (error) {
        if (attempt === 1) throw new Error(`mcp_network_failed:${message.method}:${message.params?.name || 'lifecycle'}:${error.message}`);
      }
    }
    throw new Error(`mcp_network_failed:${message.method}:network_error`);
  };
  const initialize = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'randomware-deployed-e2e', version: '1.0.0' } } });
  if (!initialize.ok) throw new Error(`mcp_initialize_status:${initialize.status}`);
  const initializeBody = await initialize.json(); if (initializeBody.result?.protocolVersion !== '2025-06-18' || !initializeBody.result?.capabilities?.tools || !initializeBody.result?.capabilities?.resources) throw new Error('mcp_initialize_contract_failed');
  const ready = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' }); if (ready.status !== 202 || (await ready.text()) !== '') throw new Error('mcp_initialized_notification_failed');
  const ping = await mcp({ jsonrpc: '2.0', id: 2, method: 'ping' }); if (!ping.ok || JSON.stringify((await ping.json()).result) !== '{}') throw new Error('mcp_ping_failed');
  const resourceList = await mcp({ jsonrpc: '2.0', id: 3, method: 'resources/list' }); const resourceBody = await resourceList.json(); if (resourceBody.result?.resources?.[0]?.uri !== 'ui://widget/randomware.html') throw new Error('mcp_resource_list_failed');
  const resourceRead = await mcp({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'ui://widget/randomware.html' } }); const resourceReadBody = await resourceRead.json(); const content = resourceReadBody.result?.contents?.[0]; if (content?.mimeType !== 'text/html;profile=mcp-app' || !content?._meta?.ui?.csp?.frameDomains?.includes(base) || !content.text.includes(base) || content.text.includes('window.location.origin') || content.text.includes('new URL(run.statusUrl') || !content.text.includes('id="creation-frame"') || !content.text.includes('/c/') || !content.text.includes('openExternal({href') || !content.text.includes('structuredContent') || !content.text.includes('openai:set_globals') || !content.text.includes('The build needs one bounded repair') || !content.text.includes('sendFollowUpMessage') || !content.text.includes('id="build-prompt"') || !content.text.includes('id="resume-timer"') || !content.text.includes('Follow-up unavailable') || !content.text.includes('statusUrl') || !content.text.includes('setInterval') || !content.text.includes('status polling unavailable') || !content.text.includes('id="steps"') || !content.text.includes('id="heartbeat"') || !content.text.includes('is-flashing') || !content.text.includes('🐕') || !content.text.includes('READ THE AUTOPSY') || !content.text.includes('RANDOMWARE.EXE — API SLOT DIVISION') || !content.text.includes('STYLE CARTRIDGE:') || !content.text.includes('AUTO-NUDGE AT')) throw new Error('mcp_resource_read_failed');
  const tools = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/list' });
  const toolsBody = await tools.json(); if (toolsBody.result?.tools?.length !== 8) throw new Error('mcp_tool_count_failed');
  const open = toolsBody.result.tools.find((tool) => tool.name === 'open_randomware'); if (open?._meta?.ui?.resourceUri !== 'ui://widget/randomware.html' || open?._meta?.['openai/outputTemplate'] !== 'ui://widget/randomware.html') throw new Error('mcp_render_tool_metadata_failed');
  const annotations = Object.fromEntries(toolsBody.result.tools.map((tool) => [tool.name, tool.annotations]));
  for (const name of ['open_randomware', 'spin_apis', 'get_run', 'mutate_creation', 'record_choreography_failure']) if (annotations[name]?.openWorldHint !== false) throw new Error(`mcp_${name}_annotation_failed`);
  for (const name of ['submit_concept', 'submit_artifact', 'submit_repair']) if (annotations[name]?.openWorldHint !== true) throw new Error(`mcp_${name}_annotation_failed`);
  const synthetic = await runSynthetic(base);
  if (!synthetic.styleEnumRejected) throw new Error('synthetic_style_enum_negative_missing');
  const commonsAudioSeed = process.env.RANDOMWARE_DEPLOYED_AUDIO_SEED || 'commons-prod-45';
  const browserRun = spawnSync(process.env.PYTHON || 'python3', [path.join(__dirname, 'browser-acceptance.py')], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, RANDOMWARE_BROWSER_BASE: base, RANDOMWARE_BROWSER_REQUIRE_AUDIO: process.env.RANDOMWARE_BROWSER_REQUIRE_AUDIO ?? '1', RANDOMWARE_BROWSER_AUDIO_API: 'wikimedia-commons-audio', RANDOMWARE_BROWSER_AUDIO_SEED: commonsAudioSeed }, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (browserRun.status !== 0) throw new Error(`deployed_browser_semantic_failed:${browserRun.stderr || browserRun.stdout}`);
  const browserLine = String(browserRun.stdout || '').trim().split('\n').filter(Boolean).at(-1);
  const browserSemantic = JSON.parse(browserLine); if (browserSemantic.ok !== true || !Array.isArray(browserSemantic.semanticValues) || browserSemantic.semanticValues.some((value) => /undefined|NaN|not loaded/.test(value))) throw new Error(`deployed_browser_semantic_invalid:${browserLine}`);
  const call = async (id, name, args = {}) => {
    const response = await mcp({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
    if (!response.ok) throw new Error(`tool_${name}_status:${response.status}`);
    const body = await response.json(); const result = body.result;
    if (!result || !Array.isArray(result.content) || !result.content.length || result.content.some((block) => block.type !== 'text' || typeof block.text !== 'string' || !block.text.trim()) || !Object.prototype.hasOwnProperty.call(result, 'structuredContent')) throw new Error(`tool_${name}_call_result_shape_failed`);
    const output = result.structuredContent;
    if (output?.statusUrl && (new URL(output.statusUrl).protocol !== 'https:' || new URL(output.statusUrl).origin !== base)) throw new Error(`tool_${name}_status_url_failed:${output.statusUrl}`);
    if (output?.creationUrl && (new URL(output.creationUrl).protocol !== 'https:' || new URL(output.creationUrl).origin !== base)) throw new Error(`tool_${name}_creation_url_failed:${output.creationUrl}`);
    if (output?.creationId && ['completed', 'failed'].includes(output.phase) && !output.creationUrl) throw new Error(`tool_${name}_creation_url_missing`);
    return result;
  };
  const conceptFor = (run, label, requestId = `${label}-concept`) => {
    const apiIds = run.selectedApis.map((api) => api.id);
    return {
      runId: run.runId, requestId, styleId: run.styleId, appName: `MCP ${label}`, premise: `A bounded collision turns ${label} signals into one theatrical instrument.`, playerAction: `Press the single control to make the ${label} instrument reveal its next state.`, apiIds,
      runContract: run.runContract, promptVersion: run.promptVersion,
      causalChain: run.selectedApis.map((api, index) => ({ order: index + 1, apiId: api.id, action: `turn ${api.name} into the next ${label} rule` })),
      apiRoles: run.selectedApis.map((api) => ({ apiId: api.id, essentialRole: `${api.name} supplies an essential ${label} signal.`, operations: api.operations.map((operation) => operation.id) })),
      dependency: { fromApiId: apiIds[0], to: 'rules', ...(apiIds[1] ? { toApiId: apiIds[1] } : {}), explanation: `The first ${label} signal determines how the next one is interpreted.` },
      interaction: { controls: ['reveal'], outcome: `The ${label} instrument reveals a changing result.` },
      visualDirection: { style: 'maximalist collision theatre', palette: 'saffron, ink, and cyan', typography: 'oversized editorial serif', motion: 'cards sweep like instruments' },
      bannedShapeAssessment: { plainDashboard: false, plainSearch: false, plainQuiz: false, randomFactDisplay: false, thinClone: false, plausibleStartupPitch: false, explanation: 'This is a staged collision, not a startup pitch.' },
      noveltyDelta: `The ${label} collision changes the interaction rules.`
    };
  };
  const artifactFor = (run, label, requestId, html = createArtifact({ appName: `MCP ${label}`, selected: run.selectedApis.map((api) => ({ apiId: api.id, operationId: api.operations[0].id })) })) => ({ runId: run.runId, requestId, runContract: run.runContract, conceptId: run.conceptId || `${label}-concept`, promptVersion: run.promptVersion, html, declaredApiUses: run.selectedApis.map((api) => ({ apiId: api.id, operations: api.operations.map((operation) => operation.id) })) });
  const testTag = `${Date.now()}-${randomUUID()}`;
  const mounted = await call(6, 'open_randomware'); if (mounted.structuredContent?.ok !== true) throw new Error('open_randomware_result_failed');
  const spun = await call(7, 'spin_apis', { seed: 'randomware-broker-e2e', requestId: `${testTag}-spin-1` }); const run = spun.structuredContent; if (!run?.runId || !run.selectedApis?.length) throw new Error('spin_apis_result_failed');
  const recovered = await call(8, 'get_run', { runId: run.runId }); if (recovered.structuredContent?.runId !== run.runId) throw new Error('get_run_result_failed');
  const concept = await call(9, 'submit_concept', conceptFor(run, 'primary', `${testTag}-primary-concept`)); if (concept.structuredContent?.phase !== 'concept_accepted') throw new Error('submit_concept_result_failed');
  const artifact = await call(10, 'submit_artifact', artifactFor(run, 'primary', `${testTag}-artifact`)); if (artifact.structuredContent?.phase !== 'completed') throw new Error('submit_artifact_result_failed');
  const creationId = artifact.structuredContent.creationId;
  const widgetOrigin = 'https://web-sandbox.oaiusercontent.com';
  const statusUrl = new URL(artifact.structuredContent.statusUrl, base);
  const crossOriginStatus = await fetch(statusUrl, { headers: { Origin: widgetOrigin } });
  if (!crossOriginStatus.ok || crossOriginStatus.headers.get('access-control-allow-origin') !== '*' || (await crossOriginStatus.json()).runId !== run.runId) throw new Error(`run_status_cors_failed:${crossOriginStatus.status}`);
  const statusPreflight = await fetch(statusUrl, { method: 'OPTIONS', headers: { Origin: widgetOrigin, 'Access-Control-Request-Method': 'GET' } });
  if (statusPreflight.status !== 204 || statusPreflight.headers.get('access-control-allow-origin') !== '*' || !(statusPreflight.headers.get('access-control-allow-methods') || '').includes('GET')) throw new Error(`run_status_preflight_failed:${statusPreflight.status}`);
  const creation = await fetch(`${base}/c/${creationId}`); const creationHtml = await creation.text(); if (!creation.ok || !creationHtml.includes('sandbox="allow-scripts"') || !creationHtml.includes('href="/creation.css"') || !creationHtml.includes('Randomware showcase') || !creationHtml.includes('See other specimens') || !creationHtml.includes('Spin your own') || !creationHtml.includes('rw-api-symbol') || creationHtml.includes('<style') || creationHtml.includes('<script')) throw new Error('creation_surface_failed');
  const requiredFrameAncestors = ['https://chatgpt.com', 'https://chat.openai.com', 'https://web-sandbox.oaiusercontent.com', 'https://*.web-sandbox.oaiusercontent.com'];
  const creationCsp = creation.headers.get('content-security-policy') || ''; if (!creationCsp.includes("style-src 'self'") || creationCsp.includes('unsafe-inline') || !requiredFrameAncestors.every((ancestor) => creationCsp.includes(ancestor))) throw new Error(`creation_frame_ancestors_failed:${creationCsp}`);
  const creationCss = await fetch(`${base}/creation.css`); const creationCssText = await creationCss.text(); if (!creationCss.ok || !creationCssText.includes('min-height:390px') || !creationCssText.includes('height:min(88vh,1000px)')) throw new Error('creation_css_failed');
  const requestAutopsy = await fetch(`${base}/api/creations/${creationId}/requests`); if (!requestAutopsy.ok || !(await requestAutopsy.text()).includes('Request receipts')) throw new Error('request_autopsy_failed');
  const dataflowAutopsy = await fetch(`${base}/api/creations/${creationId}/dataflow`); if (!dataflowAutopsy.ok || !(await dataflowAutopsy.text()).includes('Dataflow, in order')) throw new Error('dataflow_autopsy_failed');
  const runtime = await fetch(`${base}/run/${creationId}`); const runtimeHtml = await runtime.text(); if (!runtime.ok) throw new Error(`runtime_surface_status:${runtime.status}`);
  const runtimeCsp = runtime.headers.get('content-security-policy') || ''; if (!runtimeCsp.includes(`media-src blob: ${base}`)) throw new Error('runtime_media_csp_failed'); if (!requiredFrameAncestors.every((ancestor) => runtimeCsp.includes(ancestor))) throw new Error(`runtime_frame_ancestors_failed:${runtimeCsp}`);
  const tokenLiteral = runtimeHtml.match(/capability:("(?:\\.|[^"])*")/); if (!tokenLiteral) throw new Error('runtime_capability_missing');
  const capability = JSON.parse(tokenLiteral[1]); const selectedApi = run.selectedApis[0]; const selectedOperation = selectedApi?.operations?.[0]; if (!selectedApi || !selectedOperation) throw new Error('runtime_selection_missing');
  const requestsBeforeResponse = await fetch(`${base}/api/creations/${creationId}/requests?format=raw`); if (!requestsBeforeResponse.ok) throw new Error('runtime_requests_before_failed'); const requestsBefore = await requestsBeforeResponse.json();
  const preflight = await fetch(`${base}/api/runtime/call`, { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  if (preflight.status !== 204 || preflight.headers.get('access-control-allow-origin') !== 'null' || !(preflight.headers.get('access-control-allow-methods') || '').includes('POST')) throw new Error(`runtime_preflight_failed:${preflight.status}`);
  const mediated = await fetch(`${base}/api/runtime/call`, { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/json' }, body: JSON.stringify({ creationId, revision: 1, apiId: selectedApi.id, operationId: selectedOperation.id, params: {}, capability }) });
  if (!mediated.ok) throw new Error(`runtime_broker_status:${mediated.status}:${await mediated.text()}`);
  const mediatedBody = await mediated.json(); if (mediatedBody.ok !== true) throw new Error('runtime_broker_result_failed');
  const requestsAfterResponse = await fetch(`${base}/api/creations/${creationId}/requests?format=raw`); if (!requestsAfterResponse.ok) throw new Error('runtime_requests_after_failed'); const requestsAfter = await requestsAfterResponse.json(); const latestRequest = requestsAfter[requestsAfter.length - 1];
  if (requestsAfter.length <= requestsBefore.length || latestRequest?.status !== 'ok' || latestRequest.apiId !== selectedApi.id || latestRequest.operationId !== selectedOperation.id) throw new Error('runtime_request_row_failed');
  const mediaSeed = commonsAudioSeed;
  const mediaRun = (await call('18', 'spin_apis', { seed: mediaSeed, requestId: `${testTag}-media-spin` })).structuredContent;
  if (!mediaRun.selectedApis.some((api) => api.id === 'wikimedia-commons-audio') || mediaRun.selectedApis.some((api) => api.id === 'librivox')) throw new Error('commons_audio_selection_failed');
  const audioApis = mediaRun.selectedApis.filter((api) => api.id === 'wikimedia-commons-audio');
  await call(19, 'submit_concept', conceptFor(mediaRun, 'audio', `${testTag}-audio-concept`)); const mediaArtifact = await call(20, 'submit_artifact', artifactFor(mediaRun, 'audio', `${testTag}-audio-artifact`)); if (mediaArtifact.structuredContent?.phase !== 'completed') throw new Error('audio_artifact_failed');
  const mediaCreationId = mediaArtifact.structuredContent.creationId; const mediaRuntime = await fetch(`${base}/run/${mediaCreationId}`); const mediaRuntimeHtml = await mediaRuntime.text(); const mediaTokenLiteral = mediaRuntimeHtml.match(/capability:("(?:\\.|[^"])*")/); if (!mediaTokenLiteral) throw new Error('audio_capability_missing'); const mediaCapability = JSON.parse(mediaTokenLiteral[1]);
  const mediaRequests = [];
  for (const audioApi of audioApis) {
    const operation = audioApi.operations[0]; const audioCall = await fetch(`${base}/api/runtime/call`, { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/json' }, body: JSON.stringify({ creationId: mediaCreationId, revision: 1, apiId: audioApi.id, operationId: operation.id, params: {}, capability: mediaCapability }) }); if (!audioCall.ok) throw new Error(`audio_broker_status:${audioApi.id}:${audioCall.status}:${await audioCall.text()}`); const audioBody = await audioCall.json(); const signedMedia = audioBody.data?.mediaUrl; if (!signedMedia || new URL(signedMedia).origin !== base || !new URL(signedMedia).pathname.startsWith('/media/')) throw new Error(`audio_signed_url_failed:${audioApi.id}`);
    const mediaOrigin = 'https://web-sandbox.oaiusercontent.com'; const mediaPreflight = await fetch(signedMedia, { method: 'OPTIONS', headers: { Origin: mediaOrigin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'range' } }); if (mediaPreflight.status !== 204 || mediaPreflight.headers.get('access-control-allow-origin') !== '*' || !(mediaPreflight.headers.get('access-control-allow-methods') || '').includes('GET') || !(mediaPreflight.headers.get('access-control-allow-headers') || '').toLowerCase().includes('range')) throw new Error(`audio_cors_preflight_failed:${audioApi.id}:${mediaPreflight.status}`); const mediaResponse = await fetch(signedMedia, { headers: { Origin: mediaOrigin } }); const mediaType = mediaResponse.headers.get('content-type') || ''; if (![200, 206].includes(mediaResponse.status) || mediaResponse.headers.get('access-control-allow-origin') !== '*' || mediaResponse.headers.get('cross-origin-resource-policy') !== 'cross-origin' || !mediaType.startsWith('audio/')) throw new Error(`audio_stream_failed:${audioApi.id}:${mediaResponse.status}:${mediaType}`); const reader = mediaResponse.body?.getReader(); if (!reader) throw new Error(`audio_stream_body_missing:${audioApi.id}`); const firstChunk = await reader.read(); if (firstChunk.done || !firstChunk.value?.byteLength) throw new Error(`audio_stream_empty:${audioApi.id}`); await reader.cancel('browser_reconnect'); const reconnectResponse = await fetch(signedMedia, { headers: { Origin: mediaOrigin, Range: 'bytes=0-4095' } }); const reconnectType = reconnectResponse.headers.get('content-type') || ''; if (![200, 206].includes(reconnectResponse.status) || reconnectResponse.headers.get('access-control-allow-origin') !== '*' || reconnectResponse.headers.get('cross-origin-resource-policy') !== 'cross-origin' || !reconnectType.startsWith('audio/')) throw new Error(`audio_reconnect_failed:${audioApi.id}:${reconnectResponse.status}:${reconnectType}:${await reconnectResponse.text()}`); const reconnectReader = reconnectResponse.body?.getReader(); if (!reconnectReader) throw new Error(`audio_reconnect_body_missing:${audioApi.id}`); const reconnectChunk = await reconnectReader.read(); if (reconnectChunk.done || !reconnectChunk.value?.byteLength) throw new Error(`audio_reconnect_empty:${audioApi.id}`); await reconnectReader.cancel('deployed_gate_complete'); mediaRequests.push({ apiId: audioApi.id, status: mediaResponse.status, reconnectStatus: reconnectResponse.status, contentType: mediaType, reconnectType, cors: mediaResponse.headers.get('access-control-allow-origin'), preflight: mediaPreflight.status, bytes: firstChunk.value.byteLength, reconnectBytes: reconnectChunk.value.byteLength });
  }
  const imagePriority = ['rickandmorty', 'randomuser', 'deck-of-cards', 'themealdb', 'loc-photos'];
  let assetRun; let imageApi;
  for (const [index, seed] of ['asset-rick-all-3', 'asset-rick-current-0', 'asset-stable-librivox-1'].entries()) {
    const candidate = (await call(`21-${index}`, 'spin_apis', { seed, requestId: `${testTag}-asset-spin-${index}` })).structuredContent;
    const selectedImage = imagePriority.map((id) => candidate.selectedApis.find((api) => api.id === id)).find(Boolean);
    if (selectedImage) { assetRun = candidate; imageApi = selectedImage; break; }
  }
  if (!assetRun || !imageApi) throw new Error('asset_selection_failed');
  await call(22, 'submit_concept', conceptFor(assetRun, 'asset', `${testTag}-asset-concept`)); const assetArtifact = await call(23, 'submit_artifact', artifactFor(assetRun, 'asset', `${testTag}-asset-artifact`)); const assetCreationId = assetArtifact.structuredContent.creationId;
  const assetRuntime = await fetch(`${base}/run/${assetCreationId}`); const assetRuntimeHtml = await assetRuntime.text(); const assetTokenLiteral = assetRuntimeHtml.match(/capability:("(?:\\.|[^"])*")/); if (!assetTokenLiteral) throw new Error('asset_capability_missing'); const assetCapability = JSON.parse(assetTokenLiteral[1]);
  const assetCall = await fetch(`${base}/api/runtime/call`, { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/json' }, body: JSON.stringify({ creationId: assetCreationId, revision: 1, apiId: imageApi.id, operationId: imageApi.operations[0].id, params: {}, capability: assetCapability }) }); if (!assetCall.ok) throw new Error(`asset_broker_status:${imageApi.id}:${assetCall.status}:${await assetCall.text()}`); const assetBody = await assetCall.json(); const assetUrls = []; const rawAssetUrls = []; const rawAssetHosts = new Set(['deckofcardsapi.com', 'images.deckofcards.io', 'www.artic.edu', 'images.dog.ceo', 'randomuser.me', 'upload.wikimedia.org', 'images.metmuseum.org', 'static.tvmaze.com', 'rickandmortyapi.com', 'images.openfoodfacts.org', 'www.themealdb.com', 'images-assets.nasa.gov', 'tile.loc.gov']); const visitAssets = (value) => { if (typeof value === 'string') { try { const url = new URL(value); if (url.pathname.startsWith('/api/runtime/asset/')) assetUrls.push(url.href); else if (rawAssetHosts.has(url.hostname) && (/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname) || /\/(?:iiif|images|portraits|uploads\/images|api\/character\/avatar)\//i.test(url.pathname))) rawAssetUrls.push(url.href); } catch {} return; } if (Array.isArray(value)) value.forEach(visitAssets); else if (value && typeof value === 'object') Object.values(value).forEach(visitAssets); }; visitAssets(assetBody.data); const assetUrl = assetUrls[0]; if (!assetUrl || new URL(assetUrl).origin !== base || rawAssetUrls.length) throw new Error(`asset_rewrite_failed:${imageApi.id}:${rawAssetUrls.join(',')}`);
  const assetResponse = await fetch(assetUrl); const assetType = assetResponse.headers.get('content-type') || ''; if (!assetResponse.ok || !assetType.startsWith('image/')) throw new Error(`asset_stream_failed:${assetResponse.status}:${assetType}`); const assetBytes = (await assetResponse.arrayBuffer()).byteLength; if (!assetBytes || assetBytes > 2 * 1024 * 1024) throw new Error(`asset_bytes_failed:${assetBytes}`);
  const download = await fetch(`${base}/api/creations/${creationId}/download`); if (!download.ok || !(download.headers.get('content-disposition') || '').includes('attachment') || download.headers.get('x-content-type-options') !== 'nosniff') throw new Error('keeper_download_failed');
  const spec = await fetch(`${base}/api/creations/${creationId}/spec`); if (!spec.ok || !((await spec.text()).toLowerCase()).includes('causal chain')) throw new Error('keeper_spec_failed');
  const specDownload = await fetch(`${base}/api/creations/${creationId}/spec/download`); if (!specDownload.ok || !(specDownload.headers.get('content-disposition') || '').includes('attachment')) throw new Error('keeper_spec_download_failed');
  const mutation = await call(11, 'mutate_creation', { creationId: artifact.structuredContent.creationId, requestId: `${testTag}-mutation`, premise: 'A different bounded collision premise for the same immutable APIs.' }); if (mutation.structuredContent?.ok !== true) throw new Error('mutate_creation_result_failed');
  const repairSpin = await call(12, 'spin_apis', { seed: `${testTag}-spin-2`, requestId: `${testTag}-spin-2` }); const repairRun = repairSpin.structuredContent;
  await call(13, 'submit_concept', conceptFor(repairRun, 'repair', `${testTag}-repair-concept`));
  const failedArtifact = await call(14, 'submit_artifact', artifactFor(repairRun, 'repair', `${testTag}-failed-artifact`, '<!doctype html><html><body>invalid</body></html>')); if (!failedArtifact.isError) throw new Error('invalid_artifact_should_error');
  const repair = await call(15, 'submit_repair', { ...artifactFor(repairRun, 'repair', `${testTag}-repair-artifact`), failedRevisionId: '1', diagnosticCodes: ['artifact_schema'] }); if (repair.structuredContent?.phase !== 'completed') throw new Error('submit_repair_result_failed');
  const failureSpin = await call(16, 'spin_apis', { seed: `${testTag}-spin-3`, requestId: `${testTag}-spin-3` }); const failure = await call(17, 'record_choreography_failure', { runId: failureSpin.structuredContent.runId, requestId: `${testTag}-failure`, phase: 'concept', code: 'choreography_timeout' }); if (failure.structuredContent?.phase !== 'failed') throw new Error('record_choreography_failure_result_failed');
  const get = await fetch(`${base}/mcp`, { headers: { accept: 'text/event-stream' } }); if (get.status !== 405) throw new Error(`mcp_get_status:${get.status}`);
  const index = await fetch(base); const indexHtml = await index.text(); if (!index.ok || !indexHtml.includes('For judges') || !indexHtml.includes('Real APIs go in. Random apps come out.') || !indexHtml.includes('chatgpt-prerequisites-and-connect') || !indexHtml.includes('hero-machine') || !indexHtml.includes('LIVE SPECIMEN —') || indexHtml.includes('Loading') || /MCP (?:primary|audio|asset|repair)/i.test(indexHtml) || /Synthetic /i.test(indexHtml)) throw new Error('public_index_failed');
  console.log(JSON.stringify({ ok: true, base, registry: healthBody.registry, tools: toolsBody.result.tools.length, toolNamesCovered: 8, toolResultChecks: 10, protocolVersion: initializeBody.result.protocolVersion, widget: content.mimeType, runStatusCors: crossOriginStatus.headers.get('access-control-allow-origin'), runStatusPreflight: statusPreflight.status, brokerPreflightStatus: preflight.status, brokerPostStatus: mediated.status, runtimeRequests: requestsAfter.length, mediaRequests, asset: { apiId: imageApi.id, status: assetResponse.status, contentType: assetType, bytes: assetBytes }, browserSemantic, synthetic }));
})().catch((error) => { console.error(`deployed acceptance failed: ${error.message}`); process.exitCode = 1; });
