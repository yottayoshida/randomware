const crypto = require('node:crypto');

const b64 = (value) => Buffer.from(value).toString('base64url');
const unb64 = (value) => Buffer.from(value, 'base64url').toString('utf8');

class CapabilitySigner {
  constructor(secret) { this.secret = secret; }

  sign(payload) { return crypto.createHmac('sha256', this.secret).update(payload).digest('base64url'); }

  issue({ creationId, revision, selected, now = Date.now(), ttlMs = 600000, quotas = {} }) {
    const payload = JSON.stringify({ creationId, revision, selected, issuedAt: now, expiresAt: now + ttlMs, nonce: crypto.randomBytes(12).toString('hex'), quotas: { jsonCalls: quotas.jsonCalls || 30, concurrentJson: quotas.concurrentJson || 2, adaptedBytes: quotas.adaptedBytes || 1024 * 1024 } });
    return `${b64(payload)}.${this.sign(payload)}`;
  }

  issueMedia({ tokenId, creationId, revision, apiId, operationId, resolvedUrl, now = Date.now(), ttlMs = 5 * 60 * 1000, maxBytes = 8 * 1024 * 1024 }) {
    const payload = JSON.stringify({ kind: 'media', tokenId, creationId, revision, apiId, operationId, resolvedUrl, issuedAt: now, expiresAt: now + ttlMs, maxBytes });
    return `${b64(payload)}.${this.sign(payload)}`;
  }

  verify(token, { now = Date.now(), creationId, revision, apiId, operationId } = {}) {
    const [encoded, signature] = String(token).split('.');
    if (!encoded || !signature) throw new Error('capability_invalid');
    const payload = unb64(encoded);
    const expected = this.sign(payload);
    const actual = Buffer.from(signature); const expectedBytes = Buffer.from(expected);
    if (actual.length !== expectedBytes.length || !crypto.timingSafeEqual(actual, expectedBytes)) throw new Error('capability_invalid');
    const data = JSON.parse(payload);
    if (now >= data.expiresAt) throw new Error('capability_expired');
    if ((creationId && data.creationId !== creationId) || (revision && data.revision !== revision)) throw new Error('capability_binding');
    if (apiId && operationId && !data.selected.some((item) => item.apiId === apiId && item.operationId === operationId)) throw new Error('capability_operation');
    return data;
  }

  verifyMedia(token, { now = Date.now(), tokenId, creationId, revision } = {}) {
    const [encoded, signature] = String(token).split('.');
    if (!encoded || !signature) throw new Error('media_capability_invalid');
    const payload = unb64(encoded); const expected = this.sign(payload); const actual = Buffer.from(signature); const expectedBytes = Buffer.from(expected);
    if (actual.length !== expectedBytes.length || !crypto.timingSafeEqual(actual, expectedBytes)) throw new Error('media_capability_invalid');
    let data;
    try { data = JSON.parse(payload); } catch { throw new Error('media_capability_invalid'); }
    if (data.kind !== 'media' || !data.tokenId || !data.resolvedUrl || now >= data.expiresAt || (tokenId && data.tokenId !== tokenId) || (creationId && data.creationId !== creationId) || (revision && data.revision !== revision)) throw new Error('media_capability_invalid');
    if (!Number.isInteger(data.maxBytes) || data.maxBytes <= 0) throw new Error('media_capability_invalid');
    return data;
  }
}

module.exports = { CapabilitySigner };
