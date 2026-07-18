const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { registry } = require('./core/registry');
const { selectApis } = require('./core/selection');
const { validateArtifact } = require('./core/validator');
const { RunStore, phases } = require('./core/store');
const { Broker } = require('./core/broker');
const { CapabilitySigner } = require('./core/capability');
const { validateConcept } = require('./core/concept');
const { escapeHtml } = require('./core/artifact');
const { deathCertificate } = require('./core/failure');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(payload);
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(body);
}

async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 60000) throw new Error('payload_too_large'); chunks.push(chunk); }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function runSummary(run) {
  return {
    runId: run.id, phase: run.phase, creationId: run.creationId, selectedApis: run.selectedApis.map(({ apiId, operationIds }) => { const entry = registry.find((item) => item.id === apiId); return { id: apiId, name: entry.name, category: entry.category, capability: entry.capability, operations: entry.operations.filter((op) => operationIds.includes(op.id)) }; }),
    concept: run.concept, conceptHistory: run.conceptHistory || [], failure: run.failure, revisions: run.revisions.map(({ revision, bytes, sha256, status, at }) => ({ revision, bytes, sha256, status, at })), events: run.events, repairCount: run.repairCount
  };
}

function securityHeaders(csp) {
  return { 'content-security-policy': csp, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'cross-origin-resource-policy': 'same-site' };
}

function createMcpTools(app) {
  return [
    { name: 'open_randomware', description: 'Use this to mount the Randomware slot machine.', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false } },
    { name: 'spin_apis', description: 'Use this to select a fresh bounded API collision.', inputSchema: { type: 'object', properties: { seed: { type: 'string' }, requestId: { type: 'string' } } }, annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false } },
    { name: 'submit_concept', description: 'Use this after spin_apis to submit the concept contract.', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, requestId: { type: 'string' }, appName: { type: 'string' }, premise: { type: 'string' }, playerAction: { type: 'string' }, apiIds: { type: 'array' }, causalChain: { type: 'array' }, apiRoles: { type: 'array' }, dependency: { type: 'object' }, interaction: { type: 'object' }, visualDirection: { type: 'object' }, bannedShapeAssessment: { type: 'object' }, noveltyDelta: { type: 'string' } }, required: ['runId','requestId','appName','premise','playerAction','apiIds','causalChain','apiRoles','dependency','interaction','visualDirection','bannedShapeAssessment','noveltyDelta'] }, annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false } },
    { name: 'submit_artifact', description: 'Use this after concept acceptance to submit one complete HTML artifact.', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, requestId: { type: 'string' }, html: { type: 'string' } }, required: ['runId','requestId','html'] }, annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false } },
    { name: 'submit_repair', description: 'Use this once after a validation or boot failure to submit one complete replacement artifact.', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, requestId: { type: 'string' }, html: { type: 'string' } }, required: ['runId','requestId','html'] }, annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false } },
    { name: 'get_run', description: 'Use this to recover a run snapshot.', inputSchema: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'] }, annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false } },
    { name: 'mutate_creation', description: 'Use this to ask for a different concept while preserving the selected API set.', inputSchema: { type: 'object', properties: { creationId: { type: 'string' }, requestId: { type: 'string' }, premise: { type: 'string' } }, required: ['creationId','requestId','premise'] }, annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false } },
    { name: 'record_choreography_failure', description: 'Use this to close a silent or noncompliant phase after its absolute deadline.', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, requestId: { type: 'string' }, phase: { type: 'string' }, code: { type: 'string' } }, required: ['runId','requestId','phase','code'] }, annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false } }
  ];
}

function createServer({ fixtureMode = false, store = new RunStore(), broker = new Broker({ fixtureMode }), signer = new CapabilitySigner(process.env.RANDOMWARE_SIGNING_SECRET || 'local-development-secret') } = {}) {
  const app = { store, broker, signer };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'randomware', registry: registry.length });
      if (req.method === 'GET' && url.pathname === '/api/registry') return json(res, 200, registry.map(({ id, name, category, capability, docsUrl, attribution }) => ({ id, name, category, capability, docsUrl, attribution })));
      if (req.method === 'GET' && url.pathname === '/api/tools') return json(res, 200, createMcpTools(app));
      if (req.method === 'GET' && url.pathname === '/api/creations/recent') return json(res, 200, store.listCreations().filter((run) => run.listed !== false && !run.unpublished).map((run) => ({ creationId: run.creationId, appName: run.concept?.appName, premise: run.concept?.premise, phase: run.phase, selectedApis: run.selectedApis.map((entry) => entry.apiId) })));
      if (req.method === 'POST' && url.pathname === '/mcp') return handleMcp(req, res, app);
      if (req.method === 'POST' && url.pathname === '/api/spin') {
        const input = await body(req); const selected = selectApis({ seed: input.seed || cryptoSeed(), registry, history: input.history || [] });
        const run = store.createRun({ requestId: input.requestId || cryptoSeed(), selectedApis: selected.map((entry) => ({ apiId: entry.id, operationIds: entry.operations.map((op) => op.id) })), history: input.history || [] });
        return json(res, 200, { ...runSummary(run), runId: run.id, statusUrl: `/api/runs/${run.id}`, disclosure: 'Building publishes this experimental AI-generated app at a public URL.' });
      }
      const rerollMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/reroll$/);
      if (req.method === 'POST' && rerollMatch) { const input = await body(req); return json(res, 200, runSummary(store.rerollConcept(rerollMatch[1], input))); }
      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(concept|artifact|repair))?$/);
      if (runMatch) {
        const runId = runMatch[1]; const action = runMatch[2];
        if (req.method === 'GET' && !action) return json(res, 200, runSummary(store.getRun(runId)));
        if (req.method === 'POST' && action === 'concept') {
          const input = await body(req); const run = store.getRun(runId); const concept = { ...input, apiIds: input.apiIds || run.selectedApis.map((entry) => entry.apiId) };
          const check = validateConcept(concept, { selectedApis: run.selectedApis, prior: run.history || [] });
          if (!check.ok) return json(res, 422, check);
          const accepted = store.acceptConcept(runId, concept); return json(res, 200, runSummary(accepted));
        }
        if (req.method === 'POST' && action === 'artifact') {
          const input = await body(req); const run = store.getRun(runId); const result = validateArtifact(input.html, { selectedApis: run.selectedApis });
          if (!result.ok) { store.recordArtifactFailure(runId, { requestId: input.requestId || cryptoSeed(), code: result.code, html: input.html }); return json(res, 422, { ok: false, code: result.code, diagnostics: result.diagnostics }); }
          const accepted = store.acceptArtifact(runId, { requestId: input.requestId || cryptoSeed(), html: input.html, sha256: result.sha256, bytes: result.bytes }); return json(res, 200, { ok: true, creationId: accepted.creationId, ...runSummary(accepted) });
        }
        if (req.method === 'POST' && action === 'repair') {
          const input = await body(req); const run = store.getRun(runId); const result = validateArtifact(input.html, { selectedApis: run.selectedApis });
          if (!result.ok) { const failed = store.recordRepairFailure(runId, { requestId: input.requestId || cryptoSeed(), code: result.code, html: input.html }); return json(res, 422, { ok: false, code: 'repair_failed', diagnostics: result.diagnostics, ...runSummary(failed) }); }
          const accepted = store.acceptRepair(runId, { requestId: input.requestId || cryptoSeed(), html: input.html, sha256: result.sha256, bytes: result.bytes }); return json(res, 200, { ok: true, creationId: accepted.creationId, ...runSummary(accepted) });
        }
      }
      const creationMatch = url.pathname.match(/^\/(c|run)\/([^/]+)$/);
      if (creationMatch && req.method === 'GET') {
        const run = store.findByCreation(creationMatch[2]); const revision = [...run.revisions].reverse().find((item) => item.status === 'accepted');
        if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (!revision) return text(res, 200, failurePage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (creationMatch[1] === 'c') {
          const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
          const html = ownerPage(run, revision); return text(res, 200, html, { ...securityHeaders(csp), 'content-type': 'text/html; charset=utf-8' });
        }
        run.lastCapabilityExpiresAt = Date.now() + 600000; const token = signer.issue({ creationId: run.creationId, revision: revision.revision, selected: run.selectedApis.flatMap((entry) => entry.operationIds.map((operationId) => ({ apiId: entry.apiId, operationId }))) });
        const harness = `<script>window.randomware=Object.freeze({call:async(a,o,p)=>{const r=await fetch('/api/runtime/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({creationId:${JSON.stringify(run.creationId)},revision:${revision.revision},apiId:a,operationId:o,params:p,capability:${JSON.stringify(token)}})});if(!r.ok)throw new Error('broker_failure');return r.json()},ready:()=>parent.postMessage({channel:'randomware',type:'ready'},'*')});</script>`;
        const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: 'self'; media-src blob: 'self'; connect-src 'self'; font-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
        return text(res, 200, `${harness}${revision.html}`, { ...securityHeaders(csp), 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': 'null' });
      }
      const sourceMatch = url.pathname.match(/^\/api\/creations\/([^/]+)\/(source|requests)$/);
      if (sourceMatch && req.method === 'GET') {
        const run = store.findByCreation(sourceMatch[1]);
        if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' });
        if (sourceMatch[2] === 'source') return text(res, 200, [...run.revisions].reverse()[0]?.html || '', { 'content-type': 'text/plain; charset=utf-8' });
        return json(res, 200, run.runtimeRequests || []);
      }
      const dataflowMatch = url.pathname.match(/^\/api\/creations\/([^/]+)\/dataflow$/);
      if (dataflowMatch && req.method === 'GET') { const run = store.findByCreation(dataflowMatch[1]); if (run.unpublished) return text(res, 200, removalPage(run), { ...securityHeaders("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"), 'content-type': 'text/html; charset=utf-8' }); return json(res, 200, store.dataflow(run.id)); }
      const moderationMatch = url.pathname.match(/^\/api\/creations\/([^/]+)\/(report|unpublish)$/);
      if (moderationMatch) {
        const run = store.findByCreation(moderationMatch[1]);
        if (req.method === 'GET' && moderationMatch[2] === 'report') return text(res, 200, `Report ${run.creationId} with POST /api/creations/${run.creationId}/report`);
        if (req.method === 'POST' && moderationMatch[2] === 'report') { const input = await body(req); store.reportCreation(run.creationId, input.reason || 'unspecified'); return json(res, 200, { ok: true, status: 'hidden' }); }
        if (req.method === 'POST' && moderationMatch[2] === 'unpublish') {
          const expected = process.env.RANDOMWARE_OWNER_TOKEN || 'local-owner-token';
          if (req.headers.authorization !== `Bearer ${expected}`) return json(res, 403, { ok: false, code: 'owner_auth_required' });
          store.unpublishCreation(run.creationId); return json(res, 200, { ok: true, status: 'unpublished' });
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/runtime/call') {
        if (req.headers.origin && req.headers.origin !== 'null') throw new Error('origin_not_allowed');
        const input = await body(req); const run = store.findByCreation(input.creationId); if (run.unpublished) throw new Error('creation_unpublished'); const capability = signer.verify(input.capability, { creationId: input.creationId, revision: input.revision, apiId: input.apiId, operationId: input.operationId }); store.assertRuntimeQuota(run.id, capability.quotas);
        const result = await broker.call({ selectedApis: run.selectedApis, apiId: input.apiId, operationId: input.operationId, params: input.params || {} }); store.logRuntime(run.id, { apiId: input.apiId, operationId: input.operationId, status: 'ok', bytes: result.bytes, cacheHit: result.cached }); return json(res, 200, result, { 'access-control-allow-origin': 'null' });
      }
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/app.js' || url.pathname === '/styles.css')) {
        const file = url.pathname === '/' || url.pathname === '/index.html' ? 'index.html' : url.pathname.slice(1); const content = fs.readFileSync(path.join(PUBLIC, file)); const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'; return text(res, 200, content, { 'content-type': `${type}; charset=utf-8` });
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
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title></head><body><header><strong>AI-generated experimental app</strong><p>Do not enter real personal, payment, authentication, or secret data.</p><a href="/api/creations/${run.creationId}/source">Inspect source</a> · <a href="/api/creations/${run.creationId}/requests">Inspect requests</a> · <a href="/api/creations/${run.creationId}/dataflow">Inspect dataflow</a></header><main><h1>${name}</h1><p>${premise}</p><ul>${apiList}</ul><iframe title="Generated app" sandbox="allow-scripts" credentialless referrerpolicy="no-referrer" src="/run/${run.creationId}"></iframe></main><footer>Specimen ${run.creationId} · revision ${revision.revision} · <a href="/api/creations/${run.creationId}/report">Report/remove</a></footer></body></html>`;
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
  const input = await body(req); const method = input.method;
  if (method === 'tools/list') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { tools: createMcpTools(app) } });
  if (method === 'tools/call') {
    const name = input.params?.name; const args = input.params?.arguments || {};
    if (name === 'open_randomware') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { structuredContent: { ok: true, registry: registry.length } } });
    if (name === 'spin_apis') { const selected = selectApis({ seed: args.seed || cryptoSeed(), registry }); const run = app.store.createRun({ requestId: args.requestId || cryptoSeed(), selectedApis: selected.map((entry) => ({ apiId: entry.id, operationIds: entry.operations.map((op) => op.id) })) }); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { structuredContent: runSummary(run) } }); }
    if (name === 'get_run') return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { structuredContent: runSummary(app.store.getRun(args.runId)) } });
    if (name === 'submit_concept') {
      const run = app.store.getRun(args.runId); const concept = { ...args, apiIds: args.apiIds || run.selectedApis.map((entry) => entry.apiId) }; const check = validateConcept(concept, { selectedApis: run.selectedApis, prior: run.history || [] });
      if (!check.ok) return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { isError: true, structuredContent: check } });
      return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { structuredContent: runSummary(app.store.acceptConcept(args.runId, concept)) } });
    }
    if (name === 'submit_artifact' || name === 'submit_repair') {
      const run = app.store.getRun(args.runId); const check = validateArtifact(args.html, { selectedApis: run.selectedApis });
      if (!check.ok) { if (name === 'submit_repair') app.store.recordRepairFailure(args.runId, { requestId: args.requestId, code: check.code, html: args.html }); else app.store.recordArtifactFailure(args.runId, { requestId: args.requestId, code: check.code, html: args.html }); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { isError: true, structuredContent: { ...check, nextTool: name === 'submit_repair' ? 'none' : 'submit_repair' } } }); }
      const accepted = name === 'submit_repair' ? app.store.acceptRepair(args.runId, { requestId: args.requestId, html: args.html, sha256: check.sha256, bytes: check.bytes }) : app.store.acceptArtifact(args.runId, { requestId: args.requestId, html: args.html, sha256: check.sha256, bytes: check.bytes });
      return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { structuredContent: runSummary(accepted) } });
    }
    if (name === 'mutate_creation') { const run = app.store.findByCreation(args.creationId); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { structuredContent: { ok: true, creationId: run.creationId, apiIds: run.selectedApis.map((entry) => entry.apiId), premise: args.premise, note: 'mutation preserves the immutable selected API set' } } }); }
    if (name === 'record_choreography_failure') { const failed = app.store.fail(args.runId, args.code || 'choreography_timeout', args.phase); return json(res, 200, { jsonrpc: '2.0', id: input.id, result: { structuredContent: runSummary(failed) } }); }
  }
  return json(res, 400, { jsonrpc: '2.0', id: input.id, error: { code: -32601, message: 'method_not_supported' } });
}

if (require.main === module) createServer({ fixtureMode: process.env.RANDOMWARE_FIXTURES !== '0' }).listen(Number(process.env.PORT || 8787), () => console.log(`Randomware listening on http://127.0.0.1:${process.env.PORT || 8787}`));

module.exports = { createServer, runSummary, ownerPage };
