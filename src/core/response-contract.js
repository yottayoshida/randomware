function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'number' ? 'number' : typeof value;
}

function mergeSchemas(schemas) {
  const usable = schemas.filter(Boolean);
  if (!usable.length) return {};
  const types = [...new Set(usable.flatMap((schema) => Array.isArray(schema.type) ? schema.type : [schema.type]))];
  if (types.length !== 1) return { type: types.sort() };
  if (types[0] !== 'object') return usable[0];
  const keys = [...new Set(usable.flatMap((schema) => Object.keys(schema.properties || {})))].sort();
  const properties = Object.fromEntries(keys.map((key) => [key, mergeSchemas(usable.map((schema) => schema.properties?.[key]).filter(Boolean))]));
  const required = keys.filter((key) => usable.every((schema) => schema.required?.includes(key)));
  return { type: 'object', properties, required, additionalProperties: false };
}

function schemaFromExample(value, depth = 0) {
  if (depth > 8) return {};
  const type = valueType(value);
  if (type === 'object') {
    const keys = Object.keys(value).sort();
    return { type: 'object', properties: Object.fromEntries(keys.map((key) => [key, schemaFromExample(value[key], depth + 1)])), required: keys, additionalProperties: false };
  }
  if (type === 'array') return { type: 'array', items: mergeSchemas(value.slice(0, 3).map((item) => schemaFromExample(item, depth + 1))), maxItems: 20 };
  if (type === 'string') return { type: 'string', maxLength: 4000 };
  if (type === 'number' || type === 'boolean' || type === 'null') return { type };
  return {};
}

function boundedResponseExample(value, depth = 0) {
  if (depth > 5) return '[truncated]';
  if (typeof value === 'string') return value.slice(0, 160);
  if (Array.isArray(value)) return value.slice(0, 1).map((item) => boundedResponseExample(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 24).map(([key, item]) => [key, boundedResponseExample(item, depth + 1)]));
  return value;
}

function shapeSignature(value, path = '$', output = {}) {
  const type = valueType(value);
  output[path] = type === 'object' || type === 'array' ? type : 'scalar';
  if (type === 'object') for (const key of Object.keys(value).sort()) shapeSignature(value[key], `${path}.${key}`, output);
  if (type === 'array' && value.length) shapeSignature(value[0], `${path}[]`, output);
  return output;
}

function collectScalarPaths(value, path = '', output = []) {
  const type = valueType(value);
  if (['string', 'number', 'boolean'].includes(type) && value !== '' && value !== null) output.push(path);
  else if (type === 'object') for (const key of Object.keys(value)) collectScalarPaths(value[key], path ? `${path}.${key}` : key, output);
  else if (type === 'array' && value.length) collectScalarPaths(value[0], `${path}[0]`, output);
  return output;
}

function semanticFieldPaths(value) {
  const candidates = collectScalarPaths(value).filter((path) => !/(?:^|\.)(?:status|id|uuid|url|sourceUrl|cached|bytes|generationtime_ms|interval|time|date)$/i.test(path) && !/(?:^|\.)current_units(?:\.|$)/.test(path));
  const priorities = [/\.?(?:rate|temperature_2m|mag|name|title|product_name|strMeal|word|text|value|country|place|codec)$/i, /(?:message|image|mediaUrl)$/i];
  const ordered = [...priorities.flatMap((pattern) => candidates.filter((path) => pattern.test(path))), ...candidates];
  return [...new Set(ordered)].slice(0, 3);
}

function responseContract(data) {
  return {
    outputSchema: schemaFromExample(data),
    responseExample: boundedResponseExample(data),
    semanticFieldPaths: semanticFieldPaths(data),
    shapeSignature: shapeSignature(data)
  };
}

function compareShape(actual, expectedSignature) {
  const actualSignature = shapeSignature(actual);
  const actualKeys = Object.keys(actualSignature).sort();
  const expectedKeys = Object.keys(expectedSignature || {}).sort();
  const missing = expectedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(actualSignature, key));
  const extra = actualKeys.filter((key) => !Object.prototype.hasOwnProperty.call(expectedSignature || {}, key));
  const changed = expectedKeys.filter((key) => Object.prototype.hasOwnProperty.call(actualSignature, key) && actualSignature[key] !== expectedSignature[key]).map((key) => ({ path: key, expected: expectedSignature[key], actual: actualSignature[key] }));
  return { ok: missing.length === 0 && extra.length === 0 && changed.length === 0, missing, extra, changed };
}

module.exports = { boundedResponseExample, compareShape, responseContract, schemaFromExample, semanticFieldPaths, shapeSignature, valueType };
