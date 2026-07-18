const BANNED_SHAPES = [
  /plain\s+dashboard/i,
  /plain\s+search/i,
  /plain\s+quiz/i,
  /random\s+fact/i,
  /thin\s+clone/i,
  /plausible\s+startup/i,
  /clean\s+minimal\s+saas/i
];

function fail(code, diagnostics) { return { ok: false, code, diagnostics }; }

function text(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) return `${label}_length`;
  return null;
}

function validateConcept(concept, { selectedApis = [], prior = [] } = {}) {
  if (!concept || typeof concept !== 'object') return fail('invalid_concept', ['concept must be an object']);
  const errors = [];
  for (const [value, min, max, label] of [
    [concept.appName, 4, 48, 'app_name'],
    [concept.premise, 20, 180, 'premise'],
    [concept.playerAction, 20, 180, 'player_action'],
    [concept.noveltyDelta, 8, 180, 'novelty_delta']
  ]) { const error = text(value, min, max, label); if (error) errors.push(error); }
  const selectedIds = selectedApis.map((api) => api.apiId || api.id).sort();
  const roles = Array.isArray(concept.apiRoles) ? concept.apiRoles : [];
  const roleIds = roles.map((role) => role.apiId).sort();
  if (JSON.stringify(roleIds) !== JSON.stringify(selectedIds)) errors.push('api_roles_must_cover_selection');
  for (const role of roles) {
    if (!selectedIds.includes(role.apiId)) errors.push(`unknown_api_role:${role.apiId}`);
    const roleError = text(role.essentialRole, 15, 180, `role:${role.apiId}`);
    if (roleError) errors.push(roleError);
    if (!Array.isArray(role.operations) || !role.operations.length) errors.push(`missing_operations:${role.apiId}`);
    const selected = selectedApis.find((api) => (api.apiId || api.id) === role.apiId);
    if (selected && role.operations.some((operation) => !selected.operationIds?.includes(operation) && !selected.operations?.some((candidate) => candidate.id === operation))) errors.push(`invalid_operation:${role.apiId}`);
  }
  if (!Array.isArray(concept.causalChain) || concept.causalChain.length !== selectedIds.length) errors.push('causal_chain_must_cover_selection');
  else {
    const chainIds = concept.causalChain.slice().sort((a, b) => a.order - b.order).map((item) => item.apiId).sort();
    if (JSON.stringify(chainIds) !== JSON.stringify(selectedIds)) errors.push('causal_chain_ids_mismatch');
    for (const item of concept.causalChain) if (!Number.isInteger(item.order) || text(item.action, 8, 120, `chain:${item.apiId}`)) errors.push(`invalid_chain:${item.apiId}`);
  }
  if (!concept.dependency || !selectedIds.includes(concept.dependency.fromApiId) || !['api_input', 'rules', 'interface_state'].includes(concept.dependency.to)) errors.push('invalid_dependency');
  else if (concept.dependency.toApiId && !selectedIds.includes(concept.dependency.toApiId)) errors.push('invalid_dependency_target');
  if (!concept.interaction || !Array.isArray(concept.interaction.controls) || concept.interaction.controls.length < 1 || concept.interaction.controls.length > 4 || text(concept.interaction.outcome, 8, 180, 'interaction_outcome')) errors.push('invalid_interaction');
  const visual = concept.visualDirection;
  if (!visual || ['style', 'palette', 'typography', 'motion'].some((key) => text(visual[key], 4, 100, `visual_${key}`))) errors.push('invalid_visual_direction');
  const assessment = concept.bannedShapeAssessment;
  if (!assessment || ['plainDashboard', 'plainSearch', 'plainQuiz', 'randomFactDisplay', 'thinClone', 'plausibleStartupPitch'].some((key) => assessment[key] !== false) || text(assessment.explanation, 12, 240, 'banned_shape_explanation')) errors.push('invalid_banned_shape_assessment');
  const searchable = [concept.appName, concept.premise, concept.playerAction, concept.noveltyDelta].join(' ');
  for (const pattern of BANNED_SHAPES) if (pattern.test(searchable)) errors.push(`banned_shape:${pattern}`);
  const normalized = `${concept.appName} ${concept.premise}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (prior.some((item) => `${item.appName} ${item.premise}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalized)) errors.push('novelty_repeat');
  return errors.length ? fail('invalid_concept', errors) : { ok: true, code: null, diagnostics: [] };
}

module.exports = { validateConcept, BANNED_SHAPES };
