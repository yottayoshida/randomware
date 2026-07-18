const { getRegistryEntry } = require('./registry');
const crypto = require('node:crypto');
const { extractLibrivoxAudioUrl, validateMediaUrl, MEDIA_LIMITS } = require('./media');

function rejectParameters(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_parameters');
  for (const [key, item] of Object.entries(value)) {
    if (/^(url|host|path|endpoint|redirect)$/i.test(key) || (typeof item === 'string' && /^https?:\/\//i.test(item))) throw new Error('invalid_parameters');
    if (item && typeof item === 'object') rejectParameters(item);
  }
}

function bounded(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => bounded(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [key, bounded(item, depth + 1)]));
  return value;
}

function radioAdapter(value) {
  let station; let resolved; let rejection;
  for (const candidate of (Array.isArray(value) ? value : [])) {
    if (!candidate || typeof candidate.url_resolved !== 'string') continue;
    try { resolved = validateMediaUrl(candidate.url_resolved, { kind: 'radio-browser' }); station = candidate; break; } catch (error) { rejection = error; }
  }
  if (!station || !resolved) throw rejection || new Error('media_audio_source_missing');
  return {
    data: { station: bounded({ name: station.name, codec: station.codec, bitrate: station.bitrate, country: station.country, tags: station.tags, homepage: station.homepage }), media: { kind: 'audio', codec: station.codec || null } },
    mediaCandidate: { kind: 'radio-browser', resolvedUrl: resolved.toString() }
  };
}

const fixtureLibrivoxAudio = Object.freeze({
  '47': 'https://archive.org/download/count_monte_cristo_0711_librivox/count_of_monte_cristo_001_dumas_64kb.mp3',
  '52': 'https://archive.org/download/letters_brides_0709_librivox/letters_of_two_brides_001_balzac_64kb.mp3'
});

async function librivoxAudio(book, { fetcher, fixtureMode }) {
  if (fixtureMode && fixtureLibrivoxAudio[book.id]) return validateMediaUrl(fixtureLibrivoxAudio[book.id], { kind: 'librivox' });
  if (book.url_rss) {
    let response;
    try { response = await fetcher(book.url_rss, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'Randomware/0.1 (competition demo)' }, signal: AbortSignal.timeout(6000) }); } catch { throw new Error('upstream_failure'); }
    if (!response.ok) throw new Error('upstream_failure');
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 256 * 1024) throw new Error('response_too_large');
    return validateMediaUrl(extractLibrivoxAudioUrl(raw.toString('utf8')), { kind: 'librivox' });
  }
  throw new Error('media_audio_source_missing');
}

async function adaptAudio(apiId, value, context) {
  if (apiId === 'radio-browser') return radioAdapter(value);
  if (apiId !== 'librivox') return { data: bounded(value) };
  const book = (Array.isArray(value?.books) ? value.books : []).find((candidate) => candidate && candidate.id);
  if (!book) throw new Error('media_audio_source_missing');
  const resolved = await librivoxAudio(book, context);
  return {
    data: { book: bounded({ id: book.id, title: book.title, authors: book.authors, language: book.language, copyright_year: book.copyright_year, totaltime: book.totaltime, url_librivox: book.url_librivox, description: book.description }), media: { kind: 'audio', format: 'audio/mpeg' } },
    mediaCandidate: { kind: 'librivox', resolvedUrl: resolved.toString() }
  };
}

class Broker {
  constructor({ fixtureMode = false, fetcher = globalThis.fetch, fixtureRoot = typeof process !== 'undefined' && process.cwd ? process.cwd() : '/' } = {}) {
    this.fixtureMode = fixtureMode; this.fetcher = typeof fetcher === 'function' ? fetcher.bind(globalThis) : fetcher; this.fixtureRoot = fixtureRoot; this.cache = new Map();
  }

  async call({ selectedApis, apiId, operationId, params = {}, media } = {}) {
    const selected = (selectedApis || []).find((entry) => entry.apiId === apiId);
    if (!selected || !selected.operationIds.includes(operationId)) throw new Error('operation_not_selected');
    rejectParameters(params);
    const entry = getRegistryEntry(apiId); const op = entry.operations.find((candidate) => candidate.id === operationId);
    if (!op) throw new Error('operation_not_found');
    const cacheKey = `${apiId}:${operationId}:${JSON.stringify(params)}`;
    if (this.cache.has(cacheKey)) return this.publicResult({ ...this.cache.get(cacheKey), cached: true }, media);
    let data; let sourceUrl = `https://${entry.upstreamHosts[0]}${op.pathTemplate}`;
    if (this.fixtureMode) {
      const fs = require('node:fs'); const path = require('node:path');
      const file = path.join(this.fixtureRoot, 'docs', 'api-candidates', 'samples', op.fixturePath);
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      let response;
      try { response = await this.fetcher(sourceUrl, { method: 'GET', headers: { 'user-agent': 'Randomware/0.1 (competition demo)' }, signal: AbortSignal.timeout(Math.min(op.timeoutMs, 6000)) }); }
      catch (error) { if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('runtime_timeout'); throw new Error('upstream_failure'); }
      if (!response.ok) throw new Error('upstream_failure');
      const type = response.headers.get('content-type') || '';
      if (!type.includes('json') && !type.includes('javascript')) throw new Error('response_shape_mismatch');
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > op.maxRawBytes) throw new Error('response_too_large');
      try { data = JSON.parse(raw.toString('utf8')); } catch { throw new Error('response_shape_mismatch'); }
    }
    const adapted = await adaptAudio(apiId, data, { fetcher: this.fetcher, fixtureMode: this.fixtureMode });
    data = adapted.data;
    const result = { ok: true, apiId, operationId, data, bytes: Buffer.byteLength(JSON.stringify(data)), sourceUrl, cached: false, mediaCandidate: adapted.mediaCandidate };
    if (result.bytes > 64 * 1024) throw new Error('response_too_large');
    this.cache.set(cacheKey, result);
    return this.publicResult(result, media);
  }

  async publicResult(base, media) {
    const result = { ...base }; const candidate = result.mediaCandidate; delete result.mediaCandidate;
    if (!candidate || !media?.tokenSigner || !media?.mediaStore) return result;
    const tokenId = crypto.randomUUID(); const expiresAt = Date.now() + MEDIA_LIMITS.streamMs; const maxBytes = MEDIA_LIMITS.bytesPerPage;
    const token = media.tokenSigner.issueMedia({ tokenId, creationId: media.creationId, revision: media.revision, apiId: result.apiId, operationId: result.operationId, resolvedUrl: candidate.resolvedUrl, ttlMs: MEDIA_LIMITS.streamMs, maxBytes });
    await media.mediaStore.createMediaToken(media.runId, { tokenId, creationId: media.creationId, revision: media.revision, apiId: result.apiId, operationId: result.operationId, resolvedUrl: candidate.resolvedUrl, expiresAt, maxBytes });
    const mediaUrl = `${String(media.origin).replace(/\/$/, '')}/media/${token}`;
    result.mediaUrl = mediaUrl;
    result.data = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? { ...result.data, mediaUrl } : { value: result.data, mediaUrl };
    return result;
  }
}

module.exports = { Broker, rejectParameters, bounded };
