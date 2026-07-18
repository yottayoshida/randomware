const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const vm = require('node:vm');
const { createArtifact } = require('../src/core/artifact');
const { toolSchemas } = require('../src/core/tool-contract');
const { ARTIFACT_CONTRACT_LITERALS } = require('../src/core/artifact-contract');

function clone(value) { return structuredClone(value); }

function setPath(target, path, value) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]];
  cursor[parts[parts.length - 1]] = value;
}

function deletePath(target, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]];
  delete cursor[parts[parts.length - 1]];
}

function schemaAt(schema, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cursor = schema;
  for (const part of parts) {
    if (cursor?.type === 'array') { cursor = cursor.items; if (/^\d+$/.test(part)) continue; }
    if (cursor.type === 'object') cursor = cursor.properties[part];
  }
  return cursor;
}

function requiredPaths(schema, prefix = '') {
  const paths = [];
  if (schema.type !== 'object') return paths;
  for (const key of schema.required || []) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    const child = schema.properties[key];
    if (child?.type === 'object') paths.push(...requiredPaths(child, path));
    if (child?.type === 'array' && child.items?.type === 'object') paths.push(...requiredPaths(child.items, `${path}[0]`));
  }
  return paths;
}

function assertPromptSurface(surface, label) {
  const text = String(surface || '');
  for (const literal of ARTIFACT_CONTRACT_LITERALS) assert.ok(text.includes(literal), `prompt_fidelity:${label}:${literal}`);
}

function assertWidgetScriptParses(widgetText) {
  const script = String(widgetText || '').match(/<script>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script, 'widget_script_missing');
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'deployed-randomware-widget.js' }), 'widget_script_syntax_failed');
}

function wrongValue(schema) {
  if (schema?.type === 'string') return 123;
  if (schema?.type === 'integer') return 'not-an-integer';
  if (schema?.type === 'boolean') return 'not-a-boolean';
  if (schema?.type === 'array') return {};
  if (schema?.type === 'object') return 'not-an-object';
  return null;
}

function conceptFor(run, label, requestId) {
  const selected = run.selectedApis;
  const apiIds = selected.map((api) => api.id);
  return {
    runId: run.runId, requestId, runContract: run.runContract, promptVersion: run.promptVersion,
    appName: `Synthetic ${label}`, premise: `A bounded collision turns ${label} signals into one theatrical instrument.`, playerAction: `Press the single control to make the ${label} instrument reveal its next state.`, apiIds,
    causalChain: selected.map((api, index) => ({ order: index + 1, apiId: api.id, action: `turn ${api.name} into the next ${label} rule` })),
    apiRoles: selected.map((api) => ({ apiId: api.id, essentialRole: `${api.name} supplies an essential ${label} signal.`, operations: api.operations.map((operation) => operation.id) })),
    dependency: { fromApiId: apiIds[0], to: 'rules', ...(apiIds[1] ? { toApiId: apiIds[1] } : {}), explanation: `The first ${label} signal determines how the next one is interpreted.` },
    interaction: { controls: ['reveal'], outcome: `The ${label} instrument reveals a changing result.` },
    visualDirection: { style: 'maximalist collision theatre', palette: 'saffron, ink, and cyan', typography: 'oversized editorial serif', motion: 'cards sweep like instruments' },
    bannedShapeAssessment: { plainDashboard: false, plainSearch: false, plainQuiz: false, randomFactDisplay: false, thinClone: false, plausibleStartupPitch: false, explanation: 'This is a staged collision, not a startup pitch.' },
    noveltyDelta: `The ${label} collision changes the interaction rules.`
  };
}

function artifactFor(run, label, requestId, html = createArtifact({ appName: `Synthetic ${label}`, selected: run.selectedApis.map((api) => ({ apiId: api.id, operationId: api.operations[0].id })) })) {
  return { runId: run.runId, requestId, runContract: run.runContract, conceptId: run.conceptId || `${label}-concept`, promptVersion: run.promptVersion, html, declaredApiUses: run.selectedApis.map((api) => ({ apiId: api.id, operations: api.operations.map((operation) => operation.id) })) };
}

async function runSynthetic(base) {
  const mcp = (message) => fetch(`${base}/mcp`, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify(message) });
  const tag = `synthetic-${Date.now()}-${randomUUID()}`;
  const initialize = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'randomware-synthetic-model', version: '1.0.0' } } });
  assert.equal(initialize.status, 200, `synthetic_initialize:${initialize.status}`);
  const initializeBody = await initialize.clone().json();
  assertPromptSurface(initializeBody.result?.instructions, 'initialize');
  const ready = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' }); assert.equal(ready.status, 202, `synthetic_initialized:${ready.status}`);
  const toolsResponse = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }); assert.equal(toolsResponse.status, 200);
  const tools = (await toolsResponse.json()).result.tools; assert.equal(tools.length, 8);
  for (const tool of tools) assertPromptSurface(tool.description, `tool:${tool.name}`);
  const resourceResponse = await mcp({ jsonrpc: '2.0', id: 2.5, method: 'resources/read', params: { uri: 'ui://widget/randomware.html' } }); assert.equal(resourceResponse.status, 200);
  const widgetText = (await resourceResponse.json()).result.contents[0].text;
  assertWidgetScriptParses(widgetText);
  assertPromptSurface(widgetText, 'widget');
  assert.ok(widgetText.includes('submit the complete artifact via submit_artifact'), 'prompt_fidelity:widget_build_prompt');
  assert.ok(widgetText.includes('Exact rejection diagnostics:'), 'prompt_fidelity:widget_repair_prompt');
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object', `schema_object:${tool.name}`);
    for (const path of requiredPaths(tool.inputSchema)) assert.ok(schemaAt(tool.inputSchema, path), `schema_path:${tool.name}:${path}`);
  }
  const call = async (id, name, args) => {
    const response = await mcp({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
    const body = await response.json();
    assert.doesNotMatch(JSON.stringify(body), /TypeError|Cannot read properties|is not a function/);
    return { response, body };
  };
  const spun = await call(3, 'spin_apis', { seed: `${tag}-spin`, requestId: `${tag}-spin` });
  assert.equal(spun.response.status, 200); const run = spun.body.result.structuredContent; assert.ok(run.runId && run.runContract && run.promptVersion && run.selectedApis.length);
  const conceptInput = conceptFor(run, 'choreography', `${tag}-concept`);
  const concept = await call(4, 'submit_concept', conceptInput); assert.equal(concept.response.status, 200); assert.equal(concept.body.result.structuredContent.phase, 'concept_accepted');
  assertPromptSurface(concept.body.result.content?.[0]?.text, 'concept_result');
  const conceptRun = concept.body.result.structuredContent;
  const artifact = await call(5, 'submit_artifact', artifactFor(conceptRun, 'choreography', `${tag}-artifact`)); assert.equal(artifact.response.status, 200); assert.equal(artifact.body.result.structuredContent.phase, 'completed');
  const status = await fetch(`${base}${artifact.body.result.structuredContent.statusUrl}`); assert.equal(status.status, 200); const statusBody = await status.json(); assert.equal(statusBody.phase, 'completed'); assert.equal(statusBody.creationId, artifact.body.result.structuredContent.creationId);

  const repairSpin = await call(6, 'spin_apis', { seed: `${tag}-repair-spin`, requestId: `${tag}-repair-spin` }); const repairRun = repairSpin.body.result.structuredContent;
  const repairConcept = await call(7, 'submit_concept', conceptFor(repairRun, 'repair', `${tag}-repair-concept`)); assert.equal(repairConcept.response.status, 200);
  const repairState = repairConcept.body.result.structuredContent;
  const failed = await call(8, 'submit_artifact', artifactFor(repairState, 'repair', `${tag}-failed`, '<!doctype html><html><body>invalid</body></html>')); assert.equal(failed.response.status, 200); assert.equal(failed.body.result.isError, true);
  assertPromptSurface(failed.body.result.content?.[0]?.text, 'repair_result');
  for (const diagnostic of failed.body.result.structuredContent?.diagnostics || []) assert.ok(failed.body.result.content[0].text.includes(diagnostic), `repair_diagnostic:${diagnostic}`);
  const repairBase = { ...artifactFor(repairState, 'repair', `${tag}-repair`), failedRevisionId: '1', diagnosticCodes: ['artifact_schema'] };

  const bases = {
    open_randomware: {},
    spin_apis: { seed: `${tag}-fuzz`, requestId: `${tag}-fuzz` },
    submit_concept: conceptInput,
    submit_artifact: artifactFor(conceptRun, 'fuzz', `${tag}-artifact-fuzz`),
    submit_repair: repairBase,
    get_run: { runId: run.runId },
    mutate_creation: { creationId: artifact.body.result.structuredContent.creationId, requestId: `${tag}-mutation`, premise: 'A bounded mutation premise.' },
    record_choreography_failure: { runId: run.runId, requestId: `${tag}-failure`, phase: 'completed', code: 'choreography_timeout' }
  };
  let fuzzCases = 0;
  for (const [name, schema] of Object.entries(toolSchemas)) {
    for (const path of requiredPaths(schema)) {
      const field = path.split(/[.\[]/).filter(Boolean).pop();
      for (const variant of ['missing', 'mistyped']) {
        const args = clone(bases[name]);
        if (variant === 'missing') deletePath(args, path); else setPath(args, path, wrongValue(schemaAt(schema, path)));
        const result = await call(1000 + fuzzCases, name, args); fuzzCases += 1;
        assert.ok(result.response.status >= 400 && result.response.status < 500, `fuzz_status:${name}:${path}:${variant}:${result.response.status}`);
        const code = String(result.body.error?.code || result.body.code || '');
        assert.ok(code && code.toLowerCase().includes(field.toLowerCase()), `fuzz_code:${name}:${path}:${variant}:${code}`);
      }
    }
  }
  return { choreographyRunId: run.runId, creationId: artifact.body.result.structuredContent.creationId, fuzzCases, tools: tools.length, promptSurfaces: tools.length + 4, promptLiterals: ARTIFACT_CONTRACT_LITERALS.length };
}

if (require.main === module) {
  const baseArg = process.argv.find((arg) => arg.startsWith('--base-url='));
  const base = (baseArg ? baseArg.slice('--base-url='.length) : process.env.RANDOMWARE_PUBLIC_URL || '').replace(/\/$/, '');
  if (!base || !/^https:\/\//i.test(base)) { console.error('test-synthetic-deployed requires --base-url=HTTPS_URL'); process.exit(2); }
  runSynthetic(base).then((result) => console.log(JSON.stringify({ ok: true, ...result }))).catch((error) => { console.error(`synthetic deployed acceptance failed: ${error.message}`); process.exitCode = 1; });
}

module.exports = { runSynthetic, requiredPaths };
