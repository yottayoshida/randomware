const ARTIFACT_CONTRACT = Object.freeze({
  markers: Object.freeze([
    'data-randomware="loading"',
    'data-randomware="error"',
    'data-randomware="interactive"',
    'data-randomware="attribution"'
  ]),
  ready: 'window.randomware.ready()',
  call: 'window.randomware.call("API_ID","OPERATION_ID",{...})',
  bytes: '10,000–40,000 UTF-8 bytes',
  viewport: '<meta name="viewport"'
});

const ARTIFACT_CONTRACT_LITERALS = Object.freeze([
  ...ARTIFACT_CONTRACT.markers,
  ARTIFACT_CONTRACT.ready,
  ARTIFACT_CONTRACT.call,
  ARTIFACT_CONTRACT.bytes,
  ARTIFACT_CONTRACT.viewport
]);

function artifactContractPrompt() {
  return [
    'Artifact contract — copy these literals exactly:',
    ARTIFACT_CONTRACT.markers.join(', '),
    `${ARTIFACT_CONTRACT.ready};`,
    `one literal ${ARTIFACT_CONTRACT.call} per selected operation`,
    `${ARTIFACT_CONTRACT.bytes};`,
    `include a viewport tag beginning ${ARTIFACT_CONTRACT.viewport}`
  ].join(' ');
}

function promptSurface(instruction, extra = '') {
  return `${instruction}\n\n${artifactContractPrompt()}${extra ? `\n\n${extra}` : ''}`;
}

function conceptAcceptedPrompt(runId) {
  return promptSurface(`Concept accepted for ${runId}. Next, submit the complete artifact via submit_artifact.`);
}

function artifactRepairPrompt({ runId = 'unknown', diagnostics = [] } = {}) {
  const exactDiagnostics = Array.isArray(diagnostics) && diagnostics.length ? diagnostics : ['the validator supplied no diagnostic detail'];
  return promptSurface(`Artifact rejected for Randomware run ${runId}. Use submit_repair once with a complete replacement artifact. Exact rejection diagnostics: ${exactDiagnostics.map((diagnostic) => String(diagnostic)).join('; ')}`);
}

module.exports = {
  ARTIFACT_CONTRACT,
  ARTIFACT_CONTRACT_LITERALS,
  artifactContractPrompt,
  promptSurface,
  conceptAcceptedPrompt,
  artifactRepairPrompt
};
