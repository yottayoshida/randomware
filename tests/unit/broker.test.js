const test = require('node:test');
const assert = require('node:assert/strict');
const { Broker, bounded, browserPlayableRadioCodec } = require('../../src/core/broker');

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

test('audio adapters return metadata and a same-origin media URL, never the upstream stream URL', async () => {
  const broker = new Broker({ fixtureMode: true });
  const result = await broker.call({
    selectedApis: [{ apiId: 'radio-browser', operationIds: ['station'] }],
    apiId: 'radio-browser', operationId: 'station', params: {},
    media: { origin: 'https://randomware.example', creationId: 'creation_test', revision: 1, tokenSigner: { issueMedia: () => 'signed-media-token' }, mediaStore: { createMediaToken: async () => {} } }
  });
  assert.equal(result.data.station.url_resolved, undefined);
  assert.equal(result.data.station.url, undefined);
  assert.equal(browserPlayableRadioCodec(result.data.station.codec), true, `fixture_default_codec:${result.data.station.codec}`);
  assert.equal(result.data.mediaUrl, 'https://randomware.example/media/signed-media-token');
  assert.equal(result.mediaUrl, 'https://randomware.example/media/signed-media-token');
});

test('live radio adapter skips a validated but dead station before minting media', async () => {
  const created = [];
  const stations = [
    { name: 'dead', url_resolved: 'http://dead.example/live' },
    { name: 'alive', url_resolved: 'https://alive.example/live.mp3' }
  ];
  const fetcher = async (target) => {
    if (String(target).includes('/json/stations/search')) return new Response(JSON.stringify(stations), { headers: { 'content-type': 'application/json' } });
    if (String(target).startsWith('http://dead.example/')) return new Response('dead', { status: 400 });
    if (String(target).startsWith('https://alive.example/')) return new Response(Buffer.from('audio'), { headers: { 'content-type': 'audio/mpeg' } });
    throw new Error(`unexpected:${target}`);
  };
  const result = await new Broker({ fetcher }).call({
    selectedApis: [{ apiId: 'radio-browser', operationIds: ['station'] }], apiId: 'radio-browser', operationId: 'station', params: {},
    media: { origin: 'https://randomware.example', runId: 'run_radio', creationId: 'creation_radio', revision: 1, tokenSigner: { issueMedia: () => 'radio-token' }, mediaStore: { createMediaToken: async (_runId, record) => created.push(record) } }
  });
  assert.equal(result.data.station.name, 'alive');
  assert.equal(created[0].resolvedUrl, 'https://alive.example/live.mp3');
});

test('radio adapter prefers a browser-playable codec over an earlier AAC+ stream', async () => {
  const created = [];
  const stations = [
    { name: 'aac-plus-first', codec: 'AAC+', url_resolved: 'https://aac-plus.example/live' },
    { name: 'mp3-second', codec: 'MP3', url_resolved: 'https://mp3.example/live' }
  ];
  const fetcher = async (target) => {
    if (String(target).includes('/json/stations/search')) return new Response(JSON.stringify(stations), { headers: { 'content-type': 'application/json' } });
    if (String(target).startsWith('https://aac-plus.example/')) return new Response(Buffer.from('aacp'), { headers: { 'content-type': 'audio/aacp' } });
    if (String(target).startsWith('https://mp3.example/')) return new Response(Buffer.from('mp3'), { headers: { 'content-type': 'audio/mpeg' } });
    throw new Error(`unexpected:${target}`);
  };
  const result = await new Broker({ fetcher }).call({
    selectedApis: [{ apiId: 'radio-browser', operationIds: ['station'] }], apiId: 'radio-browser', operationId: 'station', params: {},
    media: { origin: 'https://randomware.example', runId: 'run_codec', creationId: 'creation_codec', revision: 1, tokenSigner: { issueMedia: () => 'codec-token' }, mediaStore: { createMediaToken: async (_runId, record) => created.push(record) } }
  });
  assert.equal(result.data.station.name, 'mp3-second');
  assert.equal(result.data.station.codec, 'MP3');
  assert.equal(created[0].resolvedUrl, 'https://mp3.example/live');
});

test('radio adapter falls back to the first valid non-preferred codec', async () => {
  const stations = [
    { name: 'aac-plus', codec: 'AAC+', url_resolved: 'https://aac-plus.example/live' },
    { name: 'opus', codec: 'OPUS', url_resolved: 'https://opus.example/live' }
  ];
  const fetcher = async (target) => {
    if (String(target).includes('/json/stations/search')) return new Response(JSON.stringify(stations), { headers: { 'content-type': 'application/json' } });
    return new Response(Buffer.from('audio'), { headers: { 'content-type': String(target).includes('aac-plus') ? 'audio/aacp' : 'audio/ogg' } });
  };
  const result = await new Broker({ fetcher }).call({
    selectedApis: [{ apiId: 'radio-browser', operationIds: ['station'] }], apiId: 'radio-browser', operationId: 'station', params: {},
    media: { origin: 'https://randomware.example', runId: 'run_codec_fallback', creationId: 'creation_codec_fallback', revision: 1, tokenSigner: { issueMedia: () => 'fallback-token' }, mediaStore: { createMediaToken: async () => {} } }
  });
  assert.equal(result.data.station.name, 'aac-plus');
  assert.equal(result.data.station.codec, 'AAC+');
});

test('LibriVox adapter returns bounded book metadata and an archive.org media URL', async () => {
  const broker = new Broker({ fixtureMode: true });
  const result = await broker.call({
    selectedApis: [{ apiId: 'librivox', operationIds: ['book'] }],
    apiId: 'librivox', operationId: 'book', params: {},
    media: { origin: 'https://randomware.example', creationId: 'creation_book', revision: 1, tokenSigner: { issueMedia: () => 'signed-book-media-token' }, mediaStore: { createMediaToken: async () => {} } }
  });
  assert.equal(result.data.book.url_zip_file, undefined);
  assert.equal(result.data.mediaUrl, 'https://randomware.example/media/signed-book-media-token');
  assert.equal(result.mediaUrl, 'https://randomware.example/media/signed-book-media-token');
});

test('image adapters replace raw fields in place with signed same-origin asset URLs', async () => {
  const created = [];
  const broker = new Broker({ fixtureMode: true });
  const result = await broker.call({
    selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }],
    apiId: 'dog-ceo', operationId: 'random', params: {},
    media: {
      origin: 'https://randomware.example', runId: 'run_asset', creationId: 'creation_asset', revision: 1,
      capability: { nonce: 'page_nonce', expiresAt: Date.now() + 600000 },
      tokenSigner: { issueAsset: () => 'signed-asset-token' },
      mediaStore: { createAssetToken: async (_runId, record) => created.push(record) }
    }
  });
  assert.equal(result.data.message, 'https://randomware.example/api/runtime/asset/signed-asset-token');
  assert.doesNotMatch(JSON.stringify(result.data), /images\.dog\.ceo/);
  assert.equal(created.length, 1);
  assert.equal(created[0].pageId, 'page_nonce');
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
