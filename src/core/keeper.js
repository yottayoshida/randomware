const { escapeHtml } = require('./artifact');

function lines(value) {
  return Array.isArray(value) ? value : [];
}

function specText(run) {
  const concept = run.concept || {};
  const roles = lines(concept.apiRoles).map((role) => `- ${role.apiId}: ${role.essentialRole} [${lines(role.operations).join(', ')}]`);
  const chain = lines(concept.causalChain).sort((left, right) => (left.order || 0) - (right.order || 0)).map((item) => `${item.order}. ${item.apiId}: ${item.action}`);
  const visual = concept.visualDirection || {};
  return [
    'RANDOMWARE KEEPER SPEC',
    `Creation: ${run.creationId || 'unpublished'}`,
    `Name: ${concept.appName || 'Untitled collision'}`,
    `Premise: ${concept.premise || ''}`,
    `Player action: ${concept.playerAction || ''}`,
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
  const text = specText(run);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Randomware keeper spec</title><style>body{margin:0;padding:clamp(24px,7vw,90px);background:#101326;color:#f6e9ce;font:17px/1.55 Georgia,serif}main{max-width:850px;margin:auto;border:2px solid #6ee7c8;padding:clamp(24px,5vw,56px);box-shadow:12px 12px 0 #ff765e}h1{font-size:clamp(2rem,7vw,5rem);line-height:.9;margin-top:0}pre{white-space:pre-wrap;font:inherit}a{color:#6ee7c8}</style></head><body><main><p>RANDOMWARE KEEPER SPEC</p><h1>${escapeHtml(run.concept?.appName || 'Untitled collision')}</h1><pre>${escapeHtml(text)}</pre></main></body></html>`;
}

module.exports = { specText, specHtml };
