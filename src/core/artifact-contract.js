const { STYLE_COMMON_RULE, STYLE_DECK, STYLE_IDS } = require('./style-deck');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const text = (description, constraints = {}) => ({ type: 'string', description, ...constraints });
const integer = (description, constraints = {}) => ({ type: 'integer', description, ...constraints });
const bool = (description, constraints = {}) => ({ type: 'boolean', description, ...constraints });
const list = (description, items, constraints = {}) => ({ type: 'array', description, items, ...constraints });
const record = (description, properties, required = Object.keys(properties), constraints = {}) => ({ type: 'object', description, properties, required, ...constraints });

const id = (description, source) => text(description, { minLength: 1, maxLength: 160, ...(source ? { 'x-randomware-source': source } : {}) });
const operationIds = (source = 'selectedApis[].operations[].id') => list('One or more operation IDs exactly as exposed by the selected API contract.', id('Selected operation ID.', source), { minItems: 1, uniqueItems: true, 'x-randomware-source': source });

const MODEL_RECOMMENDATION = 'BEST WITH GPT-5.6 SOL (HIGH REASONING)';
const SPIN_GUARD = 'Do not call spin_apis unless the user explicitly asks to spin or the widget button initiated it. Do not self-spin again after an interruption.';
const IMAGE_RUNTIME_RULE = 'For image-bearing fields, do not set img.src until the signed URL arrives in result.data; show an honest image loading status nearby; the first render must not show a broken image icon.';
const FIXED_OPERATION_RULE = 'Registry operations use fixed parameters. Unless the selected source is inherently time-varying (weather, earthquakes, exchange rates, or live radio), do not promise changes every call; a fixed-operation gacha or summon must not claim fresh output each time.';

const ARTIFACT_BLOCKED_PATTERN_SOURCES = deepFreeze([
  String.raw`\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b`,
  String.raw`\b(?:import\s*\(|eval\s*\(|new\s+Function\b|Worker\s*\(|SharedWorker\s*\()`,
  String.raw`\b(?:localStorage|sessionStorage|indexedDB|document\.cookie|window\.openai)\b`,
  String.raw`(?:\bparent\b|\btop\b|\bopener\b)\s*[.\[]`,
  String.raw`(?:innerHTML|outerHTML|insertAdjacentHTML|srcdoc|javascript:)`,
  String.raw`\bdocument\s*\.\s*write\b`,
  String.raw`\b(?:location|history)\s*\.\s*(?:assign|replace|pushState|back|forward)\b`,
  String.raw`<\s*(?:iframe|frame|object|embed|applet|portal)\b`,
  String.raw`<\s*(?:input|textarea)[^>]+(?:password|credit-card|cvv|ssn|email|phone|address|bank|login|secret)`,
  String.raw`<\s*(?:script|link|style)[^>]+(?:src|href)=\s*["'](?:https?:|\/\/)`,
  String.raw`<\s*(?:img|audio|video|source|track)[^>]+(?:src|srcset)=\s*["'](?!data:|#|\/api\/)`,
  String.raw`<\s*(?:audio|video)\b[^>]*\sautoplay(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>)`,
  String.raw`url\(\s*["']?(?:https?:|\/\/|javascript:)`,
  String.raw`<\s*meta[^>]+http-equiv=\s*["']refresh`,
  String.raw`<\s*(?:svg|math|form)\b`,
  String.raw`\b(?:on[a-z]+|action)\s*=\s*["'][^"']*(?:https?:|javascript:|\/\/)`
]);

const ARTIFACT_CONTRACT = deepFreeze({
  markers: [
    'data-randomware="loading"',
    'data-randomware="error"',
    'data-randomware="interactive"',
    'data-randomware="attribution"'
  ],
  ready: 'window.randomware.ready()',
  call: 'window.randomware.call("API_ID","OPERATION_ID",{...})',
  bytes: '10,000–40,000 UTF-8 bytes',
  byteRange: { minimum: 10000, maximum: 40000 },
  viewport: '<meta name="viewport"',
  maxNodes: 2000,
  requiredDocumentParts: ['<!doctype html>', '<html', '<head', '<body'],
  requiredControlElements: ['button', 'input', 'select', 'textarea'],
  blockedPatternSources: ARTIFACT_BLOCKED_PATTERN_SOURCES,
  semanticRules: [
    'one complete UTF-8 HTML5 document with inline CSS and JavaScript',
    'one literal broker call for every selected API operation',
    'audio and video autoplay attributes are forbidden; playback starts only from explicit user action',
    IMAGE_RUNTIME_RULE,
    FIXED_OPERATION_RULE,
    'no direct network primitive, external URL, storage, cookie, parent/top/opener access, unsafe HTML sink, credential field, nested frame, form, SVG, MathML, worker, or dynamic code execution',
    'safe DOM text rendering, every selected API essential, declared dependency observable, and usable at 390 CSS pixels'
  ]
});

const CAPABILITY_CONTRACT = deepFreeze({
  ttlMs: 600000,
  quotas: { jsonCalls: 30, concurrentJson: 2, adaptedBytes: 1048576 },
  asset: { ttlMs: 600000, maxBytesEach: 2097152, maxBytesPerPage: 8388608, maxRedirects: 2 },
  media: { ttlMs: 300000, maxBytes: 8388608, concurrentStreams: 1, maxRedirects: 2 },
  bindings: ['creationId', 'revision', 'apiId', 'operationId'],
  semanticRules: ['signed token required', 'expiration required', 'selected operation binding required', 'asset and media URLs must be the exact server-resolved URL']
});

const RUNTIME_DATA_CONTRACT = deepFreeze({
  resolvedEnvelope: { ok: true, apiId: 'API_ID', operationId: 'OPERATION_ID', data: 'ADAPTED_OPERATION_PAYLOAD', bytes: 0, sourceUrl: 'FIXED_REGISTRY_URL', cached: false },
  payloadExpression: 'result.data',
  failure: 'Error("broker_failure")',
  semanticRules: [
    'window.randomware.call resolves the envelope {ok:true, apiId, operationId, data, bytes, sourceUrl, cached}',
    'the app payload is exactly result.data, never result.current or another top-level public API field',
    'result.data has the operation adapted shape shown in responseExample, never the public API raw shape; deep values may be bounded or truncated',
    'image-bearing fields are rewritten to same-origin signed URLs and must be assigned verbatim to img.src',
    IMAGE_RUNTIME_RULE,
    FIXED_OPERATION_RULE,
    'audio is available only through a signed /media URL in result.data.mediaUrl',
    'fetch selected APIs with per-call failure isolation using Promise.allSettled or equivalent; render partial results and an honest per-source failure line instead of blanking the entire app; every selected API remains essential to the concept',
    'native audio controls must be fully visible and unobstructed by labels, overlays, or decorative layers',
    'audio and video playback must begin only from an explicit user action; autoplay attributes and load-time or data-arrival play() calls are forbidden',
    'while waiting for mediaUrl, show an honest nearby source-resolution status such as TUNING THE CARRIER; assign audio.src only after mediaUrl arrives and do not present enabled-looking controls before then; fake buffering is forbidden',
    'ok:false or a missing mediaUrl is an honest per-source failure and must not blank the rest of the app'
  ]
});

const BANNED_SHAPE_PHRASES = deepFreeze([
  'plain dashboard',
  'plain search',
  'plain quiz',
  'random fact',
  'thin clone',
  'plausible startup',
  'clean minimal SaaS'
]);

const CONCEPT_SEMANTIC_RULES = deepFreeze([
  'apiIds, apiRoles, causalChain, and declaredApiUses must exactly cover the selected API set',
  'styleId must exactly equal the styleId drawn by spin_apis for this run',
  'apiRoles.operations must use only operation IDs exposed by the corresponding selected API',
  'dependency.fromApiId and optional dependency.toApiId must be selected API IDs',
  'causalChain order is one-based and contains one step per selected API',
  'appName is 2–4 words',
  `appName, premise, playerAction, and noveltyDelta must not contain: ${BANNED_SHAPE_PHRASES.join('; ')}`,
  'normalized appName plus premise must not exactly repeat a prior concept for the same API set'
]);

const TOOL_INSTRUCTIONS = deepFreeze({
  open_randomware: `Use this to mount the Randomware slot machine. ${SPIN_GUARD}`,
  spin_apis: `Use this after open_randomware to select a fresh bounded API collision; next call submit_concept. ${SPIN_GUARD}`,
  submit_concept: 'Use this after spin_apis to submit the complete concept contract; next call submit_artifact only after acceptance.',
  submit_artifact: 'Use this after concept acceptance to submit one complete HTML artifact; next call submit_repair only if requested. On acceptance, present the creationUrl to the user as a link. Do not list run IDs or internal details; the URL alone is sufficient.',
  submit_repair: 'Use this once after a validation or boot failure to submit one complete replacement artifact; no further repair follows. On acceptance, present the creationUrl to the user as a link. Do not list run IDs or internal details; the URL alone is sufficient.',
  get_run: 'Use this with a returned runId to recover the current run snapshot and named next tool.',
  mutate_creation: 'Use this on a completed creation to request a different concept while preserving the selected API set.',
  record_choreography_failure: 'Use this only after the active phase absolute deadline to close a silent or noncompliant run.'
});

const commonRunFields = {
  requestId: id('Client-generated idempotency key.', 'client-generated unique string'),
  runId: id('Run ID returned by spin_apis.', 'spin_apis.structuredContent.runId'),
  runContract: id('Opaque run contract returned by spin_apis; copy exactly.', 'spin_apis.structuredContent.runContract'),
  promptVersion: id('Prompt version returned by spin_apis; copy exactly.', 'spin_apis.structuredContent.promptVersion')
};

const conceptFields = {
  ...commonRunFields,
  styleId: text('Exact style cartridge ID drawn by spin_apis; copy it unchanged and commit visualDirection to that cartridge.', { enum: STYLE_IDS, examples: ['teletext'], 'x-randomware-source': 'spin_apis.structuredContent.styleId', 'x-randomware-exact-match': 'styleId' }),
  appName: text('Sincere collision name of 2–4 words.', { minLength: 4, maxLength: 48, examples: ['Signal Opera'] }),
  premise: text('One-sentence collision premise.', { minLength: 20, maxLength: 180, examples: ['Three unrelated public signals become one theatrical decision instrument.'] }),
  playerAction: text('One understandable action the player performs.', { minLength: 20, maxLength: 180, examples: ['Press the single control to reveal how the signals alter one another.'] }),
  apiIds: list('Exactly every selected API ID, once.', id('Selected API ID.', 'selectedApis[].id'), { minItems: 2, maxItems: 3, uniqueItems: true, 'x-randomware-source': 'selectedApis[].id', 'x-randomware-exact-coverage': 'selectedApis' }),
  causalChain: list('One ordered causal action for every selected API.', record('One causal step.', {
    order: integer('One-based causal order.', { minimum: 1, maximum: 3 }),
    apiId: id('Selected API ID used at this step.', 'selectedApis[].id'),
    action: text('How this API changes the next state.', { minLength: 8, maxLength: 120, examples: ['turn this signal into the next interaction rule'] })
  }), { minItems: 2, maxItems: 3, 'x-randomware-exact-coverage': 'selectedApis' }),
  apiRoles: list('One essential role for every selected API.', record('One selected API role.', {
    apiId: id('Selected API ID.', 'selectedApis[].id'),
    essentialRole: text('Why this API is indispensable to the collision.', { minLength: 15, maxLength: 180, examples: ['Supplies an essential signal that changes the next interaction state.'] }),
    operations: operationIds()
  }), { minItems: 2, maxItems: 3, 'x-randomware-exact-coverage': 'selectedApis' }),
  dependency: record('At least one causal dependency between an API and the app.', {
    fromApiId: id('Selected API ID whose result causes the dependency.', 'selectedApis[].id'),
    to: text('The exact target axis of the dependency.', { enum: ['api_input', 'rules', 'interface_state'], examples: ['rules'] }),
    toApiId: id('Optional selected API ID receiving the dependency.', 'selectedApis[].id'),
    explanation: text('How the dependency is observable.', { minLength: 1, maxLength: 240, examples: ['The first signal changes the rule used to interpret the next signal.'] })
  }, ['fromApiId', 'to', 'explanation']),
  interaction: record('Concrete interaction contract.', {
    controls: list('One to four concrete controls.', text('Visible concrete control.', { minLength: 1, examples: ['reveal'] }), { minItems: 1, maxItems: 4 }),
    outcome: text('What visibly changes after interaction.', { minLength: 8, maxLength: 180, examples: ['The stage reveals a changing result.'] })
  }),
  visualDirection: record('Commit every field to the exact style cartridge drawn by spin_apis; never substitute generic minimal SaaS.', {
    style: text('How the drawn cartridge shapes the complete interface.', { minLength: 4, maxLength: 100, examples: ['teletext broadcast interaction'] }),
    palette: text('Palette using the drawn cartridge vocabulary.', { minLength: 4, maxLength: 100, examples: ['primary blocks on signal black'] }),
    typography: text('Typography using the drawn cartridge vocabulary.', { minLength: 4, maxLength: 100, examples: ['fixed character grid'] }),
    motion: text('Motion using the drawn cartridge vocabulary.', { minLength: 4, maxLength: 100, examples: ['row reveal and page snap'] })
  }),
  bannedShapeAssessment: record('Honest banned-shape assessment; every flag must be literal false.', {
    plainDashboard: bool('Must be literal false.', { const: false }),
    plainSearch: bool('Must be literal false.', { const: false }),
    plainQuiz: bool('Must be literal false.', { const: false }),
    randomFactDisplay: bool('Must be literal false.', { const: false }),
    thinClone: bool('Must be literal false.', { const: false }),
    plausibleStartupPitch: bool('Must be literal false.', { const: false }),
    explanation: text('Why the concept avoids every banned shape.', { minLength: 12, maxLength: 240, examples: ['This is a staged causal collision, not a generic product surface.'] })
  }),
  noveltyDelta: text('How this differs from prior concepts for the same API set.', { minLength: 8, maxLength: 180, examples: ['The sources change the interaction rules instead of decorating a report.'] })
};

const artifactHtml = text('Complete artifact HTML. Follow every x-randomware constraint and the full prompt contract.', {
  'x-randomware-utf8-bytes': ARTIFACT_CONTRACT.byteRange,
  'x-randomware-max-nodes': ARTIFACT_CONTRACT.maxNodes,
  'x-randomware-required-literals': [...ARTIFACT_CONTRACT.markers, ARTIFACT_CONTRACT.ready, ARTIFACT_CONTRACT.call, ARTIFACT_CONTRACT.viewport],
  'x-randomware-blocked-patterns': ARTIFACT_CONTRACT.blockedPatternSources,
  'x-randomware-semantic-rules': ARTIFACT_CONTRACT.semanticRules
});

const artifactFields = {
  ...commonRunFields,
  conceptId: id('Accepted concept ID returned by submit_concept; copy exactly.', 'submit_concept.structuredContent.conceptId'),
  html: artifactHtml,
  declaredApiUses: list('Exactly every selected API and every selected operation used by the artifact.', record('One selected API use declaration.', {
    apiId: id('Selected API ID.', 'selectedApis[].id'),
    operations: operationIds()
  }), { minItems: 2, maxItems: 3, 'x-randomware-exact-coverage': 'selectedApis' })
};

const attachRuntime = (schema) => ({ ...schema, 'x-randomware-capability': CAPABILITY_CONTRACT.quotas, 'x-randomware-runtime': CAPABILITY_CONTRACT });

const TOOL_SCHEMAS = deepFreeze({
  open_randomware: record('Mount the Randomware widget.', {}, []),
  spin_apis: record('Select a bounded API collision.', {
    seed: text('Optional deterministic selector seed.', { minLength: 1, maxLength: 160, examples: ['collision-seed'] }),
    styleHistory: list('Up to three most recent style cartridge IDs from this widget session.', text('Prior style cartridge ID.', { enum: STYLE_IDS }), { maxItems: 3, uniqueItems: true }),
    requestId: id('Client-generated idempotency key.', 'client-generated unique string')
  }, ['requestId']),
  submit_concept: attachRuntime({ ...record('Submit the complete ARCHITECTURE §4.2 concept contract.', conceptFields), 'x-randomware-semantic-rules': CONCEPT_SEMANTIC_RULES }),
  submit_artifact: attachRuntime(record('Submit the complete ARCHITECTURE §4.3 artifact contract.', artifactFields)),
  submit_repair: attachRuntime(record('Submit the one allowed complete replacement artifact.', {
    ...artifactFields,
    failedRevisionId: id('Failed revision ID from the repair result.', 'submit_artifact.structuredContent.revision'),
    diagnosticCodes: list('Exact diagnostic codes returned for the failed artifact.', text('Exact server diagnostic code.', { minLength: 1 }), { minItems: 1 })
  })),
  get_run: record('Recover a run snapshot.', { runId: id('Run ID to recover.', 'prior tool result runId') }),
  mutate_creation: record('Request a new concept while preserving the API set.', {
    creationId: id('Creation ID to mutate.', 'completed run creationId'),
    requestId: id('Client-generated idempotency key.', 'client-generated unique string'),
    premise: text('Replacement premise.', { minLength: 1, maxLength: 180, examples: ['A different causal treatment of the same selected APIs.'] })
  }),
  record_choreography_failure: record('Record terminal choreography abandonment.', {
    runId: id('Run ID to close.', 'active runId'),
    requestId: id('Client-generated idempotency key.', 'client-generated unique string'),
    phase: text('Current choreography phase.', { enum: ['concept', 'artifact', 'repair'] }),
    code: text('Stable failure code.', { enum: ['choreography_timeout'] })
  })
});

function compactSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(compactSchema);
  const output = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'description' || key === 'examples') continue;
    output[key] = compactSchema(value);
  }
  return output;
}

const CONTRACT_MANIFEST = deepFreeze({
  tools: Object.fromEntries(Object.entries(TOOL_SCHEMAS).map(([name, schema]) => [name, compactSchema(schema)])),
  conceptSemanticRules: CONCEPT_SEMANTIC_RULES,
  toolInstructions: TOOL_INSTRUCTIONS,
  artifact: ARTIFACT_CONTRACT,
  capability: CAPABILITY_CONTRACT,
  runtimeData: RUNTIME_DATA_CONTRACT,
  styleDeck: STYLE_DECK,
  styleCommonRule: STYLE_COMMON_RULE
});

const ARTIFACT_CONTRACT_LITERALS = deepFreeze([
  ...ARTIFACT_CONTRACT.markers,
  ARTIFACT_CONTRACT.ready,
  ARTIFACT_CONTRACT.call,
  ARTIFACT_CONTRACT.bytes,
  ARTIFACT_CONTRACT.viewport
]);

const CONTRACT_PROMPT_LITERALS = deepFreeze([
  'RANDOMWARE_CONTRACT_JSON=',
  '"enum":["api_input","rules","interface_state"]',
  '"minLength":4,"maxLength":48',
  '"minItems":1,"maxItems":4',
  '"const":false',
  '"minimum":10000,"maximum":40000',
  '"jsonCalls":30',
  '"concurrentJson":2',
  '"adaptedBytes":1048576',
  '"payloadExpression":"result.data"',
  'Error(\\"broker_failure\\")',
  'Promise.allSettled',
  'native audio controls',
  'explicit user action',
  'TUNING THE CARRIER',
  'fake buffering',
  'Target 10–16 KiB of compact, dense code',
  'same requestId'
]);

function artifactContractPrompt() {
  return [
    'Artifact contract — copy these literals exactly:',
    ARTIFACT_CONTRACT.markers.join(', '),
    `${ARTIFACT_CONTRACT.ready};`,
    `one literal ${ARTIFACT_CONTRACT.call} per selected operation`,
    `${ARTIFACT_CONTRACT.bytes};`,
    'Target 10–16 KiB of compact, dense code; the 40 KiB ceiling is a hard cap, not a goal.',
    `include a viewport tag beginning ${ARTIFACT_CONTRACT.viewport}`,
    'Runtime data contract: window.randomware.call resolves {ok:true, apiId, operationId, data, bytes, sourceUrl, cached}; on any HTTP failure it rejects with Error("broker_failure"). The app payload is exactly result.data.',
    'result.data uses the operation ADAPTED shape from responseExample, never the public API raw shape; deep values may be bounded/truncated. Image-bearing fields are same-origin signed URLs: use them verbatim in img.src. Audio is exposed only by a signed /media URL in result.data.mediaUrl.',
    IMAGE_RUNTIME_RULE,
    FIXED_OPERATION_RULE,
    'Fetch selected APIs with per-call failure isolation using Promise.allSettled or equivalent. Render partial results and an honest per-source failure line instead of blanking the entire app. Every selected API remains essential to the concept; runtime degradation must stay honest.',
    'When audio is present, native audio controls must be fully visible and unobstructed by labels, overlays, or decorative layers.',
    'Audio and video playback must begin only from an explicit user action such as a click. Never use an autoplay attribute, and never call play() on load or merely when data arrives.',
    'Until result.data.mediaUrl arrives, show an honest status next to the audio element such as TUNING THE CARRIER. Assign audio.src only after mediaUrl arrives and do not make controls look enabled before then. Fake buffering is forbidden. Treat ok:false or a missing mediaUrl as the existing honest per-source failure case.',
    'If a submit_artifact or submit_repair call returns no tool result or is interrupted, repeat the same call once with the same requestId; the server is idempotent and will not accept it twice.'
  ].join(' ');
}

function contractPrompt() {
  return `${artifactContractPrompt()}\nRANDOMWARE_CONTRACT_JSON=${JSON.stringify(CONTRACT_MANIFEST)}`;
}

function promptSurface(instruction, extra = '') {
  return `${instruction}\n\n${contractPrompt()}${extra ? `\n\n${extra}` : ''}`;
}

function selectedOperationExamples(selectedApis = []) {
  return (Array.isArray(selectedApis) ? selectedApis : []).map((api) => ({
    apiId: api.id || api.apiId,
    operations: (api.operations || []).map((operation) => ({ operationId: operation.id, responseExample: operation.responseExample, outputSchema: operation.outputSchema, semanticFieldPaths: operation.semanticFieldPaths }))
  })).filter((api) => api.apiId && api.operations.length);
}

function selectedExamplesPrompt(selectedApis) {
  const examples = selectedOperationExamples(selectedApis);
  return examples.length ? `SELECTED_ADAPTED_RESPONSE_EXAMPLES=${JSON.stringify(examples)}` : '';
}

function selectedStylePrompt(style) {
  if (!style || !style.id) return '';
  return `DRAWN_STYLE=${JSON.stringify(style)}\nSTYLE_COMMON_RULE=${STYLE_COMMON_RULE}`;
}

function selectedContextPrompt(selectedApis, style) {
  return [selectedExamplesPrompt(selectedApis), selectedStylePrompt(style)].filter(Boolean).join('\n');
}

function conceptAcceptedPrompt(runId, selectedApis = [], style = null) {
  return promptSurface(`Concept accepted for ${runId}. Next, submit the complete artifact via submit_artifact. If your submit call did not return a tool result, call submit_artifact again with the SAME requestId — the server is idempotent and will not accept it twice.`, selectedContextPrompt(selectedApis, style));
}

function artifactRepairPrompt({ runId = 'unknown', diagnostics = [], selectedApis = [], style = null } = {}) {
  const exactDiagnostics = Array.isArray(diagnostics) && diagnostics.length ? diagnostics : ['the validator supplied no diagnostic detail'];
  return promptSurface(`Artifact rejected for Randomware run ${runId}. Use submit_repair once with a complete replacement artifact. If your submit call did not return a tool result, call submit_repair again with the SAME requestId — the server is idempotent and will not accept it twice. Target 10–16 KiB of compact, dense code; the 40 KiB ceiling is a hard cap, not a goal. Exact rejection diagnostics: ${exactDiagnostics.map((diagnostic) => String(diagnostic)).join('; ')}`, selectedContextPrompt(selectedApis, style));
}

module.exports = {
  MODEL_RECOMMENDATION,
  SPIN_GUARD,
  IMAGE_RUNTIME_RULE,
  FIXED_OPERATION_RULE,
  ARTIFACT_CONTRACT,
  ARTIFACT_CONTRACT_LITERALS,
  ARTIFACT_BLOCKED_PATTERN_SOURCES,
  BANNED_SHAPE_PHRASES,
  CAPABILITY_CONTRACT,
  RUNTIME_DATA_CONTRACT,
  CONCEPT_SEMANTIC_RULES,
  CONTRACT_MANIFEST,
  CONTRACT_PROMPT_LITERALS,
  TOOL_SCHEMAS,
  TOOL_INSTRUCTIONS,
  artifactContractPrompt,
  contractPrompt,
  promptSurface,
  conceptAcceptedPrompt,
  artifactRepairPrompt,
  selectedOperationExamples,
  selectedExamplesPrompt,
  selectedStylePrompt,
  selectedContextPrompt,
  deepFreeze
};
