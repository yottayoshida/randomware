const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { callToolResult, widgetResource, widgetToolResult, widgetBuildPrompt, widgetRepairPrompt, initializeResult, conceptAcceptedPrompt, ARTIFACT_CONTRACT_LITERALS } = require('../../src/core/mcp');
const { tools } = require('../../src/web');
const { toolSchemas, validateToolArguments } = require('../../src/core/tool-contract');

test('CallToolResult includes concise content alongside structuredContent', () => {
  const structuredContent = { ok: true, registry: 18 };
  const result = callToolResult(structuredContent, 'Randomware slot ready.');
  assert.deepEqual(result.structuredContent, structuredContent);
  assert.deepEqual(result.content, [{ type: 'text', text: 'Randomware slot ready.' }]);
});

test('MCP tool annotations keep closed-world control tools closed', () => {
  const byName = Object.fromEntries(tools().map((tool) => [tool.name, tool.annotations]));
  for (const name of ['open_randomware', 'spin_apis', 'get_run', 'mutate_creation', 'record_choreography_failure']) assert.equal(byName[name].openWorldHint, false, `${name} must be closed-world`);
  for (const name of ['submit_concept', 'submit_artifact', 'submit_repair']) assert.equal(byName[name].openWorldHint, true, `${name} must be open-world`);
});

test('MCP schemas describe every concept and artifact nested contract', () => {
  assert.deepEqual(toolSchemas.submit_concept.properties.apiRoles.items.required, ['apiId', 'essentialRole', 'operations']);
  assert.deepEqual(toolSchemas.submit_concept.properties.causalChain.items.required, ['order', 'apiId', 'action']);
  assert.deepEqual(toolSchemas.submit_artifact.properties.declaredApiUses.items.required, ['apiId', 'operations']);
  assert.deepEqual(toolSchemas.submit_repair.required.slice(-2), ['failedRevisionId', 'diagnosticCodes']);
  assert.equal(tools().find((tool) => tool.name === 'submit_concept').inputSchema.properties.apiRoles.items.properties.operations.items.type, 'string');
});

test('MCP argument validation names omitted nested role operations', () => {
  const result = validateToolArguments('submit_concept', {
    requestId: 'r', runId: 'run', runContract: 'contract', promptVersion: 'concept-v1', appName: 'Name', premise: 'A premise that is long enough for the contract.', playerAction: 'A player action that is long enough for the contract.', apiIds: ['open-meteo'],
    causalChain: [{ order: 1, apiId: 'open-meteo', action: 'turn weather into the next rule' }], apiRoles: [{ apiId: 'open-meteo', essentialRole: 'Supplies the weather signal for the collision.' }],
    dependency: { fromApiId: 'open-meteo', to: 'rules', explanation: 'The weather determines the rule.' }, interaction: { controls: ['reveal'], outcome: 'Reveal one result.' },
    visualDirection: { style: 'bold', palette: 'cyan', typography: 'serif', motion: 'sweep' }, bannedShapeAssessment: { plainDashboard: false, plainSearch: false, plainQuiz: false, randomFactDisplay: false, thinClone: false, plausibleStartupPitch: false, explanation: 'This is not a generic shape.' }, noveltyDelta: 'A new collision.'
  });
  assert.equal(result.code, 'api_role_operations_missing:open-meteo');
  assert.doesNotMatch(JSON.stringify(result), /TypeError/);
});

test('widget opens a routable creation in-frame and exposes an openExternal fallback', () => {
  const widget = widgetResource('https://randomware.example').contents[0].text;
  assert.match(widget, /id="creation-frame"/);
  assert.match(widget, /\/c\//);
  assert.match(widget, /openExternal\(\{href/);
  assert.match(widget, /Download or open the creation/);
});

test('widget refreshes server-owned choreography deadlines and clears stale phase state on repair', () => {
  const widget = widgetResource('https://randomware.example').contents[0].text;
  assert.match(widget, /statusUrl/);
  assert.match(widget, /setInterval/);
  assert.match(widget, /syncTimerFromServer/);
  assert.match(widget, /phase:'repair_requested',choreography:null/);
});

test('widget consumes the real CallToolResult envelope and ignores a stale mount result', () => {
  const run = { runId: 'run-widget', phase: 'spinned', selectedApis: [{ id: 'frankfurter', name: 'Frankfurter', operations: [] }] };
  const envelope = callToolResult(run, 'Selected 1 API.');
  assert.deepEqual(widgetToolResult(envelope), { output: run, isError: false });
  assert.deepEqual(widgetToolResult({ result: envelope }), { output: run, isError: false });
  assert.equal(widgetToolResult(callToolResult({ ok: true, registry: 18 }, 'Randomware slot mounted.')), null);
});

test('widget fallback prompt binds the active run and required build choreography', () => {
  const prompt = widgetBuildPrompt({ runId: 'run_fallback_123' });
  assert.match(prompt, /Use Randomware run run_fallback_123:/);
  assert.match(prompt, /call get_run/);
  assert.match(prompt, /then submit_concept/);
  assert.match(prompt, /submit the complete artifact via submit_artifact/);
});

test('every prompt surface carries the shared artifact contract literals', () => {
  assert.ok(Array.isArray(ARTIFACT_CONTRACT_LITERALS));
  const surfaces = [
    initializeResult().instructions,
    ...tools().map((tool) => tool.description),
    conceptAcceptedPrompt('run_prompt_fidelity'),
    widgetBuildPrompt({ runId: 'run_prompt_fidelity' }),
    widgetRepairPrompt({ runId: 'run_prompt_fidelity', diagnostics: ['loading marker missing'] }),
    widgetResource('https://randomware.example').contents[0].text
  ];
  for (const [index, surface] of surfaces.entries()) for (const literal of ARTIFACT_CONTRACT_LITERALS) assert.ok(surface.includes(literal), `prompt_surface_${index}_missing:${literal}`);
});

test('repair prompt includes exact diagnostics and the full artifact contract', () => {
  const prompt = widgetRepairPrompt({ runId: 'run_repair_fidelity', diagnostics: ['loading marker missing', 'viewport marker missing'] });
  assert.match(prompt, /loading marker missing/);
  assert.match(prompt, /viewport marker missing/);
  for (const literal of ARTIFACT_CONTRACT_LITERALS) assert.ok(prompt.includes(literal), `repair_prompt_missing:${literal}`);
});

test('widget inline script is valid JavaScript', () => {
  const widget = widgetResource('https://randomware.example').contents[0].text;
  const script = widget.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'randomware-widget.js' }));
});
