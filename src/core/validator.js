const crypto = require('node:crypto');

const BLOCKED_PATTERNS = [
  /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/i,
  /\b(?:import\s*\(|eval\s*\(|new\s+Function\b|Worker\s*\(|SharedWorker\s*\()/i,
  /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie|window\.openai)\b/i,
  /(?:\bparent\b|\btop\b|\bopener\b)\s*[.\[]/i,
  /(?:innerHTML|outerHTML|insertAdjacentHTML|srcdoc|javascript:)/i,
  /\bdocument\s*\.\s*write\b/i,
  /\b(?:location|history)\s*\.\s*(?:assign|replace|pushState|back|forward)\b/i,
  /<\s*(?:iframe|frame|object|embed|applet|portal)\b/i,
  /<\s*(?:input|textarea)[^>]+(?:password|credit-card|cvv|ssn|email|phone|address|bank|login|secret)/i,
  /<\s*(?:script|link|style)[^>]+(?:src|href)=\s*["'](?:https?:|\/\/)/i,
  /<\s*(?:img|audio|video|source|track)[^>]+(?:src|srcset)=\s*["'](?!data:|#|\/api\/)/i,
  /url\(\s*["']?(?:https?:|\/\/|javascript:)/i,
  /<\s*meta[^>]+http-equiv=\s*["']refresh/i,
  /<\s*(?:svg|math|form)\b/i,
  /\b(?:on[a-z]+|action)\s*=\s*["'][^"']*(?:https?:|javascript:|\/\/)/i
];

function fingerprint(html) {
  if (typeof html !== 'string') return { bytes: 0, sha256: null };
  return { bytes: Buffer.byteLength(html, 'utf8'), sha256: crypto.createHash('sha256').update(html).digest('hex') };
}

function fail(code, diagnostics, html) {
  return { ok: false, code, diagnostics, ...fingerprint(html) };
}

function validateArtifact(html, { selectedApis = [] } = {}) {
  if (typeof html !== 'string') return fail('artifact_missing', ['html must be a string'], html);
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes < 10000 || bytes > 40000) return fail('artifact_schema', [`artifact bytes ${bytes} outside 10000..40000`], html);
  if (!/^<!doctype html>/i.test(html.trim()) || !/<html[\s>]/i.test(html) || !/<head[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
    return fail('html_parse', ['doctype/html/head/body required'], html);
  }
  if ((html.match(/<\/?[a-z][^>]*>/gi) || []).length > 2000) return fail('artifact_schema', ['node count exceeds 2000'], html);
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) return fail('artifact_schema', ['viewport marker missing'], html);
  for (const pattern of BLOCKED_PATTERNS) if (pattern.test(html)) return fail('policy_blocked', [`blocked pattern ${pattern}`], html);
  for (const marker of ['loading', 'error', 'interactive', 'attribution']) {
    if (!new RegExp(`data-randomware=["']${marker}["']`, 'i').test(html)) return fail('artifact_schema', [`${marker} marker missing`], html);
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

module.exports = { validateArtifact, BLOCKED_PATTERNS };
