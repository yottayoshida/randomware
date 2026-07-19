const test = require('node:test');
const assert = require('node:assert/strict');
const { Broker, bounded, browserPlayableRadioCodec, adaptAudio } = require('../../src/core/broker');

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

test('LibriVox adapter emits stable nullable book and author fields', async () => {
  const adapted = await adaptAudio('librivox', { books: [{ id: '47', title: 'Count', authors: [{ first_name: 'Alexandre' }], url_librivox: 'https://librivox.org/count/' }] }, { fixtureMode: true, fetcher: async () => { throw new Error('unexpected_fetch'); } });
  assert.deepEqual(Object.keys(adapted.data.book).sort(), ['authors', 'copyright_year', 'description', 'id', 'language', 'title', 'totaltime', 'url_librivox'].sort());
  assert.deepEqual(Object.keys(adapted.data.book.authors[0]).sort(), ['dob', 'dod', 'first_name', 'id', 'last_name'].sort());
  assert.equal(adapted.data.book.language, null);
  assert.equal(adapted.data.book.authors[0].last_name, null);
});

test('Wikimedia Commons audio adapter rejects oversized and off-policy candidates before signing', async () => {
  const adapted = await adaptAudio('wikimedia-commons-audio', {
    query: { pages: [
      { pageid: 1, title: 'File:Oversized.mp3', imageinfo: [{ url: 'https://upload.wikimedia.org/oversized.mp3', size: 8 * 1024 * 1024 + 1, mime: 'audio/mpeg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }] },
      { pageid: 2, title: 'File:Wrong host.mp3', imageinfo: [{ url: 'https://evil.example/audio.mp3', size: 940416, mime: 'audio/mpeg', extmetadata: { LicenseShortName: { value: 'CC0' } } }] },
      { pageid: 3, title: 'File:Field bell.mp3', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Field_bell.mp3', size: 940416, mime: 'audio/mpeg', extmetadata: { LicenseShortName: { value: '<b>CC BY-SA 4.0</b>' } } }] }
    ] }
  }, { fixtureMode: true, fetcher: async () => { throw new Error('unexpected_fetch'); } });
  assert.deepEqual(adapted.data, {
    recording: { pageid: 3, title: 'File:Field bell.mp3', size: 940416, mime: 'audio/mpeg', license: 'CC BY-SA 4.0' },
    media: { kind: 'audio', format: 'audio/mpeg' }
  });
  assert.deepEqual(adapted.mediaCandidate, { kind: 'wikimedia-commons', resolvedUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Field_bell.mp3' });
});

test('Wikimedia Commons audio adapter probes live candidates and keeps only an audio response', async () => {
  const visited = [];
  const adapted = await adaptAudio('wikimedia-commons-audio', {
    query: { pages: [{ pageid: 4, title: 'File:Forest.mp3', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Forest.mp3', size: 940416, mime: 'audio/mpeg', extmetadata: { LicenseShortName: { value: 'CC0' } } }] }] }
  }, {
    fixtureMode: false,
    timeoutMs: 5000,
    fetcher: async (target, init) => {
      visited.push({ target: String(target), range: init?.headers?.range });
      return new Response(Buffer.from('ID3'), { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-length': '3', 'content-range': 'bytes 0-2/940416' } });
    }
  });
  assert.equal(adapted.mediaCandidate.resolvedUrl, 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Forest.mp3');
  assert.deepEqual(visited, [{ target: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Forest.mp3', range: 'bytes=0-0' }]);
});

test('Wikimedia Commons audio adapter rejects candidates missing model-visible attribution fields', async () => {
  const adapted = await adaptAudio('wikimedia-commons-audio', {
    query: { pages: [
      { pageid: 5, title: 'File:No license.mp3', imageinfo: [{ url: 'https://upload.wikimedia.org/no-license.mp3', size: 1000, mime: 'audio/mpeg', extmetadata: {} }] },
      { pageid: 6, title: 'File:Licensed.mp3', imageinfo: [{ url: 'https://upload.wikimedia.org/licensed.mp3', size: 2000, mime: 'audio/mpeg', extmetadata: { LicenseShortName: { value: 'CC0' } } }] }
    ] }
  }, { fixtureMode: true, fetcher: async () => { throw new Error('unexpected_fetch'); } });
  assert.equal(adapted.data.recording.pageid, 6);
  assert.equal(adapted.data.recording.license, 'CC0');
  await assert.rejects(() => adaptAudio('wikimedia-commons-audio', {
    query: { pages: [{ pageid: 7, title: 'File:Still no license.mp3', imageinfo: [{ url: 'https://upload.wikimedia.org/still-no-license.mp3', size: 1000, mime: 'audio/mpeg' }] }] }
  }, { fixtureMode: true, fetcher: async () => { throw new Error('unexpected_fetch'); } }), /media_audio_source_missing/);
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

test('broker retries one idempotent GET timeout and emits one retry audit event', async () => {
  let calls = 0;
  const retries = [];
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) throw new DOMException('timed out', 'TimeoutError');
    return new Response(JSON.stringify({ date: '2026-07-18', base: 'USD', quote: 'JPY', rate: 162.35 }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await new Broker({ fetcher }).call({
    selectedApis: [{ apiId: 'frankfurter', operationIds: ['rates'] }],
    apiId: 'frankfurter', operationId: 'rates', params: {},
    onRetry: (event) => retries.push(event)
  });
  assert.equal(calls, 2);
  assert.equal(result.data.rate, 162.35);
  assert.deepEqual(retries, [{ apiId: 'frankfurter', operationId: 'rates', status: 'runtime_timeout_retry', attempt: 1 }]);
});

test('broker stops after the single timeout retry', async () => {
  let calls = 0;
  const retries = [];
  const broker = new Broker({ fetcher: async () => { calls += 1; throw new DOMException('timed out', 'TimeoutError'); } });
  await assert.rejects(() => broker.call({
    selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }],
    apiId: 'dog-ceo', operationId: 'random', params: {}, onRetry: (event) => retries.push(event)
  }), /runtime_timeout/);
  assert.equal(calls, 2);
  assert.equal(retries.length, 1);
});

test('live LibriVox requests receive the registry 10-second timeout budget', async () => {
  const originalTimeout = AbortSignal.timeout;
  const budgets = [];
  AbortSignal.timeout = (milliseconds) => {
    budgets.push(milliseconds);
    return originalTimeout(1);
  };
  try {
    const broker = new Broker({ fetcher: async () => { throw new DOMException('timed out', 'TimeoutError'); } });
    await assert.rejects(() => broker.call({
      selectedApis: [{ apiId: 'librivox', operationIds: ['book'] }],
      apiId: 'librivox', operationId: 'book', params: {}
    }), /runtime_timeout/);
    assert.deepEqual(budgets, [10000, 10000]);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('LibriVox RSS audio resolution receives the same 10-second timeout budget', async () => {
  const originalTimeout = AbortSignal.timeout;
  const budgets = [];
  AbortSignal.timeout = (milliseconds) => {
    budgets.push(milliseconds);
    return originalTimeout(milliseconds);
  };
  try {
    const resolved = await adaptAudio('librivox', {
      books: [{ id: '999', title: 'Cold Book', url_rss: 'https://librivox.org/rss/cold.xml' }]
    }, {
      fixtureMode: false,
      timeoutMs: 10000,
      fetcher: async () => new Response('<rss><channel><item><enclosure url="https://archive.org/download/cold/book.mp3" type="audio/mpeg" /></item></channel></rss>', { headers: { 'content-type': 'application/rss+xml' } })
    });
    assert.equal(resolved.mediaCandidate.resolvedUrl, 'https://archive.org/download/cold/book.mp3');
    assert.deepEqual(budgets, [10000]);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});
