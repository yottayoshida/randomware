const test = require('node:test');
const assert = require('node:assert/strict');
const { CHATGPT_FRAME_ANCESTORS } = require('../../src/core/csp');

test('creation frame policy permits every observed ChatGPT ancestor layer', () => {
  assert.deepEqual(CHATGPT_FRAME_ANCESTORS, [
    'https://chatgpt.com',
    'https://chat.openai.com',
    'https://web-sandbox.oaiusercontent.com',
    'https://*.web-sandbox.oaiusercontent.com'
  ]);
});
