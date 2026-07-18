const { getRegistryEntry } = require('./registry');
const crypto = require('node:crypto');
const { extractLibrivoxAudioUrl, validateMediaUrl, fetchMedia, MEDIA_LIMITS } = require('./media');
const { ASSET_LIMITS, prepareAssetData, collectAssetCandidates, rewriteAssetCandidates } = require('./asset');
const BROWSER_PLAYABLE_RADIO_CODECS = new Set(['MP3', 'MPEG', 'AUDIO/MPEG', 'AUDIO-MPEG', 'AAC', 'AUDIO/AAC', 'AUDIO-AAC']);

function rejectParameters(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_parameters');
  for (const [key, item] of Object.entries(value)) {
    if (/^(url|host|path|endpoint|redirect)$/i.test(key) || (typeof item === 'string' && /^https?:\/\//i.test(item))) throw new Error('invalid_parameters');
    if (item && typeof item === 'object') rejectParameters(item);
  }
}

function bounded(value, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return '[truncated]';
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => bounded(item, depth + 1, maxDepth));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [key, bounded(item, depth + 1, maxDepth)]));
  return value;
}

async function conformToExample(value, example, fallback, path = []) {
  if (Array.isArray(example)) {
    if (!example.length) return [];
    const source = Array.isArray(value) && value.length ? value : example;
    return Promise.all(source.slice(0, 20).map((item, index) => conformToExample(item, example[0], fallback, [...path, index])));
  }
  if (example && typeof example === 'object') {
    const source = Array.isArray(value) ? value[0] : value;
    const entries = await Promise.all(Object.entries(example).map(async ([key, item]) => [key, await conformToExample(source && typeof source === 'object' ? source[key] : undefined, item, fallback, [...path, key])]));
    return Object.fromEntries(entries);
  }
  const projected = fallback ? await fallback(example, path, value) : undefined;
  if (projected !== undefined) return projected;
  if (value === null || value === undefined || (typeof value === 'object' && value !== null)) return example;
  return value;
}

async function issueAssetUrl(candidate, result, media) {
  if (!media?.tokenSigner?.issueAsset || !media?.mediaStore?.createAssetToken || !media?.capability?.nonce) return null;
  const tokenId = crypto.randomUUID(); const pageId = media.capability.nonce; const now = Date.now(); const expiresAt = Math.min(Number(media.capability.expiresAt) || now + ASSET_LIMITS.ttlMs, now + ASSET_LIMITS.ttlMs); const ttlMs = Math.max(1, expiresAt - now);
  const token = media.tokenSigner.issueAsset({ tokenId, pageId, creationId: media.creationId, revision: media.revision, apiId: result.apiId, operationId: result.operationId, resolvedUrl: candidate.resolvedUrl, now, ttlMs, maxBytes: ASSET_LIMITS.bytesEach });
  await media.mediaStore.createAssetToken(media.runId, { tokenId, pageId, creationId: media.creationId, revision: media.revision, apiId: result.apiId, operationId: result.operationId, resolvedUrl: candidate.resolvedUrl, expiresAt, maxBytes: ASSET_LIMITS.bytesEach, pageMaxBytes: ASSET_LIMITS.bytesPerPage });
  return `${String(media.origin).replace(/\/$/, '')}/api/runtime/asset/${token}`;
}

async function issueMediaUrl(candidate, result, media) {
  if (!candidate || !media?.tokenSigner?.issueMedia || !media?.mediaStore?.createMediaToken) return null;
  const tokenId = crypto.randomUUID(); const expiresAt = Date.now() + MEDIA_LIMITS.streamMs; const maxBytes = MEDIA_LIMITS.bytesPerPage;
  const token = media.tokenSigner.issueMedia({ tokenId, creationId: media.creationId, revision: media.revision, apiId: result.apiId, operationId: result.operationId, resolvedUrl: candidate.resolvedUrl, ttlMs: MEDIA_LIMITS.streamMs, maxBytes });
  await media.mediaStore.createMediaToken(media.runId, { tokenId, creationId: media.creationId, revision: media.revision, apiId: result.apiId, operationId: result.operationId, resolvedUrl: candidate.resolvedUrl, expiresAt, maxBytes });
  return `${String(media.origin).replace(/\/$/, '')}/media/${token}`;
}

function browserPlayableRadioCodec(value) {
  const codec = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  return BROWSER_PLAYABLE_RADIO_CODECS.has(codec);
}

async function radioAdapter(value, { fetcher, fixtureMode }) {
  let station; let resolved; let rejection;
  const candidates = Array.isArray(value) ? value : [];
  const ordered = [...candidates.filter((candidate) => browserPlayableRadioCodec(candidate?.codec)), ...candidates.filter((candidate) => !browserPlayableRadioCodec(candidate?.codec))];
  for (const candidate of ordered) {
    if (!candidate || typeof candidate.url_resolved !== 'string') continue;
    try {
      resolved = validateMediaUrl(candidate.url_resolved, { kind: 'radio-browser' });
      if (!fixtureMode) {
        const probe = await fetchMedia({ target: resolved.href, request: new Request('https://randomware.invalid/media-probe', { headers: { range: 'bytes=0-0' } }), fetcher, kind: 'radio-browser', timeoutMs: 2500 });
        resolved = probe.url;
        await probe.response.body?.cancel('probe_complete');
      }
      station = candidate; break;
    } catch (error) { rejection = error; }
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

async function librivoxAudio(book, { fetcher, fixtureMode, timeoutMs = 6000 }) {
  if (fixtureMode && fixtureLibrivoxAudio[book.id]) return validateMediaUrl(fixtureLibrivoxAudio[book.id], { kind: 'librivox' });
  if (book.url_rss) {
    let response;
    try { response = await fetcher(book.url_rss, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'Randomware/0.1 (competition demo)' }, signal: AbortSignal.timeout(timeoutMs) }); } catch { throw new Error('upstream_failure'); }
    if (!response.ok) throw new Error('upstream_failure');
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 256 * 1024) throw new Error('response_too_large');
    return validateMediaUrl(extractLibrivoxAudioUrl(raw.toString('utf8')), { kind: 'librivox' });
  }
  throw new Error('media_audio_source_missing');
}

async function adaptAudio(apiId, value, context) {
  if (apiId === 'radio-browser') return radioAdapter(value, context);
  if (apiId !== 'librivox') return { data: bounded(value) };
  const book = (Array.isArray(value?.books) ? value.books : []).find((candidate) => candidate && candidate.id);
  if (!book) throw new Error('media_audio_source_missing');
  const resolved = await librivoxAudio(book, context);
  const authors = (Array.isArray(book.authors) ? book.authors : []).slice(0, 20).map((author) => ({
    id: author?.id ?? null,
    first_name: author?.first_name ?? null,
    last_name: author?.last_name ?? null,
    dob: author?.dob ?? null,
    dod: author?.dod ?? null
  }));
  return {
    data: { book: bounded({ id: book.id ?? null, title: book.title ?? null, authors, language: book.language ?? null, copyright_year: book.copyright_year ?? null, totaltime: book.totaltime ?? null, url_librivox: book.url_librivox ?? null, description: book.description ?? null }), media: { kind: 'audio', format: 'audio/mpeg' } },
    mediaCandidate: { kind: 'librivox', resolvedUrl: resolved.toString() }
  };
}

class Broker {
  constructor({ fixtureMode = false, fetcher = globalThis.fetch, fixtureRoot = typeof process !== 'undefined' && process.cwd ? process.cwd() : '/' } = {}) {
    this.fixtureMode = Boolean(fixtureMode); this.contractFixtureMode = fixtureMode === true || fixtureMode === 'adapted'; this.fetcher = typeof fetcher === 'function' ? fetcher.bind(globalThis) : fetcher; this.fixtureRoot = fixtureRoot; this.cache = new Map();
  }

  async finalResult(base, media) {
    const fixtureExample = base.fixtureExample; const fixtureSources = base.fixtureSources; const clean = { ...base }; delete clean.fixtureExample; delete clean.fixtureSources;
    const result = await this.publicResult(clean, media);
    if (fixtureExample !== undefined) {
      const pathKey = (path) => JSON.stringify(path);
      const assetSources = new Map((fixtureSources?.assets || []).map((candidate) => [pathKey(candidate.path), candidate.resolvedUrl]));
      const fallback = async (example, path, currentValue) => {
        if (typeof example === 'string' && example.includes('/api/runtime/asset/golden-asset-')) {
          if (typeof currentValue === 'string' && currentValue.includes('/api/runtime/asset/') && !currentValue.includes('/golden-asset-')) return currentValue;
          const resolvedUrl = assetSources.get(pathKey(path)); if (!resolvedUrl) throw new Error(`fixture_asset_source_missing:${path.join('.')}`);
          return issueAssetUrl({ path, resolvedUrl }, result, media);
        }
        if (typeof example === 'string' && example.includes('/media/golden-media-')) {
          if (typeof currentValue === 'string' && currentValue.includes('/media/') && !currentValue.includes('/golden-media-')) return currentValue;
          const resolvedUrl = fixtureSources?.media?.resolvedUrl; if (!resolvedUrl) throw new Error('fixture_media_source_missing');
          return issueMediaUrl({ resolvedUrl }, result, media);
        }
        return undefined;
      };
      result.data = await conformToExample(result.data, fixtureExample, fallback);
      result.bytes = Buffer.byteLength(JSON.stringify(result.data));
      if (result.bytes > 64 * 1024) throw new Error('response_too_large');
    }
    return result;
  }

  async call({ selectedApis, apiId, operationId, params = {}, media, onRetry } = {}) {
    const selected = (selectedApis || []).find((entry) => entry.apiId === apiId);
    if (!selected || !selected.operationIds.includes(operationId)) throw new Error('operation_not_selected');
    rejectParameters(params);
    const entry = getRegistryEntry(apiId); const op = entry.operations.find((candidate) => candidate.id === operationId);
    if (!op) throw new Error('operation_not_found');
    const cacheKey = `${apiId}:${operationId}:${JSON.stringify(params)}`;
    if (this.cache.has(cacheKey)) return this.finalResult({ ...this.cache.get(cacheKey), cached: true }, media);
    let data; let fixtureExample; let fixtureSources; let sourceUrl = `https://${entry.upstreamHosts[0]}${op.pathTemplate}`;
    if (this.fixtureMode) {
      const fs = require('node:fs'); const path = require('node:path');
      const file = path.join(this.fixtureRoot, 'docs', 'api-candidates', 'samples', op.fixturePath);
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (this.contractFixtureMode) {
        const adapted = JSON.parse(fs.readFileSync(path.join(this.fixtureRoot, op.adaptedFixturePath), 'utf8'));
        fixtureExample = adapted.data; fixtureSources = adapted.fixtureSources;
      }
    } else {
      let response;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await this.fetcher(sourceUrl, { method: 'GET', headers: { 'user-agent': 'Randomware/0.1 (competition demo)' }, signal: AbortSignal.timeout(Math.min(op.timeoutMs, 10000)) });
          break;
        } catch (error) {
          const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
          if (!timeout) throw new Error('upstream_failure');
          if (attempt === 0) {
            if (typeof onRetry === 'function') await onRetry({ apiId, operationId, status: 'runtime_timeout_retry', attempt: 1 });
            continue;
          }
          throw new Error('runtime_timeout');
        }
      }
      if (!response.ok) throw new Error('upstream_failure');
      const type = response.headers.get('content-type') || '';
      if (!type.includes('json') && !type.includes('javascript')) throw new Error('response_shape_mismatch');
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > op.maxRawBytes) throw new Error('response_too_large');
      try { data = JSON.parse(raw.toString('utf8')); } catch { throw new Error('response_shape_mismatch'); }
    }
    const prepared = prepareAssetData(apiId, data);
    const adapted = await adaptAudio(apiId, prepared, { fetcher: this.fetcher, fixtureMode: this.fixtureMode, timeoutMs: op.timeoutMs });
    data = bounded(adapted.data, 0, apiId === 'wiki-onthisday' ? 6 : 4);
    const assetCandidates = collectAssetCandidates(entry, data);
    const result = { ok: true, apiId, operationId, data, bytes: Buffer.byteLength(JSON.stringify(data)), sourceUrl, cached: false, mediaCandidate: adapted.mediaCandidate, assetCandidates, fixtureExample, fixtureSources };
    if (result.bytes > 64 * 1024) throw new Error('response_too_large');
    this.cache.set(cacheKey, result);
    return this.finalResult(result, media);
  }

  async publicResult(base, media) {
    const result = { ...base, data: structuredClone(base.data) };
    const assetCandidates = result.assetCandidates || []; delete result.assetCandidates;
    result.data = await rewriteAssetCandidates(result.data, assetCandidates, async (candidate) => {
      if (typeof media?.captureAsset === 'function') media.captureAsset(candidate);
      return issueAssetUrl(candidate, result, media);
    });
    const candidate = result.mediaCandidate; delete result.mediaCandidate;
    if (!candidate || !media?.tokenSigner || !media?.mediaStore) { result.bytes = Buffer.byteLength(JSON.stringify(result.data)); if (result.bytes > 64 * 1024) throw new Error('response_too_large'); return result; }
    if (typeof media.captureMedia === 'function') media.captureMedia(candidate);
    const mediaUrl = await issueMediaUrl(candidate, result, media);
    result.mediaUrl = mediaUrl;
    result.data = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? { ...result.data, mediaUrl } : { value: result.data, mediaUrl };
    result.bytes = Buffer.byteLength(JSON.stringify(result.data));
    if (result.bytes > 64 * 1024) throw new Error('response_too_large');
    return result;
  }
}

module.exports = { Broker, rejectParameters, bounded, browserPlayableRadioCodec, conformToExample, issueAssetUrl, issueMediaUrl, adaptAudio };
