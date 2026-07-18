const BANNED_SHAPES = [
  /plain\s+dashboard/i,
  /plain\s+search/i,
  /plain\s+quiz/i,
  /random\s+fact/i,
  /thin\s+clone/i,
  /plausible\s+startup/i,
  /clean\s+minimal\s+saas/i
];

function fail(code, diagnostics = [code]) { return { ok: false, code, diagnostics }; }

function text(value, min, max, label) {
  if (value === undefined || value === null) return `${label}_missing`;
  if (typeof value !== 'string') return `${label}_type`;
  if (value.trim().length < min || value.trim().length > max) return `${label}_length`;
  return null;
}

function array(value, label, errors) {
  if (value === undefined || value === null) { errors.push(`${label}_missing`); return false; }
  if (!Array.isArray(value)) { errors.push(`${label}_type`); return false; }
  return true;
}

function validateConcept(concept, { selectedApis = [], prior = [] } = {}) {
  try {
    if (!concept || typeof concept !== 'object' || Array.isArray(concept)) return fail('invalid_concept', ['concept_type']);
    const errors = [];
    for (const [value, min, max, label] of [
      [concept.appName, 4, 48, 'app_name'],
      [concept.premise, 20, 180, 'premise'],
      [concept.playerAction, 20, 180, 'player_action'],
      [concept.noveltyDelta, 8, 180, 'novelty_delta']
    ]) { const error = text(value, min, max, label); if (error) errors.push(error); }

    const selected = Array.isArray(selectedApis) ? selectedApis : [];
    const selectedIds = selected.map((api) => api && typeof api === 'object' ? (api.apiId || api.id) : null).filter((id) => typeof id === 'string').sort();
    if (!array(concept.apiIds, 'api_ids', errors)) return fail(errors[0] || 'api_ids_invalid', errors);
    concept.apiIds.forEach((id, index) => { if (typeof id !== 'string' || !id) errors.push(`api_ids_item_type:${index}`); });
    if (JSON.stringify([...concept.apiIds].sort()) !== JSON.stringify(selectedIds)) errors.push('api_ids_must_match_selection');

    const roles = Array.isArray(concept.apiRoles) ? concept.apiRoles : [];
    if (!array(concept.apiRoles, 'api_roles', errors)) return fail(errors[0] || 'api_roles_invalid', errors);
    const roleIds = [];
    roles.forEach((role, index) => {
      if (!role || typeof role !== 'object' || Array.isArray(role)) { errors.push(`api_role_type:${index}`); return; }
      const roleId = role.apiId;
      if (typeof roleId !== 'string' || !roleId) { errors.push(`api_role_api_id_missing:${index}`); return; }
      roleIds.push(roleId);
      if (!selectedIds.includes(roleId)) errors.push(`unknown_api_role:${roleId}`);
      const roleError = text(role.essentialRole, 15, 180, `api_role_essential_role:${roleId}`); if (roleError) errors.push(roleError);
      if (role.operations === undefined || role.operations === null) { errors.push(`api_role_operations_missing:${roleId}`); return; }
      if (!Array.isArray(role.operations)) { errors.push(`api_role_operations_type:${roleId}`); return; }
      if (!role.operations.length) errors.push(`api_role_operations_empty:${roleId}`);
      role.operations.forEach((operation, operationIndex) => {
        if (typeof operation !== 'string' || !operation) errors.push(`api_role_operation_type:${roleId}:${operationIndex}`);
      });
      const selectedApi = selected.find((api) => api && typeof api === 'object' && (api.apiId || api.id) === roleId);
      const allowed = selectedApi ? (Array.isArray(selectedApi.operationIds) ? selectedApi.operationIds : Array.isArray(selectedApi.operations) ? selectedApi.operations.map((candidate) => candidate && candidate.id).filter(Boolean) : []) : [];
      role.operations.forEach((operation) => { if (typeof operation === 'string' && !allowed.includes(operation)) errors.push(`api_role_operation_invalid:${roleId}:${operation}`); });
    });
    if (JSON.stringify([...roleIds].sort()) !== JSON.stringify(selectedIds)) errors.push('api_roles_must_cover_selection');

    if (!array(concept.causalChain, 'causal_chain', errors)) return fail(errors[0] || 'causal_chain_invalid', errors);
    if (concept.causalChain.length !== selectedIds.length) errors.push('causal_chain_must_cover_selection');
    const chainIds = [];
    concept.causalChain.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`causal_chain_item_type:${index}`); return; }
      if (!Number.isInteger(item.order)) errors.push(`causal_chain_order_type:${index}`);
      if (typeof item.apiId !== 'string' || !item.apiId) errors.push(`causal_chain_api_id_missing:${index}`); else chainIds.push(item.apiId);
      const actionError = text(item.action, 8, 120, `causal_chain_action:${index}`); if (actionError) errors.push(actionError);
    });
    if (JSON.stringify([...chainIds].sort()) !== JSON.stringify(selectedIds)) errors.push('causal_chain_ids_mismatch');

    const dependency = concept.dependency;
    if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) errors.push('dependency_type');
    else {
      if (typeof dependency.fromApiId !== 'string' || !dependency.fromApiId) errors.push('dependency_from_api_id_missing');
      if (!['api_input', 'rules', 'interface_state'].includes(dependency.to)) errors.push('dependency_to_invalid');
      if (dependency.toApiId !== undefined && typeof dependency.toApiId !== 'string') errors.push('dependency_to_api_id_type');
      const dependencyExplanation = text(dependency.explanation, 1, 240, 'dependency_explanation'); if (dependencyExplanation) errors.push(dependencyExplanation);
      if (typeof dependency.fromApiId === 'string' && !selectedIds.includes(dependency.fromApiId)) errors.push('dependency_from_api_id_invalid');
      if (typeof dependency.toApiId === 'string' && !selectedIds.includes(dependency.toApiId)) errors.push('invalid_dependency_target');
    }

    const interaction = concept.interaction;
    if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)) errors.push('interaction_type');
    else {
      if (!Array.isArray(interaction.controls)) errors.push('interaction_controls_missing');
      else { if (interaction.controls.length < 1 || interaction.controls.length > 4) errors.push('interaction_controls_length'); interaction.controls.forEach((control, index) => { if (typeof control !== 'string' || !control) errors.push(`interaction_control_type:${index}`); }); }
      const outcomeError = text(interaction.outcome, 8, 180, 'interaction_outcome'); if (outcomeError) errors.push(outcomeError);
    }

    const visual = concept.visualDirection;
    if (!visual || typeof visual !== 'object' || Array.isArray(visual)) errors.push('visual_direction_type');
    else for (const key of ['style', 'palette', 'typography', 'motion']) { const visualError = text(visual[key], 4, 100, `visual_${key}`); if (visualError) errors.push(visualError); }

    const assessment = concept.bannedShapeAssessment;
    if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) errors.push('banned_shape_assessment_type');
    else {
      for (const key of ['plainDashboard', 'plainSearch', 'plainQuiz', 'randomFactDisplay', 'thinClone', 'plausibleStartupPitch']) if (assessment[key] !== false) errors.push(`banned_shape_${key}_must_be_false`);
      const assessmentError = text(assessment.explanation, 12, 240, 'banned_shape_explanation'); if (assessmentError) errors.push(assessmentError);
    }

    const searchable = [concept.appName, concept.premise, concept.playerAction, concept.noveltyDelta].filter((value) => typeof value === 'string').join(' ');
    for (const pattern of BANNED_SHAPES) if (pattern.test(searchable)) errors.push(`banned_shape:${pattern}`);
    const normalized = `${typeof concept.appName === 'string' ? concept.appName : ''} ${typeof concept.premise === 'string' ? concept.premise : ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (Array.isArray(prior) && prior.some((item) => item && `${item.appName || ''} ${item.premise || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalized)) errors.push('novelty_repeat');
    return errors.length ? fail(errors[0], errors) : { ok: true, code: null, diagnostics: [] };
  } catch (error) {
    console.error('[randomware] concept validation failed', error);
    return fail('internal_validation_error', ['internal_validation_error']);
  }
}

module.exports = { validateConcept, BANNED_SHAPES };
