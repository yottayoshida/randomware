const test = require('node:test');
const assert = require('node:assert/strict');
const { createArtifact } = require('../../src/core/artifact');
const { validateArtifact } = require('../../src/core/validator');

test('default artifact is complete, bounded, and declares every selected operation', () => {
  const selected = [{ apiId: 'open-meteo', operationId: 'forecast' }, { apiId: 'deck-of-cards', operationId: 'draw' }];
  const html = createArtifact({ appName: 'Weather Dealer', selected });
  const result = validateArtifact(html, { selectedApis: selected.map((item) => ({ apiId: item.apiId, operationIds: [item.operationId] })) });
  assert.equal(result.ok, true);
  assert.ok(result.bytes >= 10000 && result.bytes <= 40000);
  assert.match(html, /Promise\.allSettled/);
  assert.match(html, /Source unavailable:/);
  assert.doesNotMatch(html, /<\s*(?:audio|video)\b[^>]*\sautoplay(?:\s|=|\/?>)/i);
});

test('validator rejects autoplay only when it is an audio or video attribute', () => {
  const selected = [{ apiId: 'open-meteo', operationId: 'forecast' }, { apiId: 'deck-of-cards', operationId: 'draw' }];
  const html = createArtifact({ appName: 'Weather Dealer', selected });
  const context = { selectedApis: selected.map((item) => ({ apiId: item.apiId, operationIds: [item.operationId] })) };
  const autoplay = html.replace('</main>', '<audio controls autoplay></audio></main>');
  const namedData = html.replace('</main>', '<audio controls data-autoplay="disabled" aria-label="autoplay is unavailable"></audio></main>');
  assert.equal(validateArtifact(autoplay, context).code, 'policy_blocked');
  assert.equal(validateArtifact(namedData, context).ok, true);
});
