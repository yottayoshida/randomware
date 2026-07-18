const test = require('node:test');
const assert = require('node:assert/strict');
const { callToolResult } = require('../../src/core/mcp');
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
