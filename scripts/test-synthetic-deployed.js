const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const vm = require('node:vm');

function clone(value) { return structuredClone(value); }

function parts(path) { return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean); }

function setPath(target, path, value) {
  const segments = parts(path); let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) cursor = cursor[segments[index]];
  cursor[segments.at(-1)] = value;
}

function deletePath(target, path) {
  const segments = parts(path); let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) cursor = cursor[segments[index]];
  delete cursor[segments.at(-1)];
}

function schemaAt(schema, path) {
  let cursor = schema;
  for (const part of parts(path)) {
    if (cursor?.type === 'array') { cursor = cursor.items; if (/^\d+$/.test(part)) continue; }
    if (cursor?.type === 'object') cursor = cursor.properties[part];
  }
  return cursor;
}

function walkSchema(schema, visit, path = '') {
  visit(schema, path);
  if (schema?.type === 'object') for (const [key, child] of Object.entries(schema.properties || {})) walkSchema(child, visit, path ? `${path}.${key}` : key);
  if (schema?.type === 'array') walkSchema(schema.items, visit, `${path}[0]`);
}

function requiredPaths(schema, prefix = '') {
  const paths = [];
  if (schema?.type !== 'object') return paths;
  for (const key of schema.required || []) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    const child = schema.properties[key];
    if (child?.type === 'object') paths.push(...requiredPaths(child, path));
    if (child?.type === 'array' && child.items?.type === 'object') paths.push(...requiredPaths(child.items, `${path}[0]`));
  }
  return paths;
}

function compactSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(compactSchema);
  return Object.fromEntries(Object.entries(schema).filter(([key]) => !['description', 'examples'].includes(key)).map(([key, value]) => [key, compactSchema(value)]));
}

function extractManifest(surface) {
  const text = String(surface || ''); const marker = 'RANDOMWARE_CONTRACT_JSON='; const start = text.lastIndexOf(marker);
  assert.ok(start >= 0, 'contract_manifest_missing');
  const jsonStart = text.indexOf('{', start + marker.length); assert.ok(jsonStart >= 0, 'contract_manifest_object_missing');
  let depth = 0; let quoted = false; let escaped = false;
  for (let index = jsonStart; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return JSON.parse(text.slice(jsonStart, index + 1));
  }
  throw new Error('contract_manifest_unterminated');
}

function assertWidgetScriptParses(widgetText) {
  const script = String(widgetText || '').match(/<script>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script, 'widget_script_missing');
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'deployed-randomware-widget.js' }), 'widget_script_syntax_failed');
}

function schemaCompleteness(tools, manifest) {
  let constraintCount = 0;
  for (const tool of tools) {
    const publicSchema = compactSchema(tool.inputSchema);
    assert.deepEqual(publicSchema, manifest.tools[tool.name], `schema_manifest_drift:${tool.name}`);
    for (const path of requiredPaths(tool.inputSchema)) assert.ok(schemaAt(tool.inputSchema, path), `required_schema_path_missing:${tool.name}:${path}`);
    walkSchema(tool.inputSchema, (node) => {
      for (const key of ['required', 'enum', 'const', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum', 'x-randomware-utf8-bytes', 'x-randomware-max-nodes', 'x-randomware-required-literals', 'x-randomware-blocked-patterns']) if (Object.prototype.hasOwnProperty.call(node || {}, key)) constraintCount += 1;
    });
  }
  const concept = tools.find((tool) => tool.name === 'submit_concept').inputSchema;
  const artifact = tools.find((tool) => tool.name === 'submit_artifact').inputSchema;
  assert.deepEqual(concept['x-randomware-semantic-rules'], manifest.conceptSemanticRules, 'concept_semantic_rules_missing');
  assert.deepEqual(artifact.properties.html['x-randomware-utf8-bytes'], manifest.artifact.byteRange, 'artifact_byte_range_missing');
  assert.equal(artifact.properties.html['x-randomware-max-nodes'], manifest.artifact.maxNodes, 'artifact_node_limit_missing');
  for (const literal of [...manifest.artifact.markers, manifest.artifact.ready, manifest.artifact.call, manifest.artifact.viewport]) assert.ok(artifact.properties.html['x-randomware-required-literals'].includes(literal), `artifact_schema_literal_missing:${literal}`);
  assert.deepEqual(artifact.properties.html['x-randomware-blocked-patterns'], manifest.artifact.blockedPatternSources, 'artifact_blocked_patterns_missing');
  assert.deepEqual(artifact['x-randomware-runtime'], manifest.capability, 'capability_contract_missing');
  return constraintCount;
}

function fitString(schema, fallback) {
  let value = String(schema.examples?.[0] || fallback || 'bounded value');
  const minimum = schema.minLength || 0; const maximum = schema.maxLength || Infinity;
  while (value.length < minimum) value += ' bounded';
  return value.slice(0, maximum);
}

function modelValue(schema, context, path = '', currentApi = null, apiIndex = 0) {
  const key = parts(path).at(-1) || '';
  if (schema.type === 'object') {
    const output = {};
    for (const required of schema.required || []) output[required] = modelValue(schema.properties[required], context, path ? `${path}.${required}` : required, currentApi, apiIndex);
    return output;
  }
  if (schema.type === 'array') {
    if (key === 'apiIds') return context.run.selectedApis.map((api) => api.id);
    if (['causalChain', 'apiRoles', 'declaredApiUses'].includes(key)) return context.run.selectedApis.map((api, index) => modelValue(schema.items, context, `${path}[${index}]`, api, index));
    if (key === 'operations' && currentApi) return currentApi.operations.map((operation) => operation.id);
    const length = Math.max(schema.minItems || 1, 1);
    return Array.from({ length }, (_, index) => modelValue(schema.items, context, `${path}[${index}]`, currentApi, index));
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'integer') return key === 'order' ? apiIndex + 1 : (schema.minimum || 1);
  if (schema.type === 'boolean') return false;
  if (key === 'requestId') return fitString(schema, `${context.tag}-${context.requestLabel || 'request'}`);
  if (key === 'runId') return context.run.runId;
  if (key === 'runContract') return context.run.runContract;
  if (key === 'promptVersion') return context.run.promptVersion;
  if (key === 'conceptId') return context.run.conceptId;
  if (key === 'creationId') return context.creationId;
  if (key === 'apiId' && currentApi) return currentApi.id;
  if (key === 'fromApiId') return context.run.selectedApis[0].id;
  if (key === 'toApiId') return context.run.selectedApis[1]?.id;
  if (key === 'failedRevisionId') return '1';
  if (key === 'html') return context.html;
  return fitString(schema, key.replace(/([A-Z])/g, ' $1').toLowerCase());
}

function artifactFromVisibleContract(run, manifest) {
  const contract = manifest.artifact;
  const calls = run.selectedApis.flatMap((api) => api.operations.map((operation) => `window.randomware.call(${JSON.stringify(api.id)},${JSON.stringify(operation.id)},{})`));
  const markers = Object.fromEntries(contract.markers.map((literal) => [literal.match(/"([^"]+)"/)?.[1], literal]));
  const script = `const output=document.querySelector('#output');const audio=document.querySelector('#audio');document.querySelector('#go').addEventListener('click',async()=>{output.textContent='Loading bounded signals…';try{const values=await Promise.all([${calls.join(',')}]);output.textContent=values.map((value)=>JSON.stringify(value.data||value)).join('\\n');const media=values.map((value)=>value.data?.mediaUrl).find(Boolean);if(media){audio.src=media;audio.hidden=false}}catch(error){output.textContent='Safe broker failure: '+error.message}});${contract.ready};`;
  let html = `<!doctype html><html><head><meta charset="utf-8">${contract.viewport} content="width=device-width,initial-scale=1"><title>Signal Opera</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px;background:#100c24;color:#fff0c7;font:16px Georgia,serif}main{max-width:780px;margin:auto;border:3px solid #fff0c7;padding:28px;box-shadow:12px 12px 0 #e8614f}h1{font-size:clamp(3rem,12vw,7rem);line-height:.8}button{padding:14px 20px;background:#55e6c1;border:0;font-weight:800}pre{white-space:pre-wrap;border-left:4px solid #e8614f;padding:16px}audio{width:100%;margin-top:18px}</style></head><body><main><section ${markers.loading}>Signals are waiting.</section><h1>Signal Opera</h1><button id="go" type="button">Conduct the collision</button><section ${markers.interactive}><pre id="output" aria-live="polite">The stage is ready.</pre><audio id="audio" controls hidden></audio></section><section ${markers.error}>A bounded failure will be shown in the output.</section><footer ${markers.attribution}>Randomware mediated API specimen.</footer></main><script>${script}</script></body></html>`;
  const target = contract.byteRange.minimum + 768; const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes < target) html = html.replace('</body>', `<!-- ${'bounded collision '.repeat(Math.ceil((target - bytes) / 18))} --></body>`);
  assert.ok(Buffer.byteLength(html, 'utf8') >= contract.byteRange.minimum && Buffer.byteLength(html, 'utf8') <= contract.byteRange.maximum, 'visible_contract_artifact_size');
  return html;
}

function wrongType(schema) {
  if (schema?.type === 'string') return 123;
  if (schema?.type === 'integer') return 'not-an-integer';
  if (schema?.type === 'boolean') return 'not-a-boolean';
  if (schema?.type === 'array') return {};
  if (schema?.type === 'object') return 'not-an-object';
  return null;
}

function rangeCases(schema) {
  const cases = [];
  walkSchema(schema, (node, path) => {
    if (!path) return;
    if (node.type === 'string' && node.minLength !== undefined) cases.push({ path, value: 'x'.repeat(Math.max(0, node.minLength - 1)), kind: 'minLength' });
    if (node.type === 'string' && node.maxLength !== undefined) cases.push({ path, value: 'x'.repeat(node.maxLength + 1), kind: 'maxLength' });
    if (node.type === 'array' && node.minItems !== undefined) cases.push({ path, value: Array.from({ length: Math.max(0, node.minItems - 1) }, () => modelValue(node.items, { run: { selectedApis: [] }, tag: 'range' })), kind: 'minItems' });
    if (node.type === 'integer' && node.minimum !== undefined) cases.push({ path, value: node.minimum - 1, kind: 'minimum' });
    if (node.type === 'integer' && node.maximum !== undefined) cases.push({ path, value: node.maximum + 1, kind: 'maximum' });
  });
  return cases;
}

async function runSynthetic(base) {
  const mcp = (message) => fetch(`${base}/mcp`, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify(message) });
  const tag = `synthetic-${Date.now()}-${randomUUID()}`;
  const initialize = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'randomware-visible-contract-driver', version: '2.0.0' } } });
  assert.equal(initialize.status, 200, `synthetic_initialize:${initialize.status}`);
  const initializeBody = await initialize.json(); const manifest = extractManifest(initializeBody.result?.instructions);
  const ready = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' }); assert.equal(ready.status, 202, `synthetic_initialized:${ready.status}`);
  const toolsResponse = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }); assert.equal(toolsResponse.status, 200);
  const tools = (await toolsResponse.json()).result.tools; assert.equal(tools.length, 8); const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  for (const tool of tools) assert.deepEqual(extractManifest(tool.description), manifest, `tool_prompt_manifest_drift:${tool.name}`);
  const constraintCount = schemaCompleteness(tools, manifest);

  const resourceResponse = await mcp({ jsonrpc: '2.0', id: 2.5, method: 'resources/read', params: { uri: 'ui://widget/randomware.html' } }); assert.equal(resourceResponse.status, 200);
  const widgetText = (await resourceResponse.json()).result.contents[0].text; assertWidgetScriptParses(widgetText); assert.deepEqual(extractManifest(widgetText), manifest, 'widget_prompt_manifest_drift');
  assert.ok(widgetText.includes('submit the complete artifact via submit_artifact'), 'widget_build_prompt_missing');
  assert.ok(widgetText.includes('Exact rejection diagnostics:'), 'widget_repair_prompt_missing');

  let callId = 10;
  const call = async (name, args, expectedStatus = 200) => {
    const response = await mcp({ jsonrpc: '2.0', id: callId++, method: 'tools/call', params: { name, arguments: args } }); const body = await response.json();
    assert.doesNotMatch(JSON.stringify(body), /TypeError|Cannot read properties|is not a function/);
    assert.equal(response.status, expectedStatus, `tool_status:${name}:${response.status}:${JSON.stringify(body)}`);
    if (expectedStatus === 200) {
      assert.ok(Array.isArray(body.result?.content) && body.result.content.every((block) => block.type === 'text' && block.text.trim()), `call_tool_content:${name}`);
      assert.ok(Object.prototype.hasOwnProperty.call(body.result || {}, 'structuredContent'), `call_tool_structured:${name}`);
      const output = body.result.structuredContent;
      if (output?.statusUrl) { const statusUrl = new URL(output.statusUrl); assert.equal(statusUrl.protocol, 'https:'); assert.equal(statusUrl.origin, base); }
      if (output?.creationUrl) { const creationUrl = new URL(output.creationUrl); assert.equal(creationUrl.protocol, 'https:'); assert.equal(creationUrl.origin, base); }
      if (output?.creationId && ['completed', 'failed'].includes(output.phase)) assert.ok(output.creationUrl, `creation_url_missing:${name}`);
    }
    return body;
  };

  let run;
  for (const seed of ['contract-audio-2433', 'contract-audio-1306', 'contract-audio-3291', 'contract-audio-disabled-1217']) {
    const spun = await call('spin_apis', { seed, requestId: `${tag}-${seed}` }); const candidate = spun.result.structuredContent;
    if (candidate.selectedApis.map((api) => api.id).sort().join('|') === 'librivox|nager-date|radio-browser') { run = candidate; break; }
  }
  assert.ok(run, 'three_api_audio_selection_failed');
  const html = artifactFromVisibleContract(run, manifest);
  const conceptArgs = modelValue(byName.submit_concept.inputSchema, { run, tag, requestLabel: 'concept' });
  const concept = await call('submit_concept', conceptArgs); assert.equal(concept.result.structuredContent.phase, 'concept_accepted'); assert.deepEqual(extractManifest(concept.result.content[0].text), manifest, 'concept_result_manifest_drift');
  const acceptedRun = concept.result.structuredContent;
  const artifactArgs = modelValue(byName.submit_artifact.inputSchema, { run: acceptedRun, tag, requestLabel: 'artifact', html });
  const artifact = await call('submit_artifact', artifactArgs); assert.equal(artifact.result.structuredContent.phase, 'completed'); const completed = artifact.result.structuredContent;
  const status = await fetch(completed.statusUrl); assert.equal(status.status, 200); const statusBody = await status.json(); assert.equal(statusBody.creationId, completed.creationId); assert.equal(new URL(statusBody.statusUrl).origin, base); assert.equal(new URL(statusBody.creationUrl).origin, base);

  const runtime = await fetch(`${base}/run/${completed.creationId}`); const runtimeHtml = await runtime.text(); const tokenLiteral = runtimeHtml.match(/capability:("(?:\\.|[^"])*")/); assert.ok(tokenLiteral, 'audio_capability_missing'); const capability = JSON.parse(tokenLiteral[1]);
  let audioEvidence = null; const audioFailures = [];
  for (const apiId of ['radio-browser', 'librivox']) {
    const audioApi = acceptedRun.selectedApis.find((api) => api.id === apiId); const audioOperation = audioApi.operations[0];
    const audioCall = await fetch(`${base}/api/runtime/call`, { method: 'POST', headers: { Origin: 'null', 'Content-Type': 'application/json' }, body: JSON.stringify({ creationId: completed.creationId, revision: 1, apiId: audioApi.id, operationId: audioOperation.id, params: {}, capability }) });
    if (audioCall.status !== 200) { audioFailures.push(`${apiId}:broker:${audioCall.status}:${await audioCall.text()}`); continue; }
    const audioBody = await audioCall.json(); const mediaUrl = audioBody.data?.mediaUrl;
    if (!mediaUrl || new URL(mediaUrl).origin !== base || !new URL(mediaUrl).pathname.startsWith('/media/')) { audioFailures.push(`${apiId}:signed_url`); continue; }
    const mediaResponse = await fetch(mediaUrl, { headers: { Range: 'bytes=0-4095' } }); const mediaType = mediaResponse.headers.get('content-type') || '';
    if (![200, 206].includes(mediaResponse.status) || !(mediaType.startsWith('audio/') || mediaType === 'application/ogg')) { audioFailures.push(`${apiId}:stream:${mediaResponse.status}:${mediaType}:${await mediaResponse.text()}`); continue; }
    const reader = mediaResponse.body?.getReader();
    if (!reader) { audioFailures.push(`${apiId}:body_missing`); continue; }
    const firstChunk = await reader.read();
    if (firstChunk.done || !firstChunk.value?.byteLength) { audioFailures.push(`${apiId}:empty`); continue; }
    await reader.cancel(); audioEvidence = { apiId, status: mediaResponse.status, contentType: mediaType, firstChunkBytes: firstChunk.value.byteLength }; break;
  }
  assert.ok(audioEvidence, `audio_streams_failed:${audioFailures.join('|')}`);

  const repairSpinBody = await call('spin_apis', { seed: `${tag}-repair`, requestId: `${tag}-repair-spin` }); const repairRun = repairSpinBody.result.structuredContent;
  const repairConceptArgs = modelValue(byName.submit_concept.inputSchema, { run: repairRun, tag, requestLabel: 'repair-concept' });
  const repairConcept = await call('submit_concept', repairConceptArgs); const repairState = repairConcept.result.structuredContent;
  const badArtifactArgs = modelValue(byName.submit_artifact.inputSchema, { run: repairState, tag, requestLabel: 'bad-artifact', html: '<!doctype html><html><body>invalid</body></html>' });
  const rejected = await call('submit_artifact', badArtifactArgs); assert.equal(rejected.result.isError, true); assert.deepEqual(extractManifest(rejected.result.content[0].text), manifest, 'repair_result_manifest_drift');

  const bases = {
    open_randomware: {},
    spin_apis: modelValue(byName.spin_apis.inputSchema, { run, tag, requestLabel: 'fuzz-spin' }),
    submit_concept: conceptArgs,
    submit_artifact: artifactArgs,
    submit_repair: modelValue(byName.submit_repair.inputSchema, { run: repairState, tag, requestLabel: 'fuzz-repair', html }),
    get_run: modelValue(byName.get_run.inputSchema, { run, tag }),
    mutate_creation: modelValue(byName.mutate_creation.inputSchema, { run, tag, creationId: completed.creationId }),
    record_choreography_failure: modelValue(byName.record_choreography_failure.inputSchema, { run: repairRun, tag })
  };

  let fuzzCases = 0; let enumCases = 0; let constCases = 0; let rangeCaseCount = 0;
  const assertStructured4xx = async (name, args, field, label) => {
    const result = await call(name, args, 400); fuzzCases += 1; const code = String(result.error?.code || '');
    assert.ok(code.toLowerCase().includes(field.toLowerCase()), `fuzz_code:${name}:${label}:${code}`);
  };
  for (const tool of tools) {
    const schema = tool.inputSchema;
    for (const path of requiredPaths(schema)) {
      const field = parts(path).filter((part) => !/^\d+$/.test(part)).at(-1);
      const missing = clone(bases[tool.name]); deletePath(missing, path); await assertStructured4xx(tool.name, missing, field, `${path}:missing`);
      const mistyped = clone(bases[tool.name]); setPath(mistyped, path, wrongType(schemaAt(schema, path))); await assertStructured4xx(tool.name, mistyped, field, `${path}:mistyped`);
    }
    walkSchema(schema, (node, path) => {
      if (path && node.enum) enumCases += 1;
      if (path && Object.prototype.hasOwnProperty.call(node, 'const')) constCases += 1;
    });
    const pending = [];
    walkSchema(schema, (node, path) => {
      if (path && node.enum) pending.push({ path, value: `invalid_${parts(path).at(-1)}`, kind: 'enum' });
      if (path && Object.prototype.hasOwnProperty.call(node, 'const')) pending.push({ path, value: node.const === false ? true : null, kind: 'const' });
    });
    for (const candidate of pending) {
      const args = clone(bases[tool.name]); setPath(args, candidate.path, candidate.value); const field = parts(candidate.path).filter((part) => !/^\d+$/.test(part)).at(-1);
      await assertStructured4xx(tool.name, args, field, `${candidate.path}:${candidate.kind}`);
    }
    for (const candidate of rangeCases(schema)) {
      const args = clone(bases[tool.name]); setPath(args, candidate.path, candidate.value); const field = parts(candidate.path).filter((part) => !/^\d+$/.test(part)).at(-1);
      await assertStructured4xx(tool.name, args, field, `${candidate.path}:${candidate.kind}`); rangeCaseCount += 1;
    }
  }

  return {
    choreographyRunId: run.runId,
    creationId: completed.creationId,
    selectedApis: run.selectedApis.map((api) => api.id),
    audio: audioEvidence,
    fuzzCases,
    enumCases,
    constCases,
    rangeCases: rangeCaseCount,
    schemaConstraints: constraintCount,
    tools: tools.length,
    promptSurfaces: tools.length + 4
  };
}

if (require.main === module) {
  const baseArg = process.argv.find((arg) => arg.startsWith('--base-url='));
  const base = (baseArg ? baseArg.slice('--base-url='.length) : process.env.RANDOMWARE_PUBLIC_URL || '').replace(/\/$/, '');
  if (!base || !/^https:\/\//i.test(base)) { console.error('test-synthetic-deployed requires --base-url=HTTPS_URL'); process.exit(2); }
  runSynthetic(base).then((result) => console.log(JSON.stringify({ ok: true, ...result }))).catch((error) => { console.error(`synthetic deployed acceptance failed: ${error.message}`); process.exitCode = 1; });
}

module.exports = { runSynthetic, requiredPaths, schemaCompleteness };
