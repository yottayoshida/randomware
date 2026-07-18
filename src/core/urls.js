const DEFAULT_COMPANION_ORIGIN = 'https://randomware.randomware.workers.dev';

function companionOrigin(value = DEFAULT_COMPANION_ORIGIN) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('companion_origin_invalid');
    return url.origin;
  } catch {
    return DEFAULT_COMPANION_ORIGIN;
  }
}

function companionUrl(origin, pathname) {
  return new URL(pathname, `${companionOrigin(origin)}/`).href;
}

function runUrls(run, origin) {
  return {
    statusUrl: companionUrl(origin, `/api/runs/${encodeURIComponent(run.id)}`),
    creationUrl: run.creationId ? companionUrl(origin, `/c/${encodeURIComponent(run.creationId)}`) : null
  };
}

module.exports = { DEFAULT_COMPANION_ORIGIN, companionOrigin, companionUrl, runUrls };

