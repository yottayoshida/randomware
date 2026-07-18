const test = require('node:test');
const assert = require('node:assert/strict');
const { callToolResult, widgetResource, widgetToolResult, widgetBuildPrompt } = require('../../src/core/mcp');
const { tools } = require('../../src/web');

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

test('widget opens a routable creation in-frame and exposes an openExternal fallback', () => {
  const widget = widgetResource('https://randomware.example').contents[0].text;
  assert.match(widget, /id="creation-frame"/);
  assert.match(widget, /\/c\//);
  assert.match(widget, /openExternal\(\{href/);
  assert.match(widget, /Download or open the creation/);
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
