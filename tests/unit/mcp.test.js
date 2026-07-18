const test = require('node:test');
const assert = require('node:assert/strict');
const { callToolResult } = require('../../src/core/mcp');

test('CallToolResult includes concise content alongside structuredContent', () => {
  const structuredContent = { ok: true, registry: 18 };
  const result = callToolResult(structuredContent, 'Randomware slot ready.');
  assert.deepEqual(result.structuredContent, structuredContent);
  assert.deepEqual(result.content, [{ type: 'text', text: 'Randomware slot ready.' }]);
});
