const test = require('node:test');
const assert = require('node:assert/strict');
const { Broker, bounded } = require('../../src/core/broker');

test('broker permits only selected fixed operations and returns bounded JSON', async () => {
  const broker = new Broker({ fixtureMode: true });
  const result = await broker.call({
    selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }],
    apiId: 'open-meteo', operationId: 'forecast', params: {}
  });
  assert.equal(result.ok, true);
  assert.equal(result.apiId, 'open-meteo');
  assert.ok(result.data);
});

test('broker rejects unknown API operations and arbitrary URL parameters', async () => {
  const broker = new Broker({ fixtureMode: true });
  await assert.rejects(() => broker.call({ selectedApis: [], apiId: 'open-meteo', operationId: 'nope', params: {} }), /operation_not_selected/);
  await assert.rejects(() => broker.call({ selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }], apiId: 'open-meteo', operationId: 'forecast', params: { url: 'https://evil.example' } }), /invalid_parameters/);
});

test('live broker enforces JSON content type and bounded bytes', async () => {
  const response = { ok: true, headers: new Headers({ 'content-type': 'text/html' }), arrayBuffer: async () => Buffer.from('<html>') };
  const broker = new Broker({ fetcher: async () => response });
  await assert.rejects(() => broker.call({ selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }], apiId: 'open-meteo', operationId: 'forecast' }), /response_shape_mismatch/);
});

test('live broker invokes the platform fetch with its global receiver', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = function fetchWithGlobalReceiver() {
    assert.equal(this, globalThis);
    return Promise.resolve({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      arrayBuffer: async () => Buffer.from('{"ok":true}')
    });
  };
  try {
    const broker = new Broker();
    const result = await broker.call({
      selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }],
      apiId: 'open-meteo', operationId: 'forecast'
    });
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('broker rejects nested URL parameters', async () => {
  const broker = new Broker({ fixtureMode: true });
  await assert.rejects(() => broker.call({ selectedApis: [{ apiId: 'open-meteo', operationIds: ['forecast'] }], apiId: 'open-meteo', operationId: 'forecast', params: { nested: { endpoint: 'https://evil.example' } } }), /invalid_parameters/);
});

test('broker adapters strip markup and bound untrusted nested output', () => {
  const data = bounded({ html: '<script>alert(1)</script>clean', nested: { deep: { deeper: { deepest: { value: 'kept' } } } } });
  assert.equal(data.html, 'alert(1)clean');
  assert.equal(data.nested.deep.deeper.deepest.value, '[truncated]');
});
