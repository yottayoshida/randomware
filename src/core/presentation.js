const { registry } = require('./registry');
const { deathCertificate } = require('./failure');
const { getStyle } = require('./style-deck');

const RUNTIME_CONTRACT_CUTOFF_MS = 1784392071657;
const REPOSITORY_URL = 'https://github.com/yottayoshida/randomware';
const CONNECT_URL = `${REPOSITORY_URL}#chatgpt-prerequisites-and-connect`;
const registryById = new Map(registry.map((entry) => [entry.id, entry]));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function selectedDisplay(run) {
  return (run.selectedApis || []).map(({ apiId, operationIds = [] }) => {
    const entry = registryById.get(apiId);
    return entry ? { id: apiId, symbol: entry.symbol, name: entry.name, capability: entry.capability, category: entry.category, docsUrl: entry.docsUrl, operationIds } : { id: apiId, symbol: '❓', name: apiId, capability: 'archived source', category: 'unknown', docsUrl: '/api/registry', operationIds };
  });
}

function isEarlySpecimen(run) {
  const acceptedAt = (run.revisions || []).find((revision) => revision.status === 'accepted')?.at;
  return Number(acceptedAt || run.createdAt) < RUNTIME_CONTRACT_CUTOFF_MS;
}

function isMachineSpecimen(run) {
  const appName = String(run.concept?.appName || '');
  const requestId = String(run.requestId || '');
  return /^(MCP (primary|audio|asset|repair)|Gate 5 specimen|Synthetic\b|Browser Chrome Check)/i.test(appName)
    || /^(synthetic-|browser-|gate-)/i.test(requestId);
}

function applyListingPolicy(run) {
  run.listed = !isMachineSpecimen(run) && !isEarlySpecimen(run);
  return run;
}

function selectedBadges(run) {
  return selectedDisplay(run).map((api) => `<span class="api-badge category-${escapeHtml(api.category)}"><span aria-hidden="true">${escapeHtml(api.symbol)}</span> ${escapeHtml(api.name)}</span>`).join('');
}

function styleDisplay(run) {
  try { return run.styleId ? getStyle(run.styleId) : null; } catch { return null; }
}

function showcasePage(runs) {
  const creations = (runs || []).filter((run) => run.listed !== false && !run.unpublished && ['completed', 'failed'].includes(run.phase));
  const hero = creations.find((run) => run.phase === 'completed' && !isEarlySpecimen(run));
  const heroHtml = hero ? `<section class="hero-machine" aria-labelledby="live-specimen-title"><header class="machine-title" id="live-specimen-title">LIVE SPECIMEN — ${escapeHtml(hero.concept?.appName || 'Untitled collision')}</header><div class="machine-body"><iframe title="Live specimen: ${escapeHtml(hero.concept?.appName || 'Untitled collision')}" sandbox="allow-scripts" credentialless referrerpolicy="no-referrer" src="/run/${encodeURIComponent(hero.creationId)}"></iframe><a href="/c/${encodeURIComponent(hero.creationId)}">Open the complete specimen record →</a></div></section>` : '<section class="hero-machine hero-empty"><header class="machine-title">LIVE SPECIMEN — CABINET PENDING</header><div class="machine-body"><p>No accepted public specimen is currently cleared for the window.</p></div></section>';
  const cards = creations.length ? creations.slice(0, 24).map((run) => `<article class="specimen-card"><div class="specimen-symbols">${selectedBadges(run)}</div><h2><a href="/c/${encodeURIComponent(run.creationId)}">${escapeHtml(run.concept?.appName || 'Untitled collision')}</a></h2><p>${escapeHtml(run.concept?.premise || 'A generated collision whose paperwork survived.')}</p></article>`).join('') : '<p class="empty">No curated specimens yet. The cabinet is clean, not broken.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Randomware — Real APIs go in</title><link rel="stylesheet" href="/styles.css"></head><body><header class="judge-strip" id="for-judges"><strong>For judges</strong><nav aria-label="Judge links"><a href="#demo-video-pending">Demo video <span class="muted">(link pending)</span></a><a href="${CONNECT_URL}">Connect in ChatGPT</a><a href="${REPOSITORY_URL}">GitHub repository</a></nav></header><main class="shell"><header class="masthead"><p class="eyebrow">A slot machine for software</p><h1>Randomware</h1><p class="tagline">Real APIs go in. Random apps come out.</p><p class="lede">Randomware collides bounded public APIs, asks a model for one causal absurdity, then publishes the sandboxed specimen with its receipts and failures intact.</p><a class="primary" href="${CONNECT_URL}">Spin it yourself →</a><span id="demo-video-pending" class="anchor-target" aria-label="Demo video placeholder"></span></header>${heroHtml}<section aria-labelledby="specimens-title"><p class="eyebrow">Curated showcase</p><h2 id="specimens-title">Specimens that earned shelf space</h2><div class="specimen-grid">${cards}</div></section><footer class="site-footer"><p>${registry.length} bounded public sources. No machine-check specimens in the cabinet.</p><a href="/api/registry">Inspect registry metadata</a></footer></main></body></html>`;
}

function pageShell(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Randomware</title><link rel="stylesheet" href="/creation.css"></head><body><header class="rw-site-header"><a href="/">← Randomware showcase</a></header><main class="rw-shell">${content}</main><footer class="rw-site-footer"><a href="/">See other specimens</a><span aria-hidden="true"> / </span><a href="${CONNECT_URL}">Spin your own</a></footer></body></html>`;
}

function earlyBanner(run) {
  return isEarlySpecimen(run) ? '<aside class="rw-early" role="note">This early specimen is preserved but no longer boots — built before the runtime contract.</aside>' : '';
}

function creationPage(run, revision) {
  const name = run.concept?.appName || 'Untitled collision';
  const style = styleDisplay(run);
  const early = isEarlySpecimen(run);
  const apis = selectedDisplay(run).map((api) => `<li class="category-${escapeHtml(api.category)}"><span class="rw-api-symbol" aria-hidden="true">${escapeHtml(api.symbol)}</span><a href="${escapeHtml(api.docsUrl)}">${escapeHtml(api.name)}</a> — ${escapeHtml(api.capability)} · category: ${escapeHtml(api.category)}</li>`).join('');
  const revisions = (run.revisions || []).map((item) => `<li><a href="/api/creations/${encodeURIComponent(run.creationId)}/source?revision=${item.revision}">Revision ${item.revision}</a> · ${escapeHtml(item.status)} · ${Number(item.bytes || 0).toLocaleString('en-US')} bytes</li>`).join('');
  const specimen = early ? '<section class="rw-preserved"><h2>Runtime retired</h2><p>The frozen source and receipts remain inspectable. This pre-contract specimen is not executed.</p></section>' : `<section class="rw-frame-wrap"><iframe class="rw-frame" title="Generated app" sandbox="allow-scripts" credentialless referrerpolicy="no-referrer" src="/run/${encodeURIComponent(run.creationId)}"></iframe><p class="rw-overflow-cue">The specimen may continue inside its frame; scroll within it if the lower machinery is still humming.</p></section>`;
  const content = `${earlyBanner(run)}<section class="rw-chrome rw-record"><div class="rw-stamp">Accepted · Rev ${revision.revision}</div><p class="rw-kicker">RANDOMWARE SPECIMEN RECORD</p><h1>${escapeHtml(name)}</h1><p class="rw-premise">${escapeHtml(run.concept?.premise || 'A generated collision.')}</p>${style ? `<p class="rw-style">STYLE CARTRIDGE: ${escapeHtml(style.symbol)} ${escapeHtml(style.name)} · <code>${escapeHtml(style.id)}</code></p>` : ''}<p><strong>Do not enter real personal, payment, authentication, or secret data.</strong></p><h2>Selected APIs</h2><ul class="rw-api-list">${apis}</ul><nav class="rw-actions" aria-label="Specimen actions"><a href="/api/creations/${encodeURIComponent(run.creationId)}/download">Download HTML</a><a href="/api/creations/${encodeURIComponent(run.creationId)}/spec">Keeper spec</a><a href="/api/creations/${encodeURIComponent(run.creationId)}/spec/download">Download spec</a><a href="/api/creations/${encodeURIComponent(run.creationId)}/requests">Inspect requests</a><a href="/api/creations/${encodeURIComponent(run.creationId)}/dataflow">Inspect dataflow</a><a href="/api/creations/${encodeURIComponent(run.creationId)}/report">Report/remove</a></nav><h2 class="rw-kicker">Source revisions</h2><ul class="rw-revisions">${revisions}</ul><footer class="rw-document-nav"><a href="/">See other specimens</a><span aria-hidden="true"> / </span><a href="${CONNECT_URL}">Spin your own</a></footer></section>${specimen}<p class="rw-receipt">Specimen ${escapeHtml(run.creationId)} · accepted revision ${revision.revision}</p>`;
  return pageShell(name, content);
}

function failurePage(run) {
  const certificate = deathCertificate(run.failure?.code || 'capacity_reached', { detail: run.failure?.detail, specimenId: run.creationId, revisions: run.revisions });
  const content = `${earlyBanner(run)}<section class="rw-chrome rw-record rw-failure"><div class="rw-stamp">Deceased</div><p class="rw-kicker">RANDOMWARE SPECIMEN RECORD</p><h1>Failed Creation</h1><p>The specimen stopped honestly. Cause: <code>${escapeHtml(certificate.code)}</code></p><p>${escapeHtml(certificate.detail)}</p><p>${escapeHtml(certificate.epitaph)}</p><nav class="rw-actions"><a href="/api/creations/${encodeURIComponent(run.creationId)}/requests">Inspect requests</a><a href="/api/creations/${encodeURIComponent(run.creationId)}/dataflow">Inspect dataflow</a><a href="/api/runs/${encodeURIComponent(run.id)}">Raw run</a></nav></section>`;
  return pageShell('Failed Creation', content);
}

function requestRows(run) {
  return (run.runtimeRequests || []).map((item) => {
    const entry = registryById.get(item.apiId);
    const duration = Number.isFinite(Number(item.endedAt) - Number(item.startedAt)) ? Math.max(0, Number(item.endedAt) - Number(item.startedAt)) : null;
    return `<tr><td>${escapeHtml(entry?.name || item.apiId)}</td><td><code>${escapeHtml(item.operationId)}</code></td><td>${item.status === 'ok' ? 'ok' : 'failed'}</td><td>${duration == null ? '—' : `${duration} ms`}</td><td>${item.cacheHit ? 'yes' : 'no'}</td></tr>`;
  }).join('');
}

function requestsPage(run) {
  const rows = requestRows(run) || '<tr><td colspan="5">No runtime calls reached the clerk.</td></tr>';
  return pageShell('Request autopsy', `<section class="rw-chrome"><p class="rw-kicker">Deadpan autopsy</p><h1>Request receipts</h1><p>The machine asked. The sources answered, declined, or took too long.</p><div class="rw-table-wrap"><table><thead><tr><th>API</th><th>operation</th><th>result</th><th>duration</th><th>cached</th></tr></thead><tbody>${rows}</tbody></table></div><p><a href="?format=raw">raw JSON</a></p></section>`);
}

function humanTime(value) {
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? 'time unavailable' : date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function dataflowPage(run, flow) {
  const requests = run.runtimeRequests || [];
  const operations = (flow || []).flatMap((item) => (item.operationIds || [item.operationId]).filter(Boolean).map((operationId) => ({ ...item, operationId })));
  const steps = operations.map((item) => {
    const request = requests.find((candidate) => candidate.apiId === item.apiId && candidate.operationId === item.operationId);
    const entry = registryById.get(item.apiId);
    return `<li><time datetime="${escapeHtml(new Date(Number(request?.startedAt || run.createdAt)).toISOString())}">${escapeHtml(humanTime(request?.startedAt || run.createdAt))}</time><strong>${escapeHtml(entry?.name || item.apiId)}</strong> / <code>${escapeHtml(item.operationId)}</code> — ${escapeHtml(item.status || 'selected')}</li>`;
  }).join('') || '<li>The chain left no runtime footprints.</li>';
  return pageShell('Dataflow autopsy', `<section class="rw-chrome"><p class="rw-kicker">Deadpan autopsy</p><h1>Dataflow, in order</h1><p>Each source had a job. This is the order in which the paperwork says it happened.</p><ol class="rw-dataflow">${steps}</ol><p><a href="?format=raw">raw JSON</a></p></section>`);
}

function reportPage(run, posted = false) {
  if (posted) return pageShell('Report received', '<section class="rw-chrome"><h1>Report received</h1><p>The specimen left the showcase immediately. The evidence stayed put for the owner.</p></section>');
  return pageShell('Report specimen', `<section class="rw-chrome"><p class="rw-kicker">Moderation desk</p><h1>Report or remove</h1><p>A report hides this specimen from public lists immediately. Owner removal uses the authenticated owner route and is not offered by this public form.</p><form method="post" action="/api/creations/${encodeURIComponent(run.creationId)}/report"><label for="reason">Reason</label><select id="reason" name="reason"><option value="unsafe">Unsafe or harmful</option><option value="broken">Broken or misleading</option><option value="rights">Rights or attribution concern</option><option value="other">Other</option></select><button type="submit">Report and hide</button></form></section>`);
}

function retiredRuntimePage(run) {
  return pageShell('Runtime retired', `${earlyBanner(run)}<section class="rw-preserved"><h1>Runtime retired</h1><p>The frozen source and receipts remain inspectable. This pre-contract specimen is not executed.</p></section>`);
}

module.exports = { RUNTIME_CONTRACT_CUTOFF_MS, CONNECT_URL, REPOSITORY_URL, escapeHtml, selectedDisplay, isEarlySpecimen, isMachineSpecimen, applyListingPolicy, showcasePage, creationPage, failurePage, requestsPage, dataflowPage, reportPage, retiredRuntimePage };
