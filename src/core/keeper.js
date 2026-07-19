const { escapeHtml } = require('./artifact');
const { getStyle } = require('./style-deck');

function lines(value) {
  return Array.isArray(value) ? value : [];
}

function specText(run) {
  const concept = run.concept || {};
  const style = run.styleId ? getStyle(run.styleId) : null;
  const roles = lines(concept.apiRoles).map((role) => `- ${role.apiId}: ${role.essentialRole} [${lines(role.operations).join(', ')}]`);
  const chain = lines(concept.causalChain).sort((left, right) => (left.order || 0) - (right.order || 0)).map((item) => `${item.order}. ${item.apiId}: ${item.action}`);
  const visual = concept.visualDirection || {};
  return [
    'RANDOMWARE KEEPER SPEC',
    `Creation: ${run.creationId || 'unpublished'}`,
    `Name: ${concept.appName || 'Untitled collision'}`,
    `Premise: ${concept.premise || ''}`,
    `Player action: ${concept.playerAction || ''}`,
    `Style cartridge: ${style ? `${style.symbol} ${style.name} (${style.id})` : concept.styleId || 'not recorded'}`,
    ...(style ? [`Style palette: ${style.palette}`, `Style typography: ${style.typography}`, `Style motion: ${style.motion}`, `Style era: ${style.era}`, `Style caution: ${style.avoid}`] : []),
    '',
    'Causal chain:',
    ...(chain.length ? chain : ['(not recorded)']),
    '',
    'API roles:',
    ...(roles.length ? roles : ['(not recorded)']),
    '',
    'Dependency:',
    concept.dependency ? `${concept.dependency.fromApiId} -> ${concept.dependency.to}${concept.dependency.toApiId ? ` -> ${concept.dependency.toApiId}` : ''}: ${concept.dependency.explanation || ''}` : '(not recorded)',
    '',
    'Interaction:',
    concept.interaction ? `Controls: ${lines(concept.interaction.controls).join(', ')}\nOutcome: ${concept.interaction.outcome || ''}` : '(not recorded)',
    '',
    'Visual direction:',
    `Style: ${visual.style || ''}`,
    `Palette: ${visual.palette || ''}`,
    `Typography: ${visual.typography || ''}`,
    `Motion: ${visual.motion || ''}`,
    '',
    `Novelty delta: ${concept.noveltyDelta || ''}`
  ].join('\n');
}

function specHtml(run) {
  const concept = run.concept || {};
  const style = run.styleId ? getStyle(run.styleId) : null;
  const chain = lines(concept.causalChain).sort((left, right) => (left.order || 0) - (right.order || 0)).map((item) => `<li><strong>${escapeHtml(item.order || '—')}. ${escapeHtml(item.apiId || 'unknown')}</strong>${escapeHtml(item.action || 'Not recorded.')}</li>`).join('') || '<li><strong>—</strong>Not recorded.</li>';
  const roles = lines(concept.apiRoles).map((role) => `<tr><td>${escapeHtml(role.apiId || 'unknown')}</td><td>${escapeHtml(lines(role.operations).join(', ') || '—')}</td><td>${escapeHtml(role.essentialRole || 'Not recorded.')}</td></tr>`).join('') || '<tr><td colspan="3">Not recorded.</td></tr>';
  const dependency = concept.dependency ? `${concept.dependency.fromApiId || 'unknown'} → ${concept.dependency.to || 'unknown'}${concept.dependency.toApiId ? ` → ${concept.dependency.toApiId}` : ''}: ${concept.dependency.explanation || 'Not recorded.'}` : 'Not recorded.';
  const visual = concept.visualDirection || {};
  const creationId = escapeHtml(run.creationId || 'unpublished');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(concept.appName || 'Untitled collision')} — Keeper spec</title><link rel="stylesheet" href="/creation.css"></head><body><header class="rw-site-header"><a href="/">← Randomware showcase</a></header><main class="rw-shell"><article class="rw-chrome rw-record rw-keeper"><div class="rw-stamp">Keeper copy</div><p class="rw-kicker">RANDOMWARE KEEPER SPEC</p><h1>${escapeHtml(concept.appName || 'Untitled collision')}</h1><p class="rw-premise">${escapeHtml(concept.premise || 'A generated collision.')}</p><dl class="rw-spec-meta"><div><dt>Creation</dt><dd>${creationId}</dd></div><div><dt>Player action</dt><dd>${escapeHtml(concept.playerAction || 'Not recorded.')}</dd></div><div><dt>Style cartridge</dt><dd>${style ? `${escapeHtml(style.symbol)} ${escapeHtml(style.name)} · ${escapeHtml(style.id)}` : escapeHtml(concept.styleId || 'Not recorded.')}</dd></div><div><dt>Novelty delta</dt><dd>${escapeHtml(concept.noveltyDelta || 'Not recorded.')}</dd></div></dl><section class="rw-spec-section"><h2>Causal chain</h2><ol class="rw-dataflow">${chain}</ol></section><section class="rw-spec-section"><h2>API roles</h2><div class="rw-table-wrap"><table><thead><tr><th>API</th><th>Operations</th><th>Essential role</th></tr></thead><tbody>${roles}</tbody></table></div></section><section class="rw-spec-grid"><section class="rw-spec-section"><h2>Dependency</h2><p>${escapeHtml(dependency)}</p></section><section class="rw-spec-section"><h2>Interaction</h2><p><strong>Controls:</strong> ${escapeHtml(lines(concept.interaction?.controls).join(', ') || 'Not recorded.')}</p><p><strong>Outcome:</strong> ${escapeHtml(concept.interaction?.outcome || 'Not recorded.')}</p></section><section class="rw-spec-section"><h2>Visual direction</h2><p><strong>Style:</strong> ${escapeHtml(visual.style || 'Not recorded.')}</p><p><strong>Palette:</strong> ${escapeHtml(visual.palette || 'Not recorded.')}</p><p><strong>Typography:</strong> ${escapeHtml(visual.typography || 'Not recorded.')}</p><p><strong>Motion:</strong> ${escapeHtml(visual.motion || 'Not recorded.')}</p></section>${style ? `<section class="rw-spec-section"><h2>Cartridge receipt</h2><p><strong>Palette:</strong> ${escapeHtml(style.palette)}</p><p><strong>Typography:</strong> ${escapeHtml(style.typography)}</p><p><strong>Motion:</strong> ${escapeHtml(style.motion)}</p><p><strong>Era:</strong> ${escapeHtml(style.era)}</p><p><strong>Caution:</strong> ${escapeHtml(style.avoid)}</p></section>` : ''}</section><footer class="rw-document-nav"><a href="/c/${encodeURIComponent(run.creationId || '')}">Return to specimen</a><span aria-hidden="true"> / </span><a href="/api/creations/${encodeURIComponent(run.creationId || '')}/spec/download">Download plain-text spec</a><span aria-hidden="true"> / </span><a href="/">See other specimens</a></footer></article><p class="rw-receipt">Keeper record · ${creationId}</p></main></body></html>`;
}

module.exports = { specText, specHtml };
