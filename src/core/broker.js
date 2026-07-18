const { getRegistryEntry } = require('./registry');

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

class Broker {
  constructor({ fixtureMode = false, fetcher = globalThis.fetch, fixtureRoot = typeof process !== 'undefined' && process.cwd ? process.cwd() : '/' } = {}) {
    this.fixtureMode = fixtureMode; this.fetcher = typeof fetcher === 'function' ? fetcher.bind(globalThis) : fetcher; this.fixtureRoot = fixtureRoot; this.cache = new Map();
  }

  async call({ selectedApis, apiId, operationId, params = {} }) {
    const selected = (selectedApis || []).find((entry) => entry.apiId === apiId);
    if (!selected || !selected.operationIds.includes(operationId)) throw new Error('operation_not_selected');
    rejectParameters(params);
    const entry = getRegistryEntry(apiId); const op = entry.operations.find((candidate) => candidate.id === operationId);
    if (!op) throw new Error('operation_not_found');
    const cacheKey = `${apiId}:${operationId}:${JSON.stringify(params)}`;
    if (this.cache.has(cacheKey)) return { ...this.cache.get(cacheKey), cached: true };
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
    data = bounded(data);
    const result = { ok: true, apiId, operationId, data, bytes: Buffer.byteLength(JSON.stringify(data)), sourceUrl, cached: false };
    if (result.bytes > 64 * 1024) throw new Error('response_too_large');
    this.cache.set(cacheKey, result);
    return result;
  }
}

module.exports = { Broker, rejectParameters, bounded };
