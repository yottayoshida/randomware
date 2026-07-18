const { TOOL_SCHEMAS } = require('./artifact-contract');

const toolSchemas = TOOL_SCHEMAS;

function pathName(path) {
  return path.replace(/\[(\d+)\]/g, '_$1').replace(/\./g, '_');
}

function issue(path, kind) { return `${pathName(path)}_${kind}`; }

function validateNode(value, schema, path, errors) {
  if (value === undefined || value === null) { errors.push(issue(path, 'missing')); return; }
  if (schema.type === 'string') {
    if (typeof value !== 'string') { errors.push(issue(path, 'type')); return; }
    const length = value.trim().length;
    if ((schema.minLength !== undefined && length < schema.minLength) || (schema.maxLength !== undefined && length > schema.maxLength)) errors.push(issue(path, 'length'));
    if (schema.enum && !schema.enum.includes(value)) errors.push(issue(path, 'enum'));
    if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) errors.push(issue(path, 'const'));
    return;
  }
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') { errors.push(issue(path, 'type')); return; }
    if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) errors.push(issue(path, 'const'));
    return;
  }
  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) { errors.push(issue(path, 'type')); return; }
    if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) errors.push(issue(path, 'range'));
    if (schema.enum && !schema.enum.includes(value)) errors.push(issue(path, 'enum'));
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) { errors.push(issue(path, 'type')); return; }
    if ((schema.minItems !== undefined && value.length < schema.minItems) || (schema.maxItems !== undefined && value.length > schema.maxItems)) errors.push(issue(path, 'length'));
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(issue(path, 'unique'));
    value.forEach((item, index) => validateNode(item, schema.items, `${path}[${index}]`, errors));
    return;
  }
  if (schema.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) { errors.push(issue(path, 'type')); return; }
    for (const key of schema.required || []) validateNode(value[key], schema.properties[key], `${path}.${key}`.replace(/^\./, ''), errors);
    for (const [key, child] of Object.entries(schema.properties || {})) if (!(schema.required || []).includes(key) && value[key] !== undefined) validateNode(value[key], child, `${path}.${key}`.replace(/^\./, ''), errors);
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
    const roleOperationError = errors.find((candidate) => /^arguments_apiRoles_\d+_operations_(missing|type)$/.test(candidate));
    const roleOperations = roleOperationError?.match(/^arguments_apiRoles_(\d+)_operations_(missing|type)$/);
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

module.exports = { toolSchemas, validateToolArguments, validateNode };
