const state = { run: null, history: [], rerolls: 0 };
const $ = (selector) => document.querySelector(selector);
const show = (selector) => { $(selector).hidden = false; };
const eventNames = ['spin_received', 'concept_accepted', 'artifact_received', 'deployed'];

function renderEvents(done = []) {
  $('#events').innerHTML = eventNames.map((name) => `<li class="${done.includes(name) ? 'done' : ''}">${name.replaceAll('_', ' ')}</li>`).join('');
}

async function post(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const value = await response.json(); if (!response.ok) throw new Error(value.code || 'request_failed'); return value;
}

function revealApis(run) {
  $('#apis').replaceChildren(); $('#build').hidden = true; $('#reroll').hidden = true;
  run.selectedApis.forEach((api, index) => setTimeout(() => {
    const chip = document.createElement('li'); chip.textContent = `${api.name} · ${api.category} · ${api.capability}`; $('#apis').append(chip);
    if (index === run.selectedApis.length - 1) { $('#build').hidden = false; $('#reroll').hidden = false; }
  }, index * 420));
}

async function loadRecent() {
  try {
    const recent = await fetch('/api/creations/recent').then((response) => response.json()); const list = $('#recent'); list.replaceChildren();
    if (!recent.length) { const item = document.createElement('li'); item.textContent = 'No specimens yet. The first corpse is always free.'; list.append(item); return; }
    recent.slice(0, 6).forEach((creation) => { const item = document.createElement('li'); const link = document.createElement('a'); link.href = `/c/${creation.creationId}`; link.textContent = creation.appName || 'Untitled collision'; link.style.color = 'var(--mint)'; item.append(link, document.createTextNode(` — ${(creation.selectedApis || []).join(' + ')}`)); list.append(item); });
  } catch { /* owner UI remains usable if the index is unavailable */ }
}

function spin(seed = crypto.randomUUID()) {
  $('#spin').disabled = true; show('#progress'); renderEvents(['spin_received']);
  return post('/api/spin', { requestId: crypto.randomUUID(), seed, history: state.history }).then((run) => {
    state.run = run; state.history.push(run.selectedApis.map((api) => api.id)); state.history = state.history.slice(-3); renderEvents(['spin_received']); show('#concept'); $('#concept-name').textContent = 'A collision is forming…'; $('#concept-premise').textContent = `Selected ${run.selectedApis.map((api) => api.name).join(' + ')}. The model would now invent the causal chain.`; revealApis(run); return run;
  }).finally(() => { $('#spin').disabled = false; });
}

$('#spin').addEventListener('click', async () => {
  try { await spin(); } catch (error) { $('#concept-premise').textContent = `The slot failed honestly: ${error.message}`; show('#concept'); }
});

$('#reroll').addEventListener('click', async () => {
  if (!state.run) return; $('#reroll').disabled = true;
  try { state.rerolls += 1; await post(`/api/runs/${state.run.runId}/reroll`, { requestId: crypto.randomUUID(), appName: $('#concept-name').textContent, premise: $('#concept-premise').textContent }); $('#concept-name').textContent = `Collision variation ${state.rerolls + 1}`; $('#concept-premise').textContent = 'The same APIs are waiting for a stranger concept. Build only when the premise earns it.'; } catch (error) { $('#concept-premise').textContent = `The reroll failed honestly: ${error.message}`; } finally { $('#reroll').disabled = false; }
});

$('#build').addEventListener('click', async () => {
  if (!state.run) return; $('#build').disabled = true;
  try {
    const apiIds = state.run.selectedApis.map((api) => api.id);
    const apiRoles = state.run.selectedApis.map((api) => ({ apiId: api.id, essentialRole: `${api.name} supplies the ${api.capability} that the ritual cannot fake.`, operations: api.operations.map((operation) => operation.id) }));
    const concept = await post(`/api/runs/${state.run.runId}/concept`, {
      requestId: crypto.randomUUID(), appName: 'Collision Clerk', premise: `A clerk files ${apiIds.join(' and ')} into one unnecessary ritual that changes its rules every time.`, playerAction: 'Press the clerk button to perform one absurd, observable filing ritual.', noveltyDelta: 'The APIs become causes in a theatrical chain rather than a dashboard.', apiIds,
      apiRoles, causalChain: state.run.selectedApis.map((api, index) => ({ order: index + 1, apiId: api.id, action: `turn ${api.name} into the next filing instruction` })), dependency: { fromApiId: state.run.selectedApis[0].id, to: 'rules', toApiId: state.run.selectedApis[1].id, explanation: 'The first result changes the rules applied to the next source.' }, interaction: { controls: ['perform filing'], outcome: 'The clerk returns a visibly changing specimen.' }, visualDirection: { style: 'maximalist bureaucratic theatre', palette: 'ink black, saffron, and electric cyan', typography: 'oversized editorial serif', motion: 'stamps cascade across the page' }, bannedShapeAssessment: { plainDashboard: false, plainSearch: false, plainQuiz: false, randomFactDisplay: false, thinClone: false, plausibleStartupPitch: false, explanation: 'It is a deliberately theatrical collision, not a sincere startup.' }
    });
    $('#concept-name').textContent = concept.concept.appName; $('#concept-premise').textContent = concept.concept.premise; renderEvents(['spin_received', 'concept_accepted']);
    const selected = state.run.selectedApis.flatMap((api) => api.operations.map((operation) => ({ apiId: api.id, operationId: operation.id })));
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#201338;color:#ffe7c7;font:18px Georgia;padding:30px}button{padding:12px}pre{white-space:pre-wrap}</style></head><body><section data-randomware="loading">Loading</section><section data-randomware="error">Error</section><main data-randomware="interactive"><h1>Collision Clerk</h1><button id="run">Consult the clerk</button><pre id="out"></pre></main><footer data-randomware="attribution">AI-generated experimental app · ${apiIds.join(', ')}</footer><script>document.querySelector('#run').onclick=async()=>{const values=await Promise.all([${selected.map(({apiId,operationId}) => `window.randomware.call('${apiId}','${operationId}',{})`).join(',')}]);document.querySelector('#out').textContent=values.map(v=>JSON.stringify(v.data||v)).join('\\n')};window.randomware.ready();</script>${'padding '.repeat(1800)}</body></html>`;
    const artifact = await post(`/api/runs/${state.run.runId}/artifact`, { requestId: crypto.randomUUID(), html });
    renderEvents(['spin_received', 'concept_accepted', 'artifact_received', 'deployed']); show('#result'); $('#result-copy').textContent = 'The specimen is stored, sandboxed, and inspectable.'; $('#open-creation').href = `/c/${artifact.creationId}`; loadRecent();
  } catch (error) { $('#concept-premise').textContent = `The build failed honestly: ${error.message}`; } finally { $('#build').disabled = false; }
});

$('#spin-again').addEventListener('click', async () => { $('#result').hidden = true; $('#concept').hidden = true; try { await spin(); } catch (error) { $('#concept-premise').textContent = `The slot failed honestly: ${error.message}`; show('#concept'); } });

loadRecent();
