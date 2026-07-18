const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMediaUrl, fetchMedia, limitedStream, MEDIA_LIMITS } = require('../../src/core/media');

test('media URL validation rejects credentials, IP literals, local names, and non-audio schemes', () => {
  assert.equal(validateMediaUrl('http://radio.example/live', { kind: 'radio-browser' }).hostname, 'radio.example');
  for (const value of ['http://user:pass@radio.example/live', 'http://127.0.0.1/live', 'http://[::1]/live', 'http://radio.local/live', 'file:///tmp/audio.mp3']) assert.throws(() => validateMediaUrl(value, { kind: 'radio-browser' }), /media_(credentials|private_host|scheme)_/);
  assert.throws(() => validateMediaUrl('https://evil.example/audio.mp3', { kind: 'librivox' }), /media_host_rejected/);
  assert.equal(validateMediaUrl('https://dn720708.us.archive.org/0/items/book/chapter.mp3', { kind: 'librivox' }).hostname, 'dn720708.us.archive.org');
});

test('media fetch follows at most two validated redirects and preserves the audio response', async () => {
  let calls = 0;
  const fetcher = async (target) => {
    calls += 1;
    if (calls === 1) return new Response(null, { status: 302, headers: { location: 'https://cdn.example/one' } });
    if (calls === 2) return new Response(null, { status: 302, headers: { location: 'https://cdn.example/two.mp3' } });
    return new Response(Buffer.from('audio'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  const result = await fetchMedia({ target: 'https://radio.example/live', fetcher, request: new Request('https://randomware.example/media/test') });
  assert.equal(result.url.href, 'https://cdn.example/two.mp3');
  assert.equal(result.contentType, 'audio/mpeg');
  assert.equal(calls, 3);
  await assert.rejects(() => fetchMedia({ target: 'https://radio.example/live', fetcher: async () => new Response(null, { status: 302, headers: { location: 'https://cdn.example/next' } }), request: new Request('https://randomware.example/media/test') }), /media_redirect_limit/);
});

test('limited media streams stop at the page byte cap', async () => {
  const stream = limitedStream(new Response(Buffer.alloc(5)).body, 4, async () => {});
  await assert.rejects(() => new Response(stream).arrayBuffer(), /media_bytes_cap/);
  assert.equal(MEDIA_LIMITS.bytesPerPage, 8 * 1024 * 1024);
});
