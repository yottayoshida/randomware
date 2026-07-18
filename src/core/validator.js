const crypto = require('node:crypto');
const { ARTIFACT_CONTRACT } = require('./artifact-contract');

const BLOCKED_PATTERNS = ARTIFACT_CONTRACT.blockedPatternSources.map((source) => new RegExp(source, 'i'));

function fingerprint(html) {
  if (typeof html !== 'string') return { bytes: 0, sha256: null };
  return { bytes: Buffer.byteLength(html, 'utf8'), sha256: crypto.createHash('sha256').update(html).digest('hex') };
}

function fail(code, diagnostics, html) {
  return { ok: false, code, diagnostics, ...fingerprint(html) };
}

function validateDeclaredUses(declaredApiUses, selectedApis) {
  if (declaredApiUses === undefined) return null;
  if (!Array.isArray(declaredApiUses)) return 'declared_api_uses_type';
  const normalize = (items) => items.map((item) => ({ apiId: item?.apiId, operations: Array.isArray(item?.operations) ? [...item.operations].sort() : item?.operations })).sort((left, right) => String(left.apiId).localeCompare(String(right.apiId)));
  const expected = normalize(selectedApis.map((item) => ({ apiId: item.apiId, operations: item.operationIds })));
  const actual = normalize(declaredApiUses);
  return JSON.stringify(actual) === JSON.stringify(expected) ? null : 'declared_api_uses_must_match_selection';
}

function validateArtifact(html, { selectedApis = [], declaredApiUses } = {}) {
  if (typeof html !== 'string') return fail('artifact_missing', ['html must be a string'], html);
  const declaredUsesError = validateDeclaredUses(declaredApiUses, selectedApis);
  if (declaredUsesError) return fail('artifact_schema', [declaredUsesError], html);
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes < ARTIFACT_CONTRACT.byteRange.minimum || bytes > ARTIFACT_CONTRACT.byteRange.maximum) return fail('artifact_schema', [`artifact bytes ${bytes} outside ${ARTIFACT_CONTRACT.byteRange.minimum}..${ARTIFACT_CONTRACT.byteRange.maximum}`], html);
  if (!/^<!doctype html>/i.test(html.trim()) || !/<html[\s>]/i.test(html) || !/<head[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
    return fail('html_parse', ['doctype/html/head/body required'], html);
  }
  if ((html.match(/<\/?[a-z][^>]*>/gi) || []).length > ARTIFACT_CONTRACT.maxNodes) return fail('artifact_schema', [`node count exceeds ${ARTIFACT_CONTRACT.maxNodes}`], html);
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) return fail('artifact_schema', ['viewport marker missing'], html);
  for (const pattern of BLOCKED_PATTERNS) if (pattern.test(html)) return fail('policy_blocked', [`blocked pattern ${pattern}`], html);
  for (const literal of ARTIFACT_CONTRACT.markers) {
    const marker = literal.match(/"([^"]+)"/)?.[1];
    if (!marker || !new RegExp(`data-randomware=["']${marker}["']`, 'i').test(html)) return fail('artifact_schema', [`${marker || literal} marker missing`], html);
  }
  if (!/window\.randomware\.ready\s*\(\s*\)/.test(html)) return fail('artifact_schema', ['ready marker missing'], html);
  if (!/<(?:button|input|select|textarea)\b/i.test(html)) return fail('artifact_schema', ['interactive control missing'], html);
  for (const selected of selectedApis) {
    for (const operationId of selected.operationIds) {
      const call = new RegExp(`window\\.randomware\\.call\\(\\s*["']${selected.apiId}["']\\s*,\\s*["']${operationId}["']`);
      if (!call.test(html)) return fail('artifact_schema', [`missing broker call ${selected.apiId}/${operationId}`], html);
    }
  }
  const sha256 = crypto.createHash('sha256').update(html).digest('hex');
  return { ok: true, code: null, bytes, sha256, diagnostics: [] };
}

module.exports = { validateArtifact, validateDeclaredUses, BLOCKED_PATTERNS };
