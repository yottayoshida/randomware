const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { registry, getRegistryEntry } = require('./core/registry');
const { selectApis, selectStyle } = require('./core/selection');
const { getStyle } = require('./core/style-deck');
const { validateArtifact } = require('./core/validator');
const { RunStore, phases } = require('./core/store');
const { Broker } = require('./core/broker');
const { CapabilitySigner } = require('./core/capability');
const { validateConcept } = require('./core/concept');
const { escapeHtml } = require('./core/artifact');
const { deathCertificate } = require('./core/failure');
const { MCP_RESOURCE_URI, initializeResult, widgetResource, resourceSummary, widgetToolMeta, jsonRpcError, callToolResult, toolDescription, conceptAcceptedPrompt, artifactRepairPrompt, acceptedArtifactToolText } = require('./core/mcp');
const { CHATGPT_FRAME_ANCESTORS } = require('./core/csp');
const { specHtml, specText } = require('./core/keeper');
const { fetchMedia, limitedStream, MEDIA_LIMITS } = require('./core/media');
const { fetchAsset, limitedAssetStream, ASSET_LIMITS } = require('./core/asset');
const { toolSchemas, validateToolArguments } = require('./core/tool-contract');
const { companionUrl, runUrls } = require('./core/urls');
const { fixtureMediaFetcher } = require('./core/fixture-media');
const { showcasePage, creationPage, failurePage: companionFailurePage, requestsPage, dataflowPage, reportPage, retiredRuntimePage, isEarlySpecimen } = require('./core/presentation');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(payload);
}

const runtimeCors = { 'access-control-allow-origin': 'null', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'Origin' };
const publicReadCors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-max-age': '600' };
const mediaReadCors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'range', 'access-control-expose-headers': 'accept-ranges, content-length, content-range, content-type', 'access-control-max-age': '600' };

function text(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(body);
}

async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 60000) throw new Error('payload_too_large'); chunks.push(chunk); }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function formBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 60000) throw new Error('payload_too_large'); chunks.push(chunk); }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

function runSummary(run, origin) {
  return {
    runId: run.id, runContract: run.runContract || `run:${run.id}`, promptVersion: 'concept-v1', conceptId: run.concept?.requestId || null, ...runUrls(run, origin), phase: run.phase, choreography: run.choreography || null, createdAt: run.createdAt, creationId: run.creationId, styleId: run.styleId || null, style: run.styleId ? getStyle(run.styleId) : null, selectedApis: run.selectedApis.map(({ apiId, operationIds }) => { const entry = registry.find((item) => item.id === apiId); return { id: apiId, name: entry.name, category: entry.category, capability: entry.capability, operations: entry.operations.filter((op) => operationIds.includes(op.id)) }; }),
    concept: run.concept, conceptHistory: run.conceptHistory || [], failure: run.failure, revisions: run.revisions.map(({ revision, bytes, sha256, status, at }) => ({ revision, bytes, sha256, status, at })), events: run.events, repairCount: run.repairCount
  };
}

function securityHeaders(csp) {
  return { 'content-security-policy': csp, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'cross-origin-resource-policy': 'same-site' };
}

function createMcpTools(app) {
  const schema = (name) => ({ name, description: toolDescription(name), inputSchema: toolSchemas[name], annotations: { readOnlyHint: ['open_randomware', 'get_run'].includes(name), openWorldHint: !['open_randomware', 'spin_apis', 'get_run', 'mutate_creation', 'record_choreography_failure'].includes(name), destructiveHint: false } });
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

function createServer({ fixtureMode = false, store = new RunStore(), broker = new Broker({ fixtureMode }), signer = new CapabilitySigner(process.env.RANDOMWARE_SIGNING_SECRET || 'local-development-secret') } = {}) {
  const app = { store, broker, signer };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'randomware', registry: registry.length });
      if (req.method === 'GET' && url.pathname === '/api/registry') return json(res, 200, registry.map(({ id, name, symbol, category, capability, docsUrl, attribution, selectionEnabled }) => ({ id, name, symbol, category, capability, docsUrl, attribution, selectionEnabled })));
      if (req.method === 'GET' && url.pathname === '/api/tools') return json(res, 200, createMcpTools(app));
      if (req.method === 'GET' && url.pathname === '/api/creations/recent') return json(res, 200, store.listCreations().filter((run) => run.listed !== false && !run.unpublished && ['completed', 'failed'].includes(run.phase)).map((run) => ({ creationId: run.creationId, appName: run.concept?.appName, premise: run.concept?.premise, phase: run.phase, selectedApis: run.selectedApis.map((entry) => entry.apiId) })));
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return text(res, 200, showcasePage(store.listCreations()), { ...securityHeaders("default-src 'none'; style-src 'self'; img-src 'self' data:; frame-src 'self'; base-uri 'none'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
      if (url.pathname === '/mcp' && req.method === 'GET') { res.writeHead(405, { allow: 'POST' }); return res.end(); }
      if (req.method === 'POST' && url.pathname === '/mcp') return handleMcp(req, res, app);
      const assetMatch = url.pathname.match(/^\/api\/runtime\/asset\/([^/]+)$/);
      if (assetMatch && req.method === 'GET') {
        const assetToken = signer.verifyAsset(decodeURIComponent(assetMatch[1])); const stored = store.getAssetToken(assetToken.tokenId);
        if (stored.pageId !== assetToken.pageId || stored.resolvedUrl !== assetToken.resolvedUrl || stored.creationId !== assetToken.creationId || stored.revision !== assetToken.revision || stored.apiId !== assetToken.apiId || stored.operationId !== assetToken.operationId) throw new Error('asset_capability_invalid');
        const upstream = await fetchAsset({ target: stored.resolvedUrl, policy: getRegistryEntry(stored.apiId).assetPolicy, fetcher: broker.fetcher || globalThis.fetch }); const reservation = upstream.contentLength == null ? ASSET_LIMITS.bytesEach : upstream.contentLength; store.reserveAsset(assetToken.tokenId, reservation);
        const stream = limitedAssetStream(upstream.response.body, Math.min(assetToken.maxBytes, ASSET_LIMITS.bytesEach), (bytes) => store.finishAsset(assetToken.tokenId, bytes));
        res.writeHead(200, { 'content-type': upstream.contentType, 'cache-control': 'private, no-store', 'content-disposition': 'inline', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'cross-origin', 'content-security-policy': "default-src 'none'; sandbox", ...(upstream.contentLength == null ? {} : { 'content-length': String(upstream.contentLength) }) });
        const reader = stream.getReader(); try { for (;;) { const next = await reader.read(); if (next.done) break; res.write(Buffer.from(next.value)); } res.end(); } catch { res.destroy(); } return;
      }
      const mediaMatch = url.pathname.match(/^\/media\/([^/]+)$/);
      if (mediaMatch && req.method === 'OPTIONS') { res.writeHead(204, mediaReadCors); return res.end(); }
      if (mediaMatch && req.method === 'GET') {
        const mediaToken = signer.verifyMedia(decodeURIComponent(mediaMatch[1]));
        const stored = store.getMediaToken(mediaToken.tokenId);
        if (stored.resolvedUrl !== mediaToken.resolvedUrl || stored.creationId !== mediaToken.creationId || stored.revision !== mediaToken.revision) throw new Error('media_capability_invalid');
        const started = store.startMediaStream(mediaToken.tokenId);
        let cleanupTask;
        const cleanup = (bytes = 0) => {
          if (!cleanupTask) cleanupTask = Promise.resolve(store.finishMediaStream(mediaToken.tokenId, bytes, started.streamLease));
          return cleanupTask;
        };
        let upstream;
        try { upstream = await fetchMedia({ target: stored.resolvedUrl, request: new Request(`http://${req.headers.host || 'localhost'}${req.url}`, { method: 'GET', headers: req.headers }), fetcher: broker.fetcher || globalThis.fetch, kind: getRegistryEntry(mediaToken.apiId).mediaPolicy?.kind || 'radio-browser' }); }
        catch (error) { await cleanup(); throw error; }
        const remaining = Math.min(mediaToken.maxBytes, MEDIA_LIMITS.bytesPerPage) - (started.bytesServed || 0);
        const stream = limitedStream(upstream.response.body, remaining, cleanup);
        const passHeaders = {}; for (const name of ['content-range', 'accept-ranges', 'etag', 'last-modified']) { const value = upstream.response.headers.get(name); if (value) passHeaders[name] = value; }
        const length = Number(upstream.response.headers.get('content-length')); if (Number.isFinite(length) && length <= remaining) passHeaders['content-length'] = String(length);
        res.writeHead(upstream.response.status, { 'content-type': upstream.contentType, 'cache-control': 'no-store', 'content-disposition': 'inline', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'cross-origin', ...passHeaders, ...mediaReadCors });
        const reader = stream.getReader();
        const abortPump = () => { void reader.cancel('media_client_aborted'); };
        req.once('aborted', abortPump); res.once('close', abortPump);
        try { for (;;) { const next = await reader.read(); if (next.done) break; res.write(Buffer.from(next.value)); } res.end(); }
        catch { res.destroy(); }
        finally { req.off('aborted', abortPump); res.off('close', abortPump); await cleanup(); }
        return;
      }
      if (url.pathname === '/api/runtime/call') {
        if (req.headers.origin && req.headers.origin !== 'null') throw new Error('origin_not_allowed');
        if (req.method === 'OPTIONS') { res.writeHead(204, runtimeCors); return res.end(); }
        if (req.method === 'POST') {
          const input = await body(req); const run = store.findByCreation(input.creationId); if (run.unpublished) throw new Error('creation_unpublished'); const capability = signer.verify(input.capability, { creationId: input.creationId, revision: input.revision, apiId: input.apiId, operationId: input.operationId }); store.assertRuntimeQuota(run.id, capability.quotas);
          const result = await broker.call({ selectedApis: run.selectedApis, apiId: input.apiId, operationId: input.operationId, params: input.params || {}, onFetch: ({ apiId, dailyBudget }) => store.consumeDailyBudget(`api:${apiId}`, dailyBudget), onRetry: (retry) => store.logRuntime(run.id, { ...retry, bytes: 0, cacheHit: false }), media: { origin: url.origin, runId: run.id, creationId: run.creationId, revision: input.revision, capability, tokenSigner: signer, mediaStore: store } }); store.logRuntime(run.id, { apiId: input.apiId, operationId: input.operationId, status: 'ok', bytes: result.bytes, cacheHit: result.cached }); return json(res, 200, result, runtimeCors);
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/spin') {
        const input = await body(req); const spinSeed = input.seed || cryptoSeed(); const selected = selectApis({ seed: spinSeed, registry, history: input.history || [] }); const style = selectStyle({ seed: spinSeed, history: input.styleHistory || [] });
        const run = store.createRun({ requestId: input.requestId || cryptoSeed(), selectedApis: selected.map((entry) => ({ apiId: entry.id, operationIds: entry.operations.map((op) => op.id) })), history: input.history || [], styleId: style.id, styleHistory: input.styleHistory || [] });
        return json(res, 200, { ...runSummary(run, url.origin), disclosure: 'Building publishes this experimental AI-generated app at a public URL.' });
      }
      const rerollMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/reroll$/);
      if (req.method === 'POST' && rerollMatch) { const input = await body(req); store.noteActivity(rerollMatch[1]); return json(res, 200, runSummary(store.rerollConcept(rerollMatch[1], input), url.origin)); }
      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(concept|artifact|repair))?$/);
      if (runMatch) {
        const runId = runMatch[1]; const action = runMatch[2];
        if (req.method === 'OPTIONS' && !action) { res.writeHead(204, publicReadCors); return res.end(); }
        if (req.method === 'GET' && !action) return json(res, 200, runSummary(store.getRun(runId), url.origin), publicReadCors);
        if (req.method === 'POST' && action === 'concept') {
          const input = await body(req); store.noteActivity(runId); const run = store.getRun(runId); const concept = { ...input, apiIds: input.apiIds || run.selectedApis.map((entry) => entry.apiId) };
          const check = validateConcept(concept, { selectedApis: run.selectedApis, prior: run.history || [], styleId: run.styleId });
          if (!check.ok) return json(res, 422, check);
          const accepted = store.acceptConcept(runId, concept); return json(res, 200, runSummary(accepted, url.origin));
        }
        if (req.method === 'POST' && action === 'artifact') {
          const input = await body(req); store.noteActivity(runId); const run = store.getRun(runId); const result = validateArtifact(input.html, { selectedApis: run.selectedApis, declaredApiUses: input.declaredApiUses });
          if (!result.ok) { const failed = store.recordArtifactFailure(runId, { requestId: input.requestId || cryptoSeed(), code: result.code, html: input.html, bytes: result.bytes, sha256: result.sha256 }); return json(res, 422, { ok: false, code: result.code, diagnostics: result.diagnostics, ...runSummary(failed, url.origin) }); }
          const accepted = store.acceptArtifact(runId, { requestId: input.requestId || cryptoSeed(), html: input.html, sha256: result.sha256, bytes: result.bytes }); return json(res, 200, { ok: true, creationId: accepted.creationId, ...runSummary(accepted, url.origin) });
        }
        if (req.method === 'POST' && action === 'repair') {
          const input = await body(req); store.noteActivity(runId); const run = store.getRun(runId); const result = validateArtifact(input.html, { selectedApis: run.selectedApis, declaredApiUses: input.declaredApiUses });
          if (!result.ok) { const failed = store.recordRepairFailure(runId, { requestId: input.requestId || cryptoSeed(), code: result.code, html: input.html, bytes: result.bytes, sha256: result.sha256 }); return json(res, 422, { ok: false, code: 'repair_failed', diagnostics: result.diagnostics, ...runSummary(failed, url.origin) }); }
          const accepted = store.acceptRepair(runId, { requestId: input.requestId || cryptoSeed(), html: input.html, sha256: result.sha256, bytes: result.bytes }); return json(res, 200, { ok: true, creationId: accepted.creationId, ...runSummary(accepted, url.origin) });
        }
      }
      const creationMatch = url.pathname.match(/^\/(c|run)\/([^/]+)$/);
      if (creationMatch && req.method === 'GET') {
        const run = store.findByCreation(creationMatch[2]); const revision = [...run.revisions].reverse().find((item) => item.status === 'accepted');
        if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (!revision) return text(res, 200, companionFailurePage(run), { ...securityHeaders(`default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors ${CHATGPT_FRAME_ANCESTORS.join(' ')}`), 'content-type': 'text/html; charset=utf-8' });
        if (creationMatch[1] === 'c') {
          const csp = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${CHATGPT_FRAME_ANCESTORS.join(' ')}`;
          const html = creationPage(run, revision); return text(res, 200, html, { ...securityHeaders(csp), 'content-type': 'text/html; charset=utf-8' });
        }
        if (isEarlySpecimen(run)) return text(res, 200, retiredRuntimePage(run), { ...securityHeaders(`default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors ${url.origin} ${CHATGPT_FRAME_ANCESTORS.join(' ')}`), 'content-type': 'text/html; charset=utf-8' });
        store.setCapabilityExpiry(run.id, Date.now() + 600000); const token = signer.issue({ creationId: run.creationId, revision: revision.revision, selected: run.selectedApis.flatMap((entry) => entry.operationIds.map((operationId) => ({ apiId: entry.apiId, operationId }))) });
        const harness = `<script>window.randomware=Object.freeze({call:async(a,o,p)=>{const r=await fetch('/api/runtime/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({creationId:${JSON.stringify(run.creationId)},revision:${revision.revision},apiId:a,operationId:o,params:p,capability:${JSON.stringify(token)}})});if(!r.ok)throw new Error('broker_failure');return r.json()},ready:()=>parent.postMessage({channel:'randomware',type:'ready'},'*')});</script>`;
        const csp = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: 'self'; media-src blob: ${url.origin}; connect-src 'self'; font-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${url.origin} ${CHATGPT_FRAME_ANCESTORS.join(' ')}`;
        return text(res, 200, `${harness}${revision.html}`, { ...securityHeaders(csp), 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': 'null' });
      }
      const keeperMatch = url.pathname.match(/^\/api\/creations\/([^/]+)\/(download|spec|spec\/download)$/);
      if (keeperMatch && req.method === 'GET') {
        const run = store.findByCreation(keeperMatch[1]);
        if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (keeperMatch[2] === 'download') { const accepted = [...run.revisions].reverse().find((item) => item.status === 'accepted'); if (!accepted) return text(res, 409, failurePage(run), { 'content-type': 'text/html; charset=utf-8' }); return text(res, 200, accepted.html, { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename="randomware-${run.creationId}.html"`, 'x-content-type-options': 'nosniff' }); }
        if (keeperMatch[2] === 'spec/download') return text(res, 200, specText(run), { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="randomware-${run.creationId}-spec.txt"` });
        return text(res, 200, specHtml(run), { ...securityHeaders("default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
      }
      const sourceMatch = url.pathname.match(/^\/api\/creations\/([^/]+)\/(source|requests)$/);
      if (sourceMatch && req.method === 'GET') {
        const run = store.findByCreation(sourceMatch[1]);
        if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (sourceMatch[2] === 'source') { const requested = Number(new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('revision')); const revision = Number.isInteger(requested) && requested > 0 ? run.revisions.find((item) => item.revision === requested) : [...run.revisions].reverse()[0]; return text(res, 200, revision?.html || '', { 'content-type': 'text/plain; charset=utf-8' }); }
        if (url.searchParams.get('format') === 'raw') return json(res, 200, run.runtimeRequests || []);
        return text(res, 200, requestsPage(run), { ...securityHeaders("default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
      }
      const dataflowMatch = url.pathname.match(/^\/api\/creations\/([^/]+)\/dataflow$/);
      if (dataflowMatch && req.method === 'GET') { const run = store.findByCreation(dataflowMatch[1]); if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' }); const flow = store.dataflow(run.id); if (url.searchParams.get('format') === 'raw') return json(res, 200, flow); return text(res, 200, dataflowPage(run, flow), { ...securityHeaders("default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' }); }
      const moderationMatch = url.pathname.match(/^\/api\/creations\/([^/]+)\/(report|unpublish)$/);
      if (moderationMatch) {
        const run = store.findByCreation(moderationMatch[1]);
        if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (req.method === 'GET' && moderationMatch[2] === 'report') return text(res, 200, reportPage(run), { ...securityHeaders("default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (req.method === 'POST' && moderationMatch[2] === 'report') { const isForm = String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded'); const input = isForm ? await formBody(req) : await body(req); store.reportCreation(run.creationId, input.reason || 'unspecified'); if (isForm) return text(res, 200, reportPage(run, true), { ...securityHeaders("default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' }); return json(res, 200, { ok: true, status: 'hidden' }); }
        if (req.method === 'POST' && moderationMatch[2] === 'unpublish') {
          const expected = process.env.RANDOMWARE_OWNER_TOKEN || 'local-owner-token';
          if (req.headers.authorization !== `Bearer ${expected}`) return json(res, 403, { ok: false, code: 'owner_auth_required' });
          store.unpublishCreation(run.creationId); return json(res, 200, { ok: true, status: 'unpublished' });
        }
      }
      if (req.method === 'GET' && (url.pathname === '/app.js' || url.pathname === '/styles.css' || url.pathname === '/creation.css')) {
        const file = url.pathname.slice(1); const content = fs.readFileSync(path.join(PUBLIC, file)); const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'; return text(res, 200, content, { 'content-type': `${type}; charset=utf-8` });
      }
      return text(res, 404, 'Not found');
    } catch (error) { return json(res, error.message === 'run_not_found' || error.message === 'creation_not_found' ? 404 : 400, { ok: false, code: error.message }); }
  });
  return server;
}

function cryptoSeed() { return `${Date.now()}-${crypto.randomBytes(16).toString('hex')}`; }

function ownerPage(run, revision) {
  const apiList = run.selectedApis.map((entry) => `<li>${escapeHtml(entry.apiId)}</li>`).join('');
  const name = escapeHtml(run.concept?.appName || 'Untitled collision'); const premise = escapeHtml(run.concept?.premise || 'A generated collision.');
  const revisions = run.revisions.map((item) => `<li><a href="/api/creations/${run.creationId}/source?revision=${item.revision}">Revision ${item.revision}</a> · ${item.status} · ${item.bytes || 0} bytes</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/creation.css"><title>${name} — Randomware</title></head><body><main class="rw-shell"><section class="rw-chrome"><p class="rw-kicker">AI-generated experimental app</p><h1>${name}</h1><p>${premise}</p><p><strong>Do not enter real personal, payment, authentication, or secret data.</strong></p><p>Selected APIs:</p><ul>${apiList}</ul><div class="rw-actions"><a href="/api/creations/${run.creationId}/download">Download HTML</a><a href="/api/creations/${run.creationId}/spec">Keeper spec</a><a href="/api/creations/${run.creationId}/spec/download">Download spec</a><a href="/api/creations/${run.creationId}/requests">Inspect requests</a><a href="/api/creations/${run.creationId}/dataflow">Inspect dataflow</a><a href="/api/creations/${run.creationId}/report">Report/remove</a></div><p class="rw-kicker">Source revisions</p><ul>${revisions}</ul></section><iframe class="rw-frame" title="Generated app" sandbox="allow-scripts" credentialless referrerpolicy="no-referrer" src="/run/${run.creationId}"></iframe><footer>Specimen ${run.creationId} · accepted revision ${revision.revision}</footer></main></body></html>`;
}

function failurePage(run) {
  const code = run.failure?.code || 'capacity_reached';
  const certificate = deathCertificate(code, { detail: run.failure?.detail, specimenId: run.creationId, revisions: run.revisions });
  const detail = certificate.detail;
  const escapedCode = String(code).replace(/[<>&"']/g, '');
  const escapedDetail = String(detail).replace(/[<>&"']/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Failed Randomware creation</title><style>body{margin:0;padding:clamp(24px,8vw,100px);background:#160c26;color:#ffe7c7;font:18px Georgia,serif}main{max-width:760px;margin:auto;border:3px solid #e8614f;padding:clamp(24px,6vw,64px)}code{color:#55e6c1}a{color:#55e6c1}</style></head><body><main><p>AI-generated experimental app</p><h1>Failed Creation</h1><p>The specimen stopped honestly. Cause: <code>${escapedCode}</code></p><p>${escapedDetail}</p><p>${escapeHtml(certificate.epitaph)}</p><p>Do not enter real personal, payment, authentication, or secret data.</p><p>Specimen ${run.creationId} · <a href="/api/runs/${run.id}">inspect run</a></p></main></body></html>`;
}

function removalPage(run) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Creation removed</title></head><body><main><h1>Creation removed</h1><p>This specimen is no longer publicly available.</p><p>Specimen ${escapeHtml(run.creationId)}</p></main></body></html>`;
}

async function handleMcp(req, res, app) {
  const input = await body(req); const method = input.method; const origin = `https://${req.headers.host || 'localhost'}`;
  if (method === 'initialize') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: initializeResult(input.params) });
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') { res.writeHead(202); return res.end(); }
  if (method === 'ping') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: {} });
  if (method === 'resources/list') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { resources: [resourceSummary(origin)] } });
  if (method === 'resources/read') { if (input.params?.uri !== MCP_RESOURCE_URI) return json(res, 400, jsonRpcError(input.id, -32602, 'resource_not_found')); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: widgetResource(origin) }); }
  if (method === 'tools/list') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { tools: createMcpTools(app) } });
  if (method === 'tools/call') {
    const name = input.params?.name; const args = input.params?.arguments || {};
    const contract = validateToolArguments(name, args); if (!contract.ok) return json(res, 400, { jsonrpc: '2.0', id: input.id, error: { code: contract.code, message: 'invalid_tool_input', data: { diagnostics: contract.diagnostics } } });
    if (name === 'open_randomware') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult({ ok: true, registry: registry.length }, 'Randomware slot mounted.') });
    if (name === 'spin_apis') { const spinSeed = args.seed || cryptoSeed(); const selected = selectApis({ seed: spinSeed, registry }); const style = selectStyle({ seed: spinSeed, history: args.styleHistory || [] }); const run = app.store.createRun({ requestId: args.requestId || cryptoSeed(), selectedApis: selected.map((entry) => ({ apiId: entry.id, operationIds: entry.operations.map((op) => op.id) })), styleId: style.id, styleHistory: args.styleHistory || [] }); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult(runSummary(run, origin), `Selected ${run.selectedApis.length} APIs and style ${style.name}.`) }); }
    if (name === 'get_run') { app.store.noteActivity(args.runId); const run = app.store.getRun(args.runId); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult(runSummary(run, origin), `Run ${run.id} is ${run.phase}.`) }); }
    if (name === 'submit_concept') {
      app.store.noteActivity(args.runId, Date.now(), [phases.SPINNED]); const run = app.store.getRun(args.runId); const concept = { ...args, apiIds: args.apiIds || run.selectedApis.map((entry) => entry.apiId) }; const check = validateConcept(concept, { selectedApis: run.selectedApis, prior: run.history || [], styleId: run.styleId });
      if (!check.ok) return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult({ ...runSummary(run, origin), ...check }, `Concept rejected: ${check.code}.`, { isError: true }) });
      const accepted = app.store.acceptConcept(args.runId, concept); const summary = runSummary(accepted, origin); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult(summary, conceptAcceptedPrompt(args.runId, summary.selectedApis, summary.style)) });
    }
    if (name === 'submit_artifact' || name === 'submit_repair') {
      app.store.noteActivity(args.runId, Date.now(), name === 'submit_repair' ? [phases.REPAIR_REQUESTED] : [phases.CONCEPT_ACCEPTED, phases.BUILDING]); const run = app.store.getRun(args.runId); const check = validateArtifact(args.html, { selectedApis: run.selectedApis, declaredApiUses: args.declaredApiUses });
      if (!check.ok) { const failureArgs = { requestId: args.requestId, code: check.code, html: args.html, bytes: check.bytes, sha256: check.sha256 }; const failed = name === 'submit_repair' ? app.store.recordRepairFailure(args.runId, failureArgs) : app.store.recordArtifactFailure(args.runId, failureArgs); const summary = runSummary(failed, origin); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult({ ...summary, ...check, nextTool: name === 'submit_repair' ? 'none' : 'submit_repair' }, artifactRepairPrompt({ runId: args.runId, diagnostics: check.diagnostics, selectedApis: summary.selectedApis, style: summary.style }), { isError: true }) }); }
      const accepted = name === 'submit_repair' ? app.store.acceptRepair(args.runId, { requestId: args.requestId, html: args.html, sha256: check.sha256, bytes: check.bytes }) : app.store.acceptArtifact(args.runId, { requestId: args.requestId, html: args.html, sha256: check.sha256, bytes: check.bytes });
      const acceptedSummary = runSummary(accepted, origin); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult(acceptedSummary, acceptedArtifactToolText(name === 'submit_repair' ? 'Repair' : 'Artifact', acceptedSummary.creationUrl)) });
    }
    if (name === 'mutate_creation') { const run = app.store.findByCreation(args.creationId); const result = { ok: true, creationId: run.creationId, creationUrl: companionUrl(origin, `/c/${encodeURIComponent(run.creationId)}`), apiIds: run.selectedApis.map((entry) => entry.apiId), premise: args.premise, note: 'mutation preserves the immutable selected API set' }; return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult(result, `Mutation recorded for ${run.creationId}.`) }); }
    if (name === 'record_choreography_failure') { const failed = app.store.fail(args.runId, args.code || 'choreography_timeout', args.phase); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: callToolResult(runSummary(failed, origin), `Failure recorded for ${args.runId}.`) }); }
  }
  return json(res, 400, { jsonrpc: '2.0', id: input.id, error: { code: -32601, message: 'method_not_supported' } });
}

if (require.main === module) {
  const fixtureMode = process.env.RANDOMWARE_FIXTURES !== '0';
  const broker = fixtureMode ? new Broker({ fixtureMode: true, fetcher: fixtureMediaFetcher }) : new Broker({ fixtureMode: false });
  createServer({ fixtureMode, broker }).listen(Number(process.env.PORT || 8787), () => console.log(`Randomware listening on http://127.0.0.1:${process.env.PORT || 8787}`));
}

module.exports = { createServer, runSummary, ownerPage };
