const MEDIA_LIMITS = Object.freeze({ streamMs: 5 * 60 * 1000, bytesPerPage: 8 * 1024 * 1024, maxRedirects: 2 });

function isIpLiteral(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '');
  if (host.includes(':')) return true;
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function isLocalHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localdomain') || host === 'metadata.google.internal';
}

function archiveHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return host === 'archive.org' || host.endsWith('.archive.org');
}

function validateMediaUrl(value, { kind = 'radio-browser' } = {}) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error('media_url_invalid'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('media_scheme_rejected');
  if (url.username || url.password) throw new Error('media_credentials_rejected');
  if (isIpLiteral(url.hostname) || isLocalHostname(url.hostname)) throw new Error('media_private_host_rejected');
  if (kind === 'librivox' && !archiveHost(url.hostname)) throw new Error('media_host_rejected');
  return url;
}

function mediaMimeAllowed(contentType, url) {
  const mime = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  if (mime.startsWith('audio/')) return true;
  if (mime === 'application/ogg') return true;
  if (mime === 'application/octet-stream') return /\.(?:aac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i.test(String(url));
  return false;
}

function decodeXml(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function extractLibrivoxAudioUrl(xml) {
  const items = String(xml).match(/<(?:enclosure|media:content)\b[^>]*>/gi) || [];
  for (const item of items) {
    const url = item.match(/\burl\s*=\s*["']([^"']+)["']/i)?.[1];
    const type = item.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    if (url && /^audio\//i.test(type)) return decodeXml(url);
  }
  throw new Error('media_audio_source_missing');
}

async function fetchMedia({ target, request, fetcher = globalThis.fetch, kind = 'radio-browser', timeoutMs = MEDIA_LIMITS.streamMs } = {}) {
  let current = validateMediaUrl(target, { kind });
  const range = request?.headers?.get('range');
  for (let redirect = 0; redirect <= MEDIA_LIMITS.maxRedirects; redirect += 1) {
    let upstream;
    try {
      upstream = await fetcher(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: range ? { range } : {},
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('media_timeout');
      throw new Error('media_upstream_failure');
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      if (redirect >= MEDIA_LIMITS.maxRedirects) throw new Error('media_redirect_limit');
      const location = upstream.headers.get('location');
      if (!location) throw new Error('media_redirect_invalid');
      current = validateMediaUrl(new URL(location, current).toString(), { kind });
      continue;
    }
    if (!upstream.ok) throw new Error('media_upstream_failure');
    const contentType = upstream.headers.get('content-type') || '';
    if (!mediaMimeAllowed(contentType, current)) throw new Error('media_content_type_rejected');
    const contentLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MEDIA_LIMITS.bytesPerPage) throw new Error('media_bytes_cap');
    if (!upstream.body) throw new Error('media_body_missing');
    return { response: upstream, url: current, contentType };
  }
  throw new Error('media_redirect_limit');
}

function limitedStream(body, limit, onComplete, { signal } = {}) {
  const reader = body.getReader();
  let total = 0;
  let completed = false;
  let outputController;
  const finish = async () => { if (!completed) { completed = true; if (signal) signal.removeEventListener('abort', abort); await onComplete(total); } };
  const abort = () => { void (async () => { try { await reader.cancel('media_client_aborted'); } finally { await finish(); try { outputController?.error(new Error('media_client_aborted')); } catch {} } })(); };
  return new ReadableStream({
    start(controller) { outputController = controller; if (signal?.aborted) abort(); else if (signal) signal.addEventListener('abort', abort, { once: true }); },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { await finish(); controller.close(); return; }
        const bytes = value?.byteLength || value?.length || 0;
        if (total + bytes > limit) {
          try { await reader.cancel('media_bytes_cap'); } finally { await finish(); } controller.error(new Error('media_bytes_cap')); return;
        }
        total += bytes; controller.enqueue(value);
      } catch (error) {
        await finish(); controller.error(error);
      }
    },
    async cancel(reason) { try { await reader.cancel(reason); } finally { await finish(); } }
  });
}

module.exports = { MEDIA_LIMITS, isIpLiteral, isLocalHostname, archiveHost, validateMediaUrl, mediaMimeAllowed, extractLibrivoxAudioUrl, fetchMedia, limitedStream };
