const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { callToolResult, widgetResource, widgetToolResult, widgetBuildPrompt, widgetRepairPrompt, initializeResult, conceptAcceptedPrompt, ARTIFACT_CONTRACT_LITERALS } = require('../../src/core/mcp');
const { tools, summary } = require('../../src/web');
const { toolSchemas, validateToolArguments } = require('../../src/core/tool-contract');
const { CONTRACT_PROMPT_LITERALS } = require('../../src/core/artifact-contract');
const { setPath } = require('../../scripts/test-synthetic-deployed');

test('synthetic fuzz constructs optional schema containers before mutating nested constraints', () => {
  const payload = { requestId: 'optional-enum' };
  setPath(payload, 'styleHistory[0]', 'invalid_styleHistory');
  assert.deepEqual(payload.styleHistory, ['invalid_styleHistory']);
});

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
  const concept = toolSchemas.submit_concept.properties;
  assert.equal(concept.styleId.type, 'string');
  assert.equal(concept.styleId.enum.length, 8);
  assert.deepEqual(toolSchemas.spin_apis.properties.styleHistory.items.enum, concept.styleId.enum);
  assert.deepEqual(concept.dependency.properties.to.enum, ['api_input', 'rules', 'interface_state']);
  assert.deepEqual([concept.appName.minLength, concept.appName.maxLength], [4, 48]);
  assert.deepEqual([concept.interaction.properties.controls.minItems, concept.interaction.properties.controls.maxItems], [1, 4]);
  assert.equal(concept.bannedShapeAssessment.properties.plainDashboard.const, false);
  assert.deepEqual(toolSchemas.submit_artifact.properties.html['x-randomware-utf8-bytes'], { minimum: 10000, maximum: 40000 });
  assert.equal(toolSchemas.submit_artifact.properties.html['x-randomware-max-nodes'], 2000);
  assert.equal(toolSchemas.submit_artifact['x-randomware-capability'].jsonCalls, 30);
});

test('MCP validation enforces generated enum, range, and literal constraints', () => {
  const base = {
    requestId: 'r', runId: 'run', runContract: 'contract', promptVersion: 'concept-v1', styleId: 'teletext', appName: 'Name', premise: 'A premise that is long enough for the contract.', playerAction: 'A player action that is long enough for the contract.', apiIds: ['open-meteo', 'librivox'],
    causalChain: [{ order: 1, apiId: 'open-meteo', action: 'turn weather into the next rule' }, { order: 2, apiId: 'librivox', action: 'turn audio into the next rule' }], apiRoles: [{ apiId: 'open-meteo', essentialRole: 'Supplies the weather signal for the collision.', operations: ['forecast'] }, { apiId: 'librivox', essentialRole: 'Supplies the audio signal for the collision.', operations: ['book'] }],
    dependency: { fromApiId: 'open-meteo', to: 'rules', explanation: 'The weather determines the rule.' }, interaction: { controls: ['reveal'], outcome: 'Reveal one result.' },
    visualDirection: { style: 'bold', palette: 'cyan', typography: 'serif', motion: 'sweep' }, bannedShapeAssessment: { plainDashboard: false, plainSearch: false, plainQuiz: false, randomFactDisplay: false, thinClone: false, plausibleStartupPitch: false, explanation: 'This is not a generic shape.' }, noveltyDelta: 'A new collision.'
  };
  const badEnum = structuredClone(base); badEnum.dependency.to = 'api_output';
  assert.equal(validateToolArguments('submit_concept', badEnum).code, 'arguments_dependency_to_enum');
  const badRange = structuredClone(base); badRange.appName = 'x';
  assert.equal(validateToolArguments('submit_concept', badRange).code, 'arguments_appName_length');
  const badConst = structuredClone(base); badConst.bannedShapeAssessment.plainDashboard = true;
  assert.equal(validateToolArguments('submit_concept', badConst).code, 'arguments_bannedShapeAssessment_plainDashboard_const');
  const badStyle = structuredClone(base); badStyle.styleId = 'dark-theatre';
  assert.equal(validateToolArguments('submit_concept', badStyle).code, 'arguments_styleId_enum');
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
  assert.match(widget, /OPEN OUTSIDE CHAT/);
  assert.match(widget, /https:\/\/randomware\.example/);
  assert.doesNotMatch(widget, /new URL\(run\.statusUrl,window\.location/);
  assert.doesNotMatch(widget, /window\.location\.origin/);
});

test('widget exposes honest progress, symbol reels, heartbeat, and failure recovery', () => {
  const widget = widgetResource('https://randomware.example').contents[0].text;
  for (const id of ['steps', 'elapsed', 'heartbeat', 'composing', 'reassurance', 'failure-code', 'autopsy', 'failure-spin']) assert.match(widget, new RegExp(`id="${id}"`));
  for (const label of ['spin', 'concept', 'build', 'boot']) assert.match(widget, new RegExp(`data-step="${label}"`));
  assert.match(widget, /symbolStrip/);
  assert.match(widget, /data-state='shuffling'|dataset\.state=reveal\?'shuffling'/);
  assert.match(widget, /stoppedAt/);
  assert.match(widget, /is-flashing/);
  assert.match(widget, /server\. Its finished specimen will appear on the showcase/);
  assert.match(widget, /LAST SIGNAL/);
  assert.match(widget, /READ THE AUTOPSY/);
  assert.match(widget, /SPIN AGAIN/);
  assert.match(widget, /🐕/);
  assert.match(widget, /Dog CEO/);
  assert.match(widget, /get a dog image/);
  assert.match(widget, /If your submit call did not return a tool result, call submit_artifact again with the SAME requestId/);
  assert.match(widget, /If your submit call did not return a tool result, call submit_repair again with the SAME requestId/);
});

test('widget ships the approved RANDOMWARE.EXE machine surface', () => {
  const widget = widgetResource('https://randomware.example').contents[0].text;
  for (const text of ['RANDOMWARE.EXE — API SLOT DIVISION', 'KEEP THIS WINDOW OPEN.', 'STYLE CARTRIDGE:', 'BUILDING SPECIMEN', 'AUTO-NUDGE AT', '☒ BUILD DECEASED', 'READ THE AUTOPSY', 'LAST SIGNAL']) assert.match(widget, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  for (const token of ['--teal:#2aa8a0', '--grape:#6c3bd9', '--grape-deep:#4a2496', '--magenta:#e93a9a', '--tangerine:#f5a623', '--cream:#f2e7d8', '--paper:#f4efdc', '--stamp:#c0392b']) assert.ok(widget.includes(token), token);
  assert.match(widget, /prefers-reduced-motion/);
  assert.match(widget, /styleHistory/);
});

test('model recommendation and spin guard are projected across tool and widget surfaces', () => {
  const recommendation = 'BEST WITH GPT-5.6 SOL (HIGH REASONING)';
  const spinGuard = 'Do not call spin_apis unless the user explicitly asks to spin or the widget button initiated it';
  const noRespin = 'Do not self-spin again after an interruption';
  const widget = widgetResource('https://randomware.example').contents[0].text;
  assert.match(widget, new RegExp(recommendation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(widget, /spinInFlight/);
  assert.match(widget, /if\(spinInFlight\|\|activeWidgetRunId\)/);
  assert.match(widget, /spinInFlight=false/);
  assert.match(initializeResult().instructions, new RegExp(recommendation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const name of ['open_randomware', 'spin_apis']) {
    const description = tools().find((tool) => tool.name === name).description;
    assert.match(description, new RegExp(spinGuard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(description, new RegExp(noRespin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(description, new RegExp(recommendation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('registry symbols stay on display surfaces and out of run artifact inputs', () => {
  const run = { id: 'run_display', createdAt: Date.now(), phase: 'spinned', choreography: null, creationId: null, selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }], concept: null, conceptHistory: [], failure: null, revisions: [], events: [], repairCount: 0 };
  assert.equal(summary(run, 'https://randomware.example').selectedApis[0].symbol, undefined);
  assert.equal(summary(run, 'https://randomware.example').selectedApis[0].docsUrl, undefined);
});

test('widget refreshes server-owned choreography deadlines and clears stale phase state on repair', () => {
  const widget = widgetResource('https://randomware.example').contents[0].text;
  assert.match(widget, /statusUrl/);
  assert.match(widget, /setInterval/);
  assert.match(widget, /pollFailures/);
  assert.match(widget, /pollFailures>=3/);
  assert.match(widget, /status polling unavailable/);
  assert.match(widget, /syncTimerFromServer/);
  assert.match(widget, /phase:'repair_requested',choreography:null/);
  assert.match(widget, /record_choreography_failure.*requestId:crypto\.randomUUID\(\)/);
});

test('widget consumes the real CallToolResult envelope and ignores a stale mount result', () => {
  const run = { runId: 'run-widget', phase: 'spinned', selectedApis: [{ id: 'frankfurter', name: 'Frankfurter', operations: [] }] };
  const envelope = callToolResult(run, 'Selected 1 API.');
  assert.deepEqual(widgetToolResult(envelope), { output: run, isError: false });
  assert.deepEqual(widgetToolResult({ result: envelope }), { output: run, isError: false });
  assert.equal(widgetToolResult(callToolResult({ ok: true, registry: 18 }, 'Randomware slot mounted.')), null);
});

test('widget fallback prompt binds the active run and required build choreography', () => {
  const prompt = widgetBuildPrompt({ runId: 'run_fallback_123', styleId: 'teletext', style: { id: 'teletext', name: 'Teletext Dispatch', symbol: '📟', palette: 'primary blocks', typography: 'fixed grid', motion: 'page snap', era: 'Ceefax', avoid: 'no fake browser chrome' } });
  assert.match(prompt, /Use Randomware run run_fallback_123:/);
  assert.match(prompt, /call get_run/);
  assert.match(prompt, /then submit_concept/);
  assert.match(prompt, /submit the complete artifact via submit_artifact/);
  assert.match(prompt, /DRAWN_STYLE=.*teletext/);
  assert.match(prompt, /inline CSS only/i);
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
  for (const [index, surface] of surfaces.entries()) for (const literal of CONTRACT_PROMPT_LITERALS) assert.ok(surface.includes(literal), `contract_surface_${index}_missing:${literal}`);
});

test('deployed synthetic driver has no source contract mirror', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/test-synthetic-deployed.js'), 'utf8');
  assert.doesNotMatch(source, /require\(['"]\.\.\/src\//);
  assert.match(source, /tools\/list/);
  assert.match(source, /enumCases/);
  assert.match(source, /schemaCompleteness/);
  assert.match(source, /Promise\.allSettled/);
});

test('deployed e2e invokes the real browser semantic renderer', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/test-deployed.js'), 'utf8');
  assert.match(source, /browser-acceptance\.py/);
  assert.match(source, /RANDOMWARE_BROWSER_BASE/);
  assert.match(source, /RANDOMWARE_BROWSER_REQUIRE_AUDIO/);
  assert.match(source, /RANDOMWARE_BROWSER_AUDIO_API: 'wikimedia-commons-audio'/);
  assert.match(source, /fetch_failed:\$\{method\}:\$\{target\.pathname\}/);
  assert.match(source, /mcp_network_failed:/);
  assert.match(source, /semanticValues/);
  assert.match(source, /reconnectResponse/);
  assert.match(source, /Range: 'bytes=0-4095'/);
  assert.match(source, /cross-origin-resource-policy/);
  const syntheticSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/test-synthetic-deployed.js'), 'utf8');
  assert.match(syntheticSource, /audioEvidence\.apiId.*wikimedia-commons-audio/);
  assert.match(syntheticSource, /RANDOMWARE_DEPLOYED_AUDIO_SEED/);
  assert.match(syntheticSource, /selectedApis\.length, 3/);
  assert.doesNotMatch(syntheticSource, /assert\.ok\([^\n]+await mediaResponse\.text\(\)/);
  const browserSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/browser-acceptance.py'), 'utf8');
  assert.match(browserSource, /audioPlayback/);
  assert.match(browserSource, /RANDOMWARE_BROWSER_REQUIRE_AUDIO/);
  assert.match(browserSource, /currentTime/);
  assert.match(browserSource, /assert audio_playback\["currentTime"\] > 0/);
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

test('artifact-facing prompts teach the broker envelope, adapted payload, and selected examples', () => {
  const selectedApis = [{
    id: 'frankfurter',
    name: 'Frankfurter',
    operations: [{ id: 'rates', responseExample: { date: '2026-07-18', base: 'USD', quote: 'JPY', rate: 162.35 }, semanticFieldPaths: ['rate'] }]
  }];
  const surfaces = [
    initializeResult().instructions,
    conceptAcceptedPrompt('run_data_contract', selectedApis),
    widgetBuildPrompt({ runId: 'run_data_contract', selectedApis }),
    widgetRepairPrompt({ runId: 'run_data_contract', selectedApis, diagnostics: ['data path missing'] })
  ];
  for (const surface of surfaces) {
    assert.match(surface, /result\.data/);
    assert.match(surface, /broker_failure/);
    assert.match(surface, /adapted shape/i);
    assert.match(surface, /same-origin signed URL/i);
    assert.match(surface, /signed \/media/i);
    assert.match(surface, /Promise\.allSettled/);
    assert.match(surface, /partial results/i);
    assert.match(surface, /per-source failure line/i);
    assert.match(surface, /every selected API remains essential/i);
    assert.match(surface, /native audio controls/i);
    assert.match(surface, /fully visible and unobstructed/i);
    assert.match(surface, /explicit user action/i);
    assert.match(surface, /TUNING THE CARRIER/i);
    assert.match(surface, /fake buffering/i);
    assert.match(surface, /Target 10–16 KiB of compact, dense code/);
    assert.match(surface, /same requestId/i);
  }
  for (const surface of surfaces.slice(1)) {
    assert.match(surface, /"apiId":"frankfurter"/);
    assert.match(surface, /"rate":162\.35/);
    assert.match(surface, /"semanticFieldPaths":\["rate"\]/);
  }
  const accepted = conceptAcceptedPrompt('run_data_contract', selectedApis);
  const repair = widgetRepairPrompt({ runId: 'run_data_contract', selectedApis, diagnostics: ['data path missing'] });
  assert.match(accepted, /call submit_artifact again with the SAME requestId/);
  assert.match(repair, /call submit_repair again with the SAME requestId/);
  const syntheticSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/test-synthetic-deployed.js'), 'utf8');
  const browserSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../scripts/browser-acceptance.py'), 'utf8');
  for (const source of [syntheticSource, browserSource]) {
    assert.match(source, /TUNING THE CARRIER/);
    assert.doesNotMatch(source, /<audio[^>]+autoplay/i);
  }
});

test('artifact-facing prompts teach honest image arrival and fixed-operation behavior', () => {
  const surfaces = [
    initializeResult().instructions,
    ...tools().map((tool) => tool.description),
    conceptAcceptedPrompt('run_image_contract'),
    widgetBuildPrompt({ runId: 'run_image_contract' }),
    widgetRepairPrompt({ runId: 'run_image_contract', diagnostics: ['image missing'] }),
    widgetResource('https://randomware.example').contents[0].text
  ];
  for (const surface of surfaces) {
    assert.match(surface, /signed URL arrives in result\.data/i);
    assert.match(surface, /do not set img\.src/i);
    assert.match(surface, /honest.*image.*loading|image.*honest.*loading/i);
    assert.match(surface, /broken image icon/i);
    assert.match(surface, /fixed parameters|operation is fixed/i);
    assert.match(surface, /do not promise.*changes every call|not promise.*changes every call/i);
  }
});
