const { isIpLiteral, isLocalHostname } = require('./media');

const ASSET_LIMITS = Object.freeze({ ttlMs: 10 * 60 * 1000, bytesEach: 2 * 1024 * 1024, bytesPerPage: 8 * 1024 * 1024, maxRedirects: 2, timeoutMs: 6000 });
const IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml']);

function inlineImage(value) {
  const match = String(value).match(/^data:(image\/(?:jpeg|png|gif|webp|avif|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || !imageMimeAllowed(match[1])) throw new Error('asset_data_invalid');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.byteLength || bytes.byteLength > ASSET_LIMITS.bytesEach) throw new Error('asset_bytes_cap');
  return { contentType: match[1].toLowerCase(), bytes };
}

function prepareAssetData(apiId, value) {
  const data = structuredClone(value);
  if (apiId === 'artic') {
    const base = typeof data?.config?.iiif_url === 'string' ? data.config.iiif_url.replace(/\/$/, '') : null;
    const items = Array.isArray(data?.data) ? data.data : (data?.data && typeof data.data === 'object' ? [data.data] : []);
    for (const item of items) {
      if (typeof item?.thumbnail?.lqip === 'string') item.image_url = item.thumbnail.lqip;
      else if (base && item?.image_id) item.image_url = `${base}/${encodeURIComponent(item.image_id)}/full/843,/0/default.jpg`;
      if (item?.thumbnail) delete item.thumbnail;
    }
    if (data?.config) delete data.config.iiif_url;
  }
  if (apiId === 'wiki-onthisday') {
    return {
      selected: (Array.isArray(data?.selected) ? data.selected : (Array.isArray(data?.events) ? data.events : [])).slice(0, 3).map((event) => ({
        text: event?.text, year: event?.year,
        pages: (Array.isArray(event?.pages) ? event.pages : []).slice(0, 1).map((page) => ({
          title: page?.title, normalizedtitle: page?.normalizedtitle, description: page?.description,
          thumbnail: page?.thumbnail?.source ? { source: page.thumbnail.source, width: page.thumbnail.width, height: page.thumbnail.height } : null,
          originalimage: page?.originalimage?.source ? { source: page.originalimage.source, width: page.originalimage.width, height: page.originalimage.height } : null,
          content_urls: page?.content_urls?.desktop?.page ? { desktop: { page: page.content_urls.desktop.page } } : null
        }))
      }))
    };
  }
  if (apiId === 'randomuser') {
    return { results: (Array.isArray(data?.results) ? data.results : []).slice(0, 1).map((person) => ({ gender: person?.gender, name: person?.name, nat: person?.nat, picture: person?.picture })) };
  }
  if (apiId === 'met-museum') {
    return {
      objectID: data?.objectID ?? null,
      title: data?.title ?? null,
      artistDisplayName: data?.artistDisplayName ?? null,
      objectDate: data?.objectDate ?? null,
      medium: data?.medium ?? null,
      dimensions: data?.dimensions ?? null,
      classification: data?.classification ?? null,
      department: data?.department ?? null,
      culture: data?.culture ?? null,
      period: data?.period ?? null,
      dynasty: data?.dynasty ?? null,
      country: data?.country ?? null,
      objectName: data?.objectName ?? null,
      creditLine: data?.creditLine ?? null,
      repository: data?.repository ?? null,
      objectURL: data?.objectURL ?? null,
      isPublicDomain: data?.isPublicDomain ?? null,
      primaryImage: data?.primaryImage ?? null,
      primaryImageSmall: data?.primaryImageSmall ?? null
    };
  }
  if (apiId === 'rickandmorty') {
    return { id: data?.id, name: data?.name, status: data?.status, species: data?.species, type: data?.type, gender: data?.gender, origin: { name: data?.origin?.name }, location: { name: data?.location?.name }, image: data?.image };
  }
  if (apiId === 'tvmaze' && Array.isArray(data)) return data.slice(0, 5);
  return data;
}

function patternMatches(pattern, path) {
  const expected = pattern.split('.');
  return expected.length === path.length && expected.every((part, index) => part === '*' || part === String(path[index]));
}

function validateAssetUrl(value, policy) {
  let url;
  try { url = new URL(value); } catch { throw new Error('asset_url_invalid'); }
  if (url.protocol === 'data:') {
    if (!policy?.allowDataImages) throw new Error('asset_scheme_rejected');
    inlineImage(url.href);
    return url;
  }
  if (url.protocol !== 'https:') throw new Error('asset_scheme_rejected');
  if (url.username || url.password) throw new Error('asset_credentials_rejected');
  if (isIpLiteral(url.hostname) || isLocalHostname(url.hostname)) throw new Error('asset_private_host_rejected');
  const allowed = new Set((policy?.allowedHosts || []).map((host) => String(host).toLowerCase()));
  if (!allowed.has(url.hostname.toLowerCase())) throw new Error('asset_host_rejected');
  return url;
}

function collectAssetCandidates(entry, data) {
  const candidates = [];
  const patterns = entry.assetPolicy?.resolvedPaths || [];
  const walk = (value, path = []) => {
    if (typeof value === 'string' && patterns.some((pattern) => patternMatches(pattern, path))) {
      candidates.push({ path, resolvedUrl: validateAssetUrl(value, entry.assetPolicy).href });
      return;
    }
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index]));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) walk(item, [...path, key]);
  };
  walk(data);
  return candidates;
}

function setAtPath(root, path, value) {
  let current = root;
  for (let index = 0; index < path.length - 1; index += 1) current = current?.[path[index]];
  if (current && path.length) current[path[path.length - 1]] = value;
}

async function rewriteAssetCandidates(data, candidates, makeUrl) {
  const rewritten = structuredClone(data);
  for (const candidate of candidates) setAtPath(rewritten, candidate.path, await makeUrl(candidate));
  return rewritten;
}

function imageMimeAllowed(value) {
  return IMAGE_TYPES.includes(String(value || '').split(';')[0].trim().toLowerCase());
}

async function fetchAsset({ target, policy, fetcher = globalThis.fetch }) {
  let current = validateAssetUrl(target, policy);
  if (current.protocol === 'data:') {
    const inline = inlineImage(current.href);
    return { response: new Response(inline.bytes, { status: 200, headers: { 'content-type': inline.contentType, 'content-length': String(inline.bytes.byteLength) } }), url: current, contentType: inline.contentType, contentLength: inline.bytes.byteLength };
  }
  for (let redirect = 0; redirect <= ASSET_LIMITS.maxRedirects; redirect += 1) {
    let response;
    try {
      response = await fetcher(current.href, { method: 'GET', redirect: 'manual', headers: { accept: IMAGE_TYPES.join(', ') }, signal: AbortSignal.timeout(ASSET_LIMITS.timeoutMs) });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('asset_timeout');
      throw new Error('asset_upstream_failure');
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect >= ASSET_LIMITS.maxRedirects) throw new Error('asset_redirect_limit');
      const location = response.headers.get('location');
      if (!location) throw new Error('asset_redirect_invalid');
      current = validateAssetUrl(new URL(location, current).href, policy);
      continue;
    }
    if (!response.ok) throw new Error('asset_upstream_failure');
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!imageMimeAllowed(contentType)) throw new Error('asset_content_type_rejected');
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > ASSET_LIMITS.bytesEach) throw new Error('asset_bytes_cap');
    return { response, url: current, contentType, contentLength: Number.isFinite(contentLength) ? contentLength : null };
  }
  throw new Error('asset_redirect_limit');
}

function limitedAssetStream(body, limit, onComplete) {
  const reader = body.getReader(); let total = 0; let completed = false;
  const finish = async () => { if (!completed) { completed = true; await onComplete(total); } };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { await finish(); controller.close(); return; }
        const bytes = value?.byteLength || value?.length || 0;
        if (total + bytes > limit) { await reader.cancel('asset_bytes_cap'); await finish(); controller.error(new Error('asset_bytes_cap')); return; }
        total += bytes; controller.enqueue(value);
      } catch (error) { await finish(); controller.error(error); }
    },
    async cancel(reason) { await reader.cancel(reason); await finish(); }
  });
}

module.exports = { ASSET_LIMITS, prepareAssetData, collectAssetCandidates, setAtPath, rewriteAssetCandidates, validateAssetUrl, imageMimeAllowed, inlineImage, fetchAsset, limitedAssetStream };
