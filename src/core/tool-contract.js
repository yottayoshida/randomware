const string = (description = '') => ({ type: 'string', ...(description ? { description } : {}) });
const array = (items, required = []) => ({ type: 'array', items, ...(required.length ? { required } : {}) });
const object = (properties, required = []) => ({ type: 'object', properties, required });

const conceptFields = {
  requestId: string(), runId: string(), runContract: string(), promptVersion: string(),
  appName: string(), premise: string(), playerAction: string(), apiIds: array(string()),
  causalChain: array(object({ order: { type: 'integer' }, apiId: string(), action: string() }, ['order', 'apiId', 'action'])),
  apiRoles: array(object({ apiId: string(), essentialRole: string(), operations: array(string()) }, ['apiId', 'essentialRole', 'operations'])),
  dependency: object({ fromApiId: string(), to: string(), toApiId: string(), explanation: string() }, ['fromApiId', 'to', 'explanation']),
  interaction: object({ controls: array(string()), outcome: string() }, ['controls', 'outcome']),
  visualDirection: object({ style: string(), palette: string(), typography: string(), motion: string() }, ['style', 'palette', 'typography', 'motion']),
  bannedShapeAssessment: object({ plainDashboard: { type: 'boolean' }, plainSearch: { type: 'boolean' }, plainQuiz: { type: 'boolean' }, randomFactDisplay: { type: 'boolean' }, thinClone: { type: 'boolean' }, plausibleStartupPitch: { type: 'boolean' }, explanation: string() }, ['plainDashboard', 'plainSearch', 'plainQuiz', 'randomFactDisplay', 'thinClone', 'plausibleStartupPitch', 'explanation']),
  noveltyDelta: string()
};

const artifactFields = {
  requestId: string(), runId: string(), runContract: string(), conceptId: string(), promptVersion: string(), html: string(),
  declaredApiUses: array(object({ apiId: string(), operations: array(string()) }, ['apiId', 'operations']))
};

const toolSchemas = Object.freeze({
  open_randomware: object({}, []),
  spin_apis: object({ seed: string(), requestId: string() }, ['requestId']),
  submit_concept: object(conceptFields, Object.keys(conceptFields)),
  submit_artifact: object(artifactFields, Object.keys(artifactFields)),
  submit_repair: object({ ...artifactFields, failedRevisionId: string(), diagnosticCodes: array(string()) }, [...Object.keys(artifactFields), 'failedRevisionId', 'diagnosticCodes']),
  get_run: object({ runId: string() }, ['runId']),
  mutate_creation: object({ creationId: string(), requestId: string(), premise: string() }, ['creationId', 'requestId', 'premise']),
  record_choreography_failure: object({ runId: string(), requestId: string(), phase: string(), code: string() }, ['runId', 'requestId', 'phase', 'code'])
});

function pathName(path) {
  return path.replace(/\[(\d+)\]/g, '_$1').replace(/\./g, '_');
}

function issue(path, kind) { return `${pathName(path)}_${kind}`; }

function validateNode(value, schema, path, errors) {
  if (value === undefined || value === null) { errors.push(issue(path, 'missing')); return; }
  if (schema.type === 'string') { if (typeof value !== 'string') errors.push(issue(path, 'type')); return; }
  if (schema.type === 'boolean') { if (typeof value !== 'boolean') errors.push(issue(path, 'type')); return; }
  if (schema.type === 'integer') { if (!Number.isInteger(value)) errors.push(issue(path, 'type')); return; }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) { errors.push(issue(path, 'type')); return; }
    value.forEach((item, index) => validateNode(item, schema.items, `${path}[${index}]`, errors));
    return;
  }
  if (schema.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) { errors.push(issue(path, 'type')); return; }
    for (const key of schema.required || []) validateNode(value[key], schema.properties[key], `${path}.${key}`.replace(/^\./, ''), errors);
    return;
  }
  errors.push(issue(path, 'unsupported_type'));
}

function validateToolArguments(name, args) {
  try {
    const schema = toolSchemas[name];
    if (!schema) return { ok: false, code: `tool_name_invalid:${name}`, diagnostics: [`tool_name_invalid:${name}`] };
    const errors = [];
    validateNode(args, schema, 'arguments', errors);
    if (!errors.length) return { ok: true, code: null, diagnostics: [] };
    let code = errors[0];
    const roleOperations = code.match(/^arguments_apiRoles_(\d+)_operations_(missing|type)$/);
    if (name === 'submit_concept' && roleOperations) {
      const roleId = args?.apiRoles?.[Number(roleOperations[1])]?.apiId || roleOperations[1];
      code = `api_role_operations_${roleOperations[2]}:${roleId}`;
    }
    return { ok: false, code, diagnostics: errors };
  } catch (error) {
    console.error('[randomware] tool argument validation failed', error);
    return { ok: false, code: 'internal_validation_error', diagnostics: ['internal_validation_error'] };
  }
}

module.exports = { toolSchemas, validateToolArguments };
