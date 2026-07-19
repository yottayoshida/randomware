const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConcept } = require('../../src/core/concept');

const selectedApis = [{ apiId: 'art', operationIds: ['artwork'] }, { apiId: 'weather', operationIds: ['forecast'] }];
const valid = {
  requestId: 'concept-1', runId: 'run-concept-1', runContract: 'run:run-concept-1', promptVersion: 'concept-v1', styleId: 'paper-certificate', appName: 'Weather Canvas', premise: 'A painted forecast where a museum object changes the mood of tomorrow.', playerAction: 'Press the brush button to let weather recolor the selected artwork.', noveltyDelta: 'Make the weather a material, not a report.', apiIds: ['art', 'weather'],
  apiRoles: [{ apiId: 'art', essentialRole: 'Supplies the visual object that receives the weather mood.', operations: ['artwork'] }, { apiId: 'weather', essentialRole: 'Supplies current conditions that choose the object palette.', operations: ['forecast'] }],
  causalChain: [{ order: 1, apiId: 'art', action: 'choose the visual object' }, { order: 2, apiId: 'weather', action: 'turn conditions into pigment' }],
  dependency: { fromApiId: 'weather', to: 'api_input', explanation: 'The forecast determines the artwork palette.' },
  interaction: { controls: ['paint'], outcome: 'The button produces one changing canvas.' },
  visualDirection: { style: 'maximalist gallery storm', palette: 'electric blue and saffron', typography: 'oversized serif', motion: 'weather fronts sweep across the page' },
  bannedShapeAssessment: { plainDashboard: false, plainSearch: false, plainQuiz: false, randomFactDisplay: false, thinClone: false, plausibleStartupPitch: false, explanation: 'This is an intentionally theatrical collision.' }
};

test('concept validator accepts complete collision contract', () => assert.equal(validateConcept(valid, { selectedApis, styleId: 'paper-certificate' }).ok, true));
test('concept validator requires the exact drawn style', () => {
  assert.equal(validateConcept({ ...valid, styleId: 'teletext' }, { selectedApis, styleId: 'paper-certificate' }).code, 'style_id_must_match_selection');
  assert.equal(validateConcept({ ...valid, styleId: 'not-a-style' }, { selectedApis, styleId: 'paper-certificate' }).code, 'style_id_invalid');
});
test('concept validator rejects missing API roles and banned shapes', () => {
  const result = validateConcept({ ...valid, premise: 'A plain dashboard for weather', apiRoles: valid.apiRoles.slice(0, 1) }, { selectedApis });
  assert.equal(result.code, 'api_roles_must_cover_selection');
  assert.ok(result.diagnostics.some((item) => item.includes('api_roles')));
  assert.ok(result.diagnostics.some((item) => item.includes('banned_shape')));
});

test('concept validator returns field-named diagnostics instead of leaking TypeError', () => {
  const malformed = structuredClone(valid);
  delete malformed.apiRoles[0].operations;
  const missing = validateConcept(malformed, { selectedApis });
  assert.equal(missing.code, 'api_role_operations_missing:art');
  assert.doesNotMatch(JSON.stringify(missing), /TypeError/);

  const mistyped = structuredClone(valid);
  mistyped.apiRoles[0].operations = { artwork: true };
  const typed = validateConcept(mistyped, { selectedApis });
  assert.equal(typed.code, 'api_role_operations_type:art');
  assert.doesNotMatch(JSON.stringify(typed), /TypeError/);
});
