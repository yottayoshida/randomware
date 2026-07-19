const { registry, getRegistryEntry } = require('./core/registry');
const { selectApis } = require('./core/selection');
const { validateArtifact } = require('./core/validator');
const { validateConcept } = require('./core/concept');
const { RunStore } = require('./core/store');
const { Broker } = require('./core/broker');
const { CapabilitySigner } = require('./core/capability');
const { deathCertificate } = require('./core/failure');
const { MCP_RESOURCE_URI, initializeResult, widgetResource, resourceSummary, widgetToolMeta, jsonRpcError, callToolResult, toolDescription, conceptAcceptedPrompt, artifactRepairPrompt } = require('./core/mcp');
const { CHATGPT_FRAME_ANCESTORS } = require('./core/csp');
const { specHtml, specText } = require('./core/keeper');
const { fetchMedia, limitedStream, MEDIA_LIMITS } = require('./core/media');
const { fetchAsset, limitedAssetStream, ASSET_LIMITS } = require('./core/asset');
const { toolSchemas, validateToolArguments } = require('./core/tool-contract');
const { companionUrl, runUrls } = require('./core/urls');
const { showcasePage, creationPage, failurePage, requestsPage, dataflowPage, reportPage, retiredRuntimePage, isEarlySpecimen } = require('./core/presentation');

const headers = (contentType = 'application/json; charset=utf-8', extra = {}) => ({ 'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...extra });
const response = (body, status = 200, contentType, extra) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: headers(contentType, extra) });
const runtimeCors = { 'access-control-allow-origin': 'null', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'Origin' };
const publicReadCors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-max-age': '600' };
const mediaReadCors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'range', 'access-control-expose-headers': 'accept-ranges, content-length, content-range, content-type', 'access-control-max-age': '600' };
const seed = () => `${Date.now()}-${crypto.randomUUID()}`;

async function readJson(request) {
  const text = await request.text();
  if (text.length > 60000) throw new Error('payload_too_large');
  return text ? JSON.parse(text) : {};
}

async function readForm(request) {
  const text = await request.text();
  if (text.length > 60000) throw new Error('payload_too_large');
  return Object.fromEntries(new URLSearchParams(text));
}

function summary(run, origin) {
  return { runId: run.id, runContract: run.runContract || `run:${run.id}`, promptVersion: 'concept-v1', conceptId: run.concept?.requestId || null, ...runUrls(run, origin), phase: run.phase, choreography: run.choreography || null, createdAt: run.createdAt, creationId: run.creationId, selectedApis: run.selectedApis.map(({ apiId, operationIds }) => { const entry = registry.find((item) => item.id === apiId); return { id: apiId, name: entry.name, category: entry.category, capability: entry.capability, operations: entry.operations.filter((op) => operationIds.includes(op.id)) }; }), concept: run.concept, conceptHistory: run.conceptHistory || [], failure: run.failure, revisions: run.revisions.map(({ revision, bytes, sha256, status, at }) => ({ revision, bytes, sha256, status, at })), events: run.events, repairCount: run.repairCount };
}

function simpleOwnerPage(run, revision) {
  const name = String(run.concept?.appName || 'Randomware creation').replace(/[<>&"']/g, '');
  const premise = String(run.concept?.premise || 'A generated collision.').replace(/[<>&"']/g, '');
  const apis = run.selectedApis.map((entry) => `<li>${entry.apiId}</li>`).join('');
  const revisions = run.revisions.map((item) => `<li><a href="/api/creations/${run.creationId}/source?revision=${item.revision}">Revision ${item.revision}</a> · ${item.status} · ${item.bytes || 0} bytes</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/creation.css"><title>${name} — Randomware</title></head><body><main class="rw-shell"><section class="rw-chrome"><p class="rw-kicker">AI-generated experimental app</p><h1>${name}</h1><p>${premise}</p><p><strong>Do not enter real personal, payment, authentication, or secret data.</strong></p><p>Selected APIs:</p><ul>${apis}</ul><div class="rw-actions"><a href="/api/creations/${run.creationId}/download">Download HTML</a><a href="/api/creations/${run.creationId}/spec">Keeper spec</a><a href="/api/creations/${run.creationId}/spec/download">Download spec</a><a href="/api/creations/${run.creationId}/requests">Inspect requests</a><a href="/api/creations/${run.creationId}/dataflow">Inspect dataflow</a><a href="/api/creations/${run.creationId}/report">Report/remove</a></div><p class="rw-kicker">Source revisions</p><ul>${revisions}</ul></section><iframe class="rw-frame" title="Generated app" sandbox="allow-scripts" credentialless referrerpolicy="no-referrer" src="/run/${run.creationId}"></iframe><footer>Specimen ${run.creationId} · accepted revision ${revision.revision}</footer></main></body></html>`;
}

function failure(run) {
  const certificate = deathCertificate(run.failure?.code || 'capacity_reached', { detail: run.failure?.detail, specimenId: run.creationId, revisions: run.revisions });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Failed Creation</title></head><body><main><p>AI-generated experimental app</p><h1>Failed Creation</h1><p>Cause: <code>${certificate.code}</code></p><p>${certificate.detail}</p><p>${certificate.epitaph}</p><p>Specimen ${run.creationId}</p></main></body></html>`;
}

function tools() {
  const base = (name, properties, required = []) => ({ name, description: toolDescription(name), inputSchema: { type: 'object', properties, required }, annotations: { readOnlyHint: ['open_randomware', 'get_run'].includes(name), openWorldHint: !['open_randomware', 'spin_apis', 'get_run', 'mutate_creation', 'record_choreography_failure'].includes(name), destructiveHint: false } });
  const schema = (name) => ({ ...base(name, toolSchemas[name].properties, toolSchemas[name].required), inputSchema: toolSchemas[name] });
  return [
    { ...schema('open_randomware'), _meta: widgetToolMeta() },
    schema('spin_apis'),
    schema('submit_concept'),
    schema('submit_artifact'),
    schema('submit_repair'),
    schema('get_run'),
    schema('mutate_creation'),
    schema('record_choreography_failure')
  ];
}

function createWebHandler({ store = new RunStore(), broker = new Broker({ fixtureMode: false }), signer = new CapabilitySigner('worker-development-secret'), assets } = {}) {
  const callStore = (method, ...args) => Promise.resolve(store[method](...args));
  const unhealthy = async () => typeof store.unhealthyIds === 'function' ? callStore('unhealthyIds') : new Set();
  return async function handle(request, env = {}, ctx) {
    const url = new URL(request.url);
    const summarize = (run) => summary(run, url.origin);
    try {
      if (request.method === 'GET' && url.pathname === '/healthz') return response({ ok: true, service: 'randomware', registry: registry.length });
      if (request.method === 'GET' && url.pathname === '/api/registry') return response(registry.map(({ id, name, symbol, category, capability, docsUrl, attribution }) => ({ id, name, symbol, category, capability, docsUrl, attribution })));
      if (request.method === 'GET' && url.pathname === '/api/tools') return response(tools());
      if (request.method === 'GET' && url.pathname === '/api/creations/recent') return response((await callStore('listCreations')).filter((run) => run.listed !== false && !run.unpublished && ['completed', 'failed'].includes(run.phase)).map((run) => ({ creationId: run.creationId, appName: run.concept?.appName, premise: run.concept?.premise, phase: run.phase, selectedApis: run.selectedApis.map((entry) => entry.apiId) })));
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return response(showcasePage(await callStore('listCreations')), 200, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" });
      if (url.pathname === '/mcp' && request.method === 'GET') return new Response(null, { status: 405, headers: headers('text/plain; charset=utf-8', { allow: 'POST' }) });
      if (request.method === 'POST' && url.pathname === '/mcp') {
        const input = await readJson(request);
        if (input.method === 'initialize') return response({ jsonrpc: '2.0', id: input.id, result: initializeResult(input.params) });
        if (input.method === 'notifications/initialized' || input.method === 'notifications/cancelled') return new Response(null, { status: 202, headers: headers('text/plain; charset=utf-8') });
        if (input.method === 'ping') return response({ jsonrpc: '2.0', id: input.id, result: {} });
        if (input.method === 'resources/list') return response({ jsonrpc: '2.0', id: input.id, result: { resources: [resourceSummary(url.origin)] } });
        if (input.method === 'resources/read') { if (input.params?.uri !== MCP_RESOURCE_URI) return response(jsonRpcError(input.id, -32602, 'resource_not_found'), 400); return response({ jsonrpc: '2.0', id: input.id, result: widgetResource(url.origin) }); }
        if (input.method === 'tools/list') return response({ jsonrpc: '2.0', id: input.id, result: { tools: tools() } });
        if (input.method === 'tools/call') { const name = input.params?.name; const contract = validateToolArguments(name, input.params?.arguments || {}); if (!contract.ok) return response({ jsonrpc: '2.0', id: input.id, error: { code: contract.code, message: 'invalid_tool_input', data: { diagnostics: contract.diagnostics } } }, 400); }
        if (input.method === 'tools/call' && input.params?.name === 'open_randomware') return response({ jsonrpc: '2.0', id: input.id, result: callToolResult({ ok: true, registry: registry.length }, 'Randomware slot mounted.') });
        if (input.method === 'tools/call' && input.params?.name === 'spin_apis') { const args = input.params.arguments || {}; const selected = selectApis({ seed: args.seed || seed(), registry, unhealthy: await unhealthy() }); const run = await callStore('createRun', { requestId: args.requestId || seed(), selectedApis: selected.map((entry) => ({ apiId: entry.id, operationIds: entry.operations.map((op) => op.id) })) }); return response({ jsonrpc: '2.0', id: input.id, result: callToolResult(summarize(run), `Selected ${run.selectedApis.length} APIs.`) }); }
        if (input.method === 'tools/call') {
          const name = input.params?.name; const args = input.params?.arguments || {};
          if (name === 'get_run') { await callStore('noteActivity', args.runId); const run = await callStore('getRun', args.runId); return response({ jsonrpc: '2.0', id: input.id, result: callToolResult(summarize(run), `Run ${run.id} is ${run.phase}.`) }); }
          if (name === 'submit_concept') { await callStore('noteActivity', args.runId, Date.now(), ['spinned']); const run = await callStore('getRun', args.runId); const concept = { ...args, apiIds: args.apiIds || run.selectedApis.map((entry) => entry.apiId) }; const check = validateConcept(concept, { selectedApis: run.selectedApis, prior: run.history || [] }); if (!check.ok) return response({ jsonrpc: '2.0', id: input.id, result: callToolResult({ ...summarize(run), ...check }, `Concept rejected: ${check.code}.`, { isError: true }) }); const accepted = await callStore('acceptConcept', args.runId, concept); const summary = summarize(accepted); return response({ jsonrpc: '2.0', id: input.id, result: callToolResult(summary, conceptAcceptedPrompt(args.runId, summary.selectedApis)) }); }
          if (name === 'submit_artifact' || name === 'submit_repair') { await callStore('noteActivity', args.runId, Date.now(), name === 'submit_repair' ? ['repair_requested'] : ['concept_accepted', 'building']); const run = await callStore('getRun', args.runId); const check = validateArtifact(args.html, { selectedApis: run.selectedApis, declaredApiUses: args.declaredApiUses }); if (!check.ok) { const failureArgs = { requestId: args.requestId || seed(), code: check.code, html: args.html, bytes: check.bytes, sha256: check.sha256 }; const failed = name === 'submit_repair' ? await callStore('recordRepairFailure', args.runId, failureArgs) : await callStore('recordArtifactFailure', args.runId, failureArgs); const summary = summarize(failed); return response({ jsonrpc: '2.0', id: input.id, result: callToolResult({ ...summary, ...check, nextTool: name === 'submit_repair' ? 'none' : 'submit_repair' }, artifactRepairPrompt({ runId: args.runId, diagnostics: check.diagnostics, selectedApis: summary.selectedApis }), { isError: true }) }); } const accepted = name === 'submit_repair' ? await callStore('acceptRepair', args.runId, { requestId: args.requestId || seed(), html: args.html, sha256: check.sha256, bytes: check.bytes }) : await callStore('acceptArtifact', args.runId, { requestId: args.requestId || seed(), html: args.html, sha256: check.sha256, bytes: check.bytes }); return response({ jsonrpc: '2.0', id: input.id, result: callToolResult(summarize(accepted), `${name === 'submit_repair' ? 'Repair' : 'Artifact'} accepted.`) }); }
          if (name === 'mutate_creation') { const run = await callStore('findByCreation', args.creationId); const result = { ok: true, creationId: run.creationId, creationUrl: companionUrl(url.origin, `/c/${encodeURIComponent(run.creationId)}`), apiIds: run.selectedApis.map((entry) => entry.apiId), premise: args.premise, note: 'mutation preserves the immutable selected API set' }; return response({ jsonrpc: '2.0', id: input.id, result: callToolResult(result, `Mutation recorded for ${run.creationId}.`) }); }
          if (name === 'record_choreography_failure') { const failed = await callStore('fail', args.runId, args.code || 'choreography_timeout', args.phase); return response({ jsonrpc: '2.0', id: input.id, result: callToolResult(summarize(failed), `Failure recorded for ${args.runId}.`) }); }
        }
        return response({ jsonrpc: '2.0', id: input.id, error: { code: -32601, message: 'method_not_supported' } }, 400);
      }
      const assetMatch = url.pathname.match(/^\/api\/runtime\/asset\/([^/]+)$/);
      if (assetMatch && request.method === 'GET') {
        const assetToken = signer.verifyAsset(decodeURIComponent(assetMatch[1])); const stored = await callStore('getAssetToken', assetToken.tokenId);
        if (stored.pageId !== assetToken.pageId || stored.resolvedUrl !== assetToken.resolvedUrl || stored.creationId !== assetToken.creationId || stored.revision !== assetToken.revision || stored.apiId !== assetToken.apiId || stored.operationId !== assetToken.operationId) throw new Error('asset_capability_invalid');
        const entry = getRegistryEntry(stored.apiId); const upstream = await fetchAsset({ target: stored.resolvedUrl, policy: entry.assetPolicy, fetcher: broker.fetcher || globalThis.fetch });
        const reservation = upstream.contentLength == null ? ASSET_LIMITS.bytesEach : upstream.contentLength; await callStore('reserveAsset', assetToken.tokenId, reservation);
        const stream = limitedAssetStream(upstream.response.body, Math.min(assetToken.maxBytes, ASSET_LIMITS.bytesEach), (bytes) => callStore('finishAsset', assetToken.tokenId, bytes));
        const extra = { 'cache-control': 'private, no-store', 'content-disposition': 'inline', 'cross-origin-resource-policy': 'cross-origin', 'content-security-policy': "default-src 'none'; sandbox" };
        if (upstream.contentLength != null) extra['content-length'] = String(upstream.contentLength);
        return new Response(stream, { status: 200, headers: headers(upstream.contentType, extra) });
      }
      const mediaMatch = url.pathname.match(/^\/media\/([^/]+)$/);
      if (mediaMatch && request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers('text/plain; charset=utf-8', mediaReadCors) });
      if (mediaMatch && request.method === 'GET') {
        const mediaToken = signer.verifyMedia(decodeURIComponent(mediaMatch[1]));
        const stored = await callStore('getMediaToken', mediaToken.tokenId);
        if (stored.resolvedUrl !== mediaToken.resolvedUrl || stored.creationId !== mediaToken.creationId || stored.revision !== mediaToken.revision) throw new Error('media_capability_invalid');
        const started = await callStore('startMediaStream', mediaToken.tokenId);
        let cleanupTask;
        const cleanup = (bytes = 0) => {
          if (!cleanupTask) {
            cleanupTask = Promise.resolve(callStore('finishMediaStream', mediaToken.tokenId, bytes, started.streamLease));
            if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(cleanupTask);
          }
          return cleanupTask;
        };
        let upstream;
        try {
          upstream = await fetchMedia({ target: stored.resolvedUrl, request, fetcher: broker.fetcher || globalThis.fetch, kind: mediaToken.apiId === 'librivox' ? 'librivox' : 'radio-browser' });
        } catch (error) {
          await cleanup();
          throw error;
        }
        const remaining = Math.min(mediaToken.maxBytes, MEDIA_LIMITS.bytesPerPage) - (started.bytesServed || 0);
        const stream = limitedStream(upstream.response.body, remaining, cleanup, { signal: request.signal });
        const passHeaders = {};
        for (const name of ['content-range', 'accept-ranges', 'etag', 'last-modified']) { const value = upstream.response.headers.get(name); if (value) passHeaders[name] = value; }
        const length = Number(upstream.response.headers.get('content-length')); if (Number.isFinite(length) && length <= remaining) passHeaders['content-length'] = String(length);
        return new Response(stream, { status: upstream.response.status, headers: headers(upstream.contentType, { ...passHeaders, ...mediaReadCors, 'cache-control': 'no-store', 'content-disposition': 'inline', 'cross-origin-resource-policy': 'cross-origin' }) });
      }
      if (url.pathname === '/api/runtime/call') {
        const origin = request.headers.get('origin');
        if (origin && origin !== 'null') throw new Error('origin_not_allowed');
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers('text/plain; charset=utf-8', runtimeCors) });
        if (request.method === 'POST') {
          const input = await readJson(request); const run = await callStore('findByCreation', input.creationId); if (run.unpublished) throw new Error('creation_unpublished'); const capability = signer.verify(input.capability, { creationId: input.creationId, revision: input.revision, apiId: input.apiId, operationId: input.operationId }); await callStore('assertRuntimeQuota', run.id, capability.quotas); const result = await broker.call({ selectedApis: run.selectedApis, apiId: input.apiId, operationId: input.operationId, params: input.params || {}, onRetry: (retry) => callStore('logRuntime', run.id, { ...retry, bytes: 0, cacheHit: false }), media: { origin: url.origin, runId: run.id, creationId: run.creationId, revision: input.revision, capability, tokenSigner: signer, mediaStore: store } }); await callStore('logRuntime', run.id, { apiId: input.apiId, operationId: input.operationId, status: 'ok', bytes: result.bytes, cacheHit: result.cached }); return response(result, 200, 'application/json; charset=utf-8', runtimeCors);
        }
      }
      if (request.method === 'POST' && url.pathname === '/api/spin') { const input = await readJson(request); const selected = selectApis({ seed: input.seed || seed(), registry, history: input.history || [], unhealthy: await unhealthy() }); const run = await callStore('createRun', { requestId: input.requestId || seed(), selectedApis: selected.map((entry) => ({ apiId: entry.id, operationIds: entry.operations.map((op) => op.id) })), history: input.history || [] }); return response({ ...summarize(run), disclosure: 'Building publishes this experimental AI-generated app at a public URL.' }); }
      const reroll = url.pathname.match(/^\/api\/runs\/([^/]+)\/reroll$/); if (reroll && request.method === 'POST') { await callStore('noteActivity', reroll[1]); return response(summarize(await callStore('rerollConcept', reroll[1], await readJson(request)))); }
      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(concept|artifact|repair))?$/);
      if (runMatch) {
        const runId = runMatch[1]; const action = runMatch[2];
        if (request.method === 'OPTIONS' && !action) return new Response(null, { status: 204, headers: headers('text/plain; charset=utf-8', publicReadCors) });
        if (request.method === 'GET' && !action) return response(summarize(await callStore('getRun', runId)), 200, undefined, publicReadCors);
        if (request.method === 'POST' && action === 'concept') { const input = await readJson(request); await callStore('noteActivity', runId, Date.now(), ['spinned']); const run = await callStore('getRun', runId); const concept = { ...input, apiIds: input.apiIds || run.selectedApis.map((entry) => entry.apiId) }; const check = validateConcept(concept, { selectedApis: run.selectedApis, prior: run.history || [] }); if (!check.ok) return response({ ...check, ...summarize(await callStore('getRun', runId)) }, 422); return response(summarize(await callStore('acceptConcept', runId, concept))); }
        if (request.method === 'POST' && (action === 'artifact' || action === 'repair')) { const input = await readJson(request); await callStore('noteActivity', runId, Date.now(), action === 'repair' ? ['repair_requested'] : ['concept_accepted', 'building']); const run = await callStore('getRun', runId); const check = validateArtifact(input.html, { selectedApis: run.selectedApis, declaredApiUses: input.declaredApiUses }); if (!check.ok) { const failureArgs = { requestId: input.requestId || seed(), code: check.code, html: input.html, bytes: check.bytes, sha256: check.sha256 }; const failed = action === 'repair' ? await callStore('recordRepairFailure', runId, failureArgs) : await callStore('recordArtifactFailure', runId, failureArgs); return response({ ...check, ...summarize(failed), nextTool: action === 'repair' ? 'none' : 'submit_repair' }, 422); } const accepted = action === 'repair' ? await callStore('acceptRepair', runId, { requestId: input.requestId || seed(), html: input.html, sha256: check.sha256, bytes: check.bytes }) : await callStore('acceptArtifact', runId, { requestId: input.requestId || seed(), html: input.html, sha256: check.sha256, bytes: check.bytes }); return response({ ok: true, creationId: accepted.creationId, ...summarize(accepted) }); }
      }
      const creation = url.pathname.match(/^\/(c|run)\/([^/]+)$/); if (creation && request.method === 'GET') { const run = await callStore('findByCreation', creation[2]); if (run.unpublished) return response('<h1>Creation removed</h1>', 200, 'text/html; charset=utf-8'); const revision = [...run.revisions].reverse().find((item) => item.status === 'accepted'); if (!revision) return response(failurePage(run), 200, 'text/html; charset=utf-8', { 'content-security-policy': `default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors ${CHATGPT_FRAME_ANCESTORS.join(' ')}` }); if (creation[1] === 'c') return response(creationPage(run, revision), 200, 'text/html; charset=utf-8', { 'content-security-policy': `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${CHATGPT_FRAME_ANCESTORS.join(' ')}` }); if (isEarlySpecimen(run)) return response(retiredRuntimePage(run), 200, 'text/html; charset=utf-8', { 'content-security-policy': `default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors ${url.origin} ${CHATGPT_FRAME_ANCESTORS.join(' ')}` }); await callStore('setCapabilityExpiry', run.id, Date.now() + 600000); const token = signer.issue({ creationId: run.creationId, revision: revision.revision, selected: run.selectedApis.flatMap((entry) => entry.operationIds.map((operationId) => ({ apiId: entry.apiId, operationId }))) }); const harness = `<script>window.randomware=Object.freeze({call:async(a,o,p)=>{const r=await fetch('/api/runtime/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({creationId:${JSON.stringify(run.creationId)},revision:${revision.revision},apiId:a,operationId:o,params:p,capability:${JSON.stringify(token)}})});if(!r.ok)throw new Error('broker_failure');return r.json()},ready:()=>parent.postMessage({channel:'randomware',type:'ready'},'*')});</script>`; return response(`${harness}${revision.html}`, 200, 'text/html; charset=utf-8', { 'content-security-policy': `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: 'self'; media-src blob: ${url.origin}; connect-src 'self'; font-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${url.origin} ${CHATGPT_FRAME_ANCESTORS.join(' ')}`, 'access-control-allow-origin': 'null' }); }
      const keeper = url.pathname.match(/^\/api\/creations\/([^/]+)\/(download|spec|spec\/download)$/); if (keeper && request.method === 'GET') { const run = await callStore('findByCreation', keeper[1]); if (run.unpublished) return response('<h1>Creation removed</h1>', 200, 'text/html; charset=utf-8'); if (keeper[2] === 'download') { const accepted = [...run.revisions].reverse().find((item) => item.status === 'accepted'); if (!accepted) return response(failure(run), 409); return response(accepted.html, 200, 'text/html; charset=utf-8', { 'content-disposition': `attachment; filename="randomware-${run.creationId}.html"`, 'x-content-type-options': 'nosniff' }); } if (keeper[2] === 'spec/download') return response(specText(run), 200, 'text/plain; charset=utf-8', { 'content-disposition': `attachment; filename="randomware-${run.creationId}-spec.txt"` }); return response(specHtml(run), 200, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" }); }
      const source = url.pathname.match(/^\/api\/creations\/([^/]+)\/(source|requests|dataflow)$/); if (source && request.method === 'GET') { const run = await callStore('findByCreation', source[1]); if (run.unpublished) return response('<h1>Creation removed</h1>', 200, 'text/html; charset=utf-8'); if (source[2] === 'source') { const requested = Number(url.searchParams.get('revision')); const revision = Number.isInteger(requested) && requested > 0 ? run.revisions.find((item) => item.revision === requested) : [...run.revisions].reverse()[0]; return response(revision?.html || '', 200, 'text/plain; charset=utf-8'); } const raw = url.searchParams.get('format') === 'raw'; if (source[2] === 'requests') return raw ? response(run.runtimeRequests || []) : response(requestsPage(run), 200, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'" }); const flow = await callStore('dataflow', run.id); return raw ? response(flow) : response(dataflowPage(run, flow), 200, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'" }); }
      const moderation = url.pathname.match(/^\/api\/creations\/([^/]+)\/(report|unpublish)$/); if (moderation) { const run = await callStore('findByCreation', moderation[1]); if (run.unpublished) return response('<h1>Creation removed</h1>', 200, 'text/html; charset=utf-8'); if (moderation[2] === 'report' && request.method === 'GET') return response(reportPage(run), 200, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" }); if (moderation[2] === 'report' && request.method === 'POST') { const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded'); const input = isForm ? await readForm(request) : await readJson(request); await callStore('reportCreation', run.creationId, input.reason || 'unspecified'); return isForm ? response(reportPage(run, true), 200, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'" }) : response({ ok: true, status: 'hidden' }); } if (moderation[2] === 'unpublish' && request.method === 'POST') { const expected = env.RANDOMWARE_OWNER_TOKEN || 'local-owner-token'; if (request.headers.get('authorization') !== `Bearer ${expected}`) throw new Error('owner_auth_required'); await callStore('unpublishCreation', run.creationId); return response({ ok: true, status: 'unpublished' }); } }
      if (assets && url.pathname.startsWith('/')) return assets.fetch(request);
      return response({ ok: false, code: 'not_found' }, 404);
    } catch (error) { return response({ ok: false, code: error.message }, error.message === 'run_not_found' || error.message === 'creation_not_found' ? 404 : 400); }
  };
}

module.exports = { createWebHandler, tools, summary };
