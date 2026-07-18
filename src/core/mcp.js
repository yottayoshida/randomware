const MCP_PROTOCOL_VERSION = '2025-06-18';
const { CHOREOGRAPHY_DEADLINES } = require('./choreography');
const { ARTIFACT_CONTRACT_LITERALS, TOOL_INSTRUCTIONS, artifactContractPrompt, contractPrompt, promptSurface, conceptAcceptedPrompt, artifactRepairPrompt } = require('./artifact-contract');
const { companionOrigin } = require('./urls');
const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(['2025-06-18', '2025-03-26', '2024-11-05']);
const MCP_RESOURCE_URI = 'ui://widget/randomware.html';
const MCP_RESOURCE_MIME = 'text/html;profile=mcp-app';

function widgetToolResult(value) {
  let envelope = value;
  for (let depth = 0; depth < 3 && envelope && typeof envelope === 'object' && envelope.result && !envelope.structuredContent; depth += 1) envelope = envelope.result;
  const output = envelope?.structuredContent || envelope;
  if (!output || typeof output !== 'object') return null;
  const hasRunState = ['runId', 'phase', 'creationId', 'selectedApis', 'failure', 'revisions', 'nextTool'].some((key) => Object.prototype.hasOwnProperty.call(output, key));
  if (!hasRunState && envelope?.isError !== true) return null;
  return { output, isError: envelope?.isError === true };
}

function widgetBuildPrompt(run) {
  const runId = String(run?.runId || 'unknown');
  return promptSurface(`Use Randomware run ${runId}: call get_run, then submit_concept, then submit the complete artifact via submit_artifact.`);
}

function widgetRepairPrompt(run, diagnostics) {
  const input = run && typeof run === 'object' && Array.isArray(run.diagnostics) ? run : { runId: run?.runId, diagnostics };
  return artifactRepairPrompt({ runId: String(input?.runId || 'unknown'), diagnostics: input?.diagnostics });
}

function toolDescription(name) {
  return promptSurface(TOOL_INSTRUCTIONS[name] || `Use the ${name} tool.`);
}

const WIDGET_CONTRACT_PROMPT = contractPrompt();
const WIDGET_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Randomware</title><style>
:root{color-scheme:dark;font-family:Georgia,serif}body{margin:0;background:linear-gradient(135deg,#120b32,#081a24);color:#ffe7c7;padding:18px}main{border:2px solid #ffe7c7;padding:20px;box-shadow:8px 8px 0 #e8614f}h1{font-size:clamp(2rem,8vw,4rem);line-height:.9;margin:0 0 12px;text-transform:uppercase}p{line-height:1.45}button,.rw-link{background:#ffe7c7;color:#120b32;border:0;padding:11px 16px;font:700 1rem Georgia;cursor:pointer;margin:4px 4px 4px 0;text-decoration:none;display:inline-block}button:focus-visible,.rw-link:focus-visible{outline:3px solid #55e6c1}button[disabled]{opacity:.55;cursor:wait}ul{padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px;min-height:34px}li{border:1px solid #55e6c1;padding:6px 9px}#status{color:#55e6c1;min-height:1.4em}#fallback{margin-top:18px;border:1px solid #e8614f;padding:12px}#fallback textarea{box-sizing:border-box;width:100%;min-height:110px;background:#080a14;color:#ffe7c7;border:1px solid #55e6c1;padding:10px;font:14px ui-monospace,monospace}#creation{margin-top:18px;border-top:1px solid #55e6c1;padding-top:14px}#creation-frame{display:block;width:100%;height:min(78vh,720px);min-height:390px;border:2px solid #ffe7c7;background:#080a14;margin-top:10px}small{display:block;margin-top:16px;opacity:.8}</style></head><body><main><p>AI-generated experimental app</p><h1>Randomware</h1><p id="status">Choose nothing. Make something.</p><p>Sequential reveal, bounded APIs, honest failure.</p><ul id="apis" aria-live="polite"></ul><button id="spin" type="button">Spin the slot</button><button id="build" type="button" hidden>Ask the model to build</button><section id="fallback" hidden><p id="fallback-status">The model follow-up could not be posted. Copy this prompt into the conversation.</p><textarea id="build-prompt" readonly aria-label="Build prompt"></textarea><button id="copy-prompt" type="button">Copy build prompt</button><button id="resume-timer" type="button">Resume concept timer</button></section><section id="creation" hidden><p id="creation-status">The creation is ready.</p><iframe id="creation-frame" title="Randomware creation" hidden></iframe><a id="creation-link" class="rw-link" href="#" target="_blank" rel="noopener noreferrer">Download or open the creation</a></section><small>Real APIs go in. Random apps come out. Embedded execution is primary; link-out remains available.</small></main><script>
(()=>{const status=document.querySelector('#status');const list=document.querySelector('#apis');const spin=document.querySelector('#spin');const build=document.querySelector('#build');const fallback=document.querySelector('#fallback');const fallbackStatus=document.querySelector('#fallback-status');const buildPrompt=document.querySelector('#build-prompt');const copyPrompt=document.querySelector('#copy-prompt');const resumeTimerButton=document.querySelector('#resume-timer');const creation=document.querySelector('#creation');const creationStatus=document.querySelector('#creation-status');const creationFrame=document.querySelector('#creation-frame');const creationLink=document.querySelector('#creation-link');const artifactContractPrompt=${JSON.stringify(WIDGET_CONTRACT_PROMPT)};const companionOrigin='__RANDOMWARE_COMPANION_ORIGIN__';let run=null;let timer=null;let timerState=null;let pollTimer=null;let pollFailures=0;let activeWidgetRunId=null;let revealToken=0;const bridge=()=>window.openai||{};const text=(value)=>String(value??'');function save(){try{bridge().setWidgetState?.({runId:run?.runId||null,creationId:run?.creationId||null,creationUrl:run?.creationUrl||null,selectedApis:run?.selectedApis||[],phase:run?.phase||null,statusUrl:run?.statusUrl||null,choreography:run?.choreography||null,deadlineAt:timerState?.finalAt||null,reSteered:Boolean(timerState?.reSteered),paused:Boolean(timerState?.paused)})}catch{}}
function stopStatusPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=null}
function ensureStatusPolling(){if(pollTimer||!run?.runId)return;pollTimer=setInterval(async()=>{try{const href=run.statusUrl||new URL('/api/runs/'+encodeURIComponent(run.runId),companionOrigin).href;const response=await fetch(href);if(!response.ok)throw new Error('status_http_'+response.status);const next=await response.json();pollFailures=0;showRun(next,'status')}catch(error){pollFailures+=1;console.warn('[Randomware] status polling failed',pollFailures,text(error?.message||error));if(pollFailures>=3)status.textContent='status polling unavailable'}},3000)}
function clearTimer(){if(timer)clearTimeout(timer);timer=null;timerState=null;save()}
function pauseTimer(){if(timer)clearTimeout(timer);timer=null;if(timerState)timerState.paused=true;save()}
function scheduleTimer(){if(!timerState||timerState.paused)return;const phase=timerState.phase;const target=Math.min(timerState.reSteered?timerState.finalAt:timerState.firstAt,timerState.absoluteAt||Infinity);timer=setTimeout(()=>{timer=null;if(!timerState||timerState.paused)return;if(!timerState.reSteered&&Date.now()<(timerState.absoluteAt||Infinity)){timerState.reSteered=true;timerState.finalAt=Math.min(timerState.absoluteAt||Infinity,Date.now()+(${JSON.stringify(CHOREOGRAPHY_DEADLINES)}[phase]?.finalMs||0));status.textContent='Still waiting for the '+phase+'…';save();void sendFollowUp(phase).catch((error)=>showFollowUpFallback(phase,error)).finally(()=>scheduleTimer())}else void recordTimeout()},Math.max(0,target-Date.now()))}
function resumeTimer(){if(!timerState)return;timerState.paused=false;status.textContent='The model follow-up is pending…';scheduleTimer();save()}
function followUpPrompt(phase){const runId=run?.runId||'unknown';if(phase==='concept')return ['Use Randomware run '+runId+': call get_run, then submit_concept, then submit the complete artifact via submit_artifact.',artifactContractPrompt].join(String.fromCharCode(10,10));const diagnostics=Array.isArray(run?.failure?.diagnostics)&&run.failure.diagnostics.length?run.failure.diagnostics:[run?.failure?.code||'the validator supplied no diagnostic detail'];return ['Artifact rejected for Randomware run '+runId+'. Use submit_repair once with a complete replacement artifact. Exact rejection diagnostics: '+diagnostics.map(text).join('; '),artifactContractPrompt].join(String.fromCharCode(10,10))}
function logFollowUpApi(context){const api=bridge();const detail={context,sendFollowUpMessage:typeof api.sendFollowUpMessage,parentPostMessage:typeof window.parent?.postMessage,keys:Object.keys(api)};console.info('[Randomware] follow-up API',detail);return detail}
async function sendFollowUp(phase){const prompt=followUpPrompt(phase);const api=bridge();const detail=logFollowUpApi(phase);if(detail.sendFollowUpMessage!=='function')throw new Error('sendFollowUpMessage unavailable');const result=await api.sendFollowUpMessage({prompt});if(result&&((result.ok===false)||(result.success===false)||result.error))throw new Error(text(result.error||'sendFollowUpMessage returned an unsuccessful result'));status.textContent=phase==='concept'?'Waiting for the model to build the specimen…':'Still waiting for the '+phase+'…';return result}
function showFollowUpFallback(phase,error){const prompt=followUpPrompt(phase);fallback.hidden=false;fallbackStatus.textContent='Follow-up unavailable: '+text(error?.message||error)+'. Copy this prompt into the conversation, then resume the timer when you have pasted it.';buildPrompt.value=prompt;pauseTimer();status.textContent='The model follow-up could not be posted. Manual paste is ready.';save()}
async function recordTimeout(){const phase=timerState?.phase;clearTimer();stopStatusPolling();status.textContent='The '+phase+' phase ended honestly: choreography timeout.';try{if(typeof bridge().callTool==='function'&&run?.runId)await bridge().callTool('record_choreography_failure',{runId:run.runId,requestId:crypto.randomUUID(),phase,code:'choreography_timeout'})}catch{}}
function startTimer(phase){const limits=${JSON.stringify(CHOREOGRAPHY_DEADLINES)}[phase];if(!limits||!run?.runId)return;clearTimer();const now=Date.now();timerState={phase,firstAt:now+limits.firstMs,finalAt:now+limits.finalMs,absoluteAt:now+limits.absoluteMs,lastActivityAt:now,reSteered:false,paused:false};scheduleTimer();save()}
function updateTimerForRun(){if(run?.choreography){syncTimerFromServer();return}if(run?.phase==='concept_accepted')startTimer('artifact');else if(run?.phase==='repair_requested')startTimer('repair');else if(run?.phase==='completed'||run?.phase==='failed')clearTimer()}
function syncTimerFromServer(){const choreography=run?.choreography;const limits=choreography&&${JSON.stringify(CHOREOGRAPHY_DEADLINES)}[choreography.phase];if(!choreography||!limits)return;if(run.phase==='completed'||run.phase==='failed'){clearTimer();return}const activity=Number(choreography.lastActivityAt)||0;const changed=!timerState||timerState.phase!==choreography.phase||activity>(timerState.lastActivityAt||0);if(changed){if(timer)clearTimeout(timer);timer=null;timerState={phase:choreography.phase,firstAt:Number(choreography.idleDeadlineAt)||Date.now()+limits.firstMs,finalAt:Math.min(Number(choreography.absoluteDeadlineAt)||Infinity,(Number(choreography.idleDeadlineAt)||Date.now()+limits.firstMs)+limits.finalMs),absoluteAt:Number(choreography.absoluteDeadlineAt)||Date.now()+limits.absoluteMs,lastActivityAt:activity,reSteered:Boolean(choreography.reSteered),paused:Boolean(timerState?.paused)};if(!timerState.paused)scheduleTimer();save()}else{timerState.absoluteAt=Number(choreography.absoluteDeadlineAt)||timerState.absoluteAt;save()}}
function creationHref(value){if(value?.creationUrl)return value.creationUrl;return new URL('/c/'+encodeURIComponent(value?.creationId||''),companionOrigin).href}
function showCreation(value){const creationId=value?.creationId;if(!creationId||value?.phase!=='completed')return;run={...(run||{}),...value,creationId};const href=creationHref(run);creation.hidden=false;creationFrame.hidden=false;creationFrame.src=href;creationStatus.textContent='Creation is live in the widget. Use link-out if the embedded frame is unavailable.';creationLink.href=href;creationLink.onclick=(event)=>{if(typeof bridge().openExternal==='function'){event.preventDefault();bridge().openExternal({href,redirectUrl:false})}};status.textContent='Creation accepted and routable.';save()}
function toolResult(value){let envelope=value;for(let depth=0;depth<3&&envelope&&typeof envelope==='object'&&envelope.result&&!envelope.structuredContent;depth++)envelope=envelope.result;const output=envelope?.structuredContent||envelope;if(!output||typeof output!=='object')return null;const hasRunState=['runId','phase','creationId','selectedApis','failure','revisions','nextTool'].some((key)=>Object.prototype.hasOwnProperty.call(output,key));if(!hasRunState&&envelope?.isError!==true)return null;return {output,isError:envelope?.isError===true}}
function renderReels(reveal){const token=++revealToken;list.replaceChildren();const selected=run?.selectedApis||[];const append=(api)=>{if(token!==revealToken)return;const chip=document.createElement('li');chip.textContent=text(api.name||api.id);list.append(chip)};if(!selected.length)return;if(!reveal){selected.forEach(append);return}status.textContent='The reels are revealing…';selected.forEach((api,index)=>setTimeout(()=>{append(api);if(token===revealToken&&index===selected.length-1){status.textContent='Collision selected. The model can now invent the causal chain.';build.hidden=false;save()}},index*420))}
function showRun(value,source='global'){const result=toolResult(value);if(!result)return;const incoming=result.output;if(source==='widget'&&incoming.runId){activeWidgetRunId=incoming.runId;pollFailures=0}if(source!=='widget'&&(!activeWidgetRunId||(incoming.runId&&incoming.runId!==activeWidgetRunId)))return;if(result.isError){if(incoming.nextTool==='submit_repair')run={...(run||{}),phase:'repair_requested',choreography:null,failure:incoming};status.textContent='The build needs one bounded repair: '+text(incoming.code||'tool error')+'.';build.hidden=true;updateTimerForRun();save();return}const previous=run;run={...(run||{}),...incoming};if(!incoming.selectedApis&&previous?.selectedApis)run.selectedApis=previous.selectedApis;ensureStatusPolling();fallback.hidden=true;list.replaceChildren();build.hidden=true;updateTimerForRun();if(run.phase==='completed'){stopStatusPolling();showCreation(run);return}if(run.phase==='failed'){stopStatusPolling();status.textContent='The build ended honestly: '+text(run.failure?.code||'choreography timeout')+'.';return}if(run.phase==='concept_accepted'){renderReels(false);status.textContent='Concept accepted. The model is composing the artifact…';return}if(run.phase==='repair_requested'){renderReels(false);status.textContent='The first artifact needs one bounded repair.';return}if(run.phase==='spinned'){renderReels(source==='widget'&&(!previous||previous.runId!==run.runId||!list.children.length));build.hidden=false;return}if(!run?.selectedApis?.length&& !previous)status.textContent='The slot is ready.'}
async function spinNow(){spin.disabled=true;status.textContent='Calling the bounded selector…';try{if(typeof bridge().callTool!=='function')throw new Error('ChatGPT widget bridge unavailable');showRun(await bridge().callTool('spin_apis',{seed:crypto.randomUUID(),requestId:crypto.randomUUID()}),'widget')}catch(error){status.textContent='The slot failed honestly: '+text(error.message)}finally{spin.disabled=false}}
spin.addEventListener('click',spinNow);build.addEventListener('click',()=>{startTimer('concept');fallback.hidden=true;status.textContent='Asking the model to build the specimen…';void sendFollowUp('concept').catch((error)=>showFollowUpFallback('concept',error));});copyPrompt.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(buildPrompt.value);fallbackStatus.textContent='Prompt copied. Paste it into the conversation, then resume the timer.'}catch{buildPrompt.focus();buildPrompt.select();fallbackStatus.textContent='Clipboard access was unavailable; the prompt is selected for manual copy.'}});resumeTimerButton.addEventListener('click',()=>{fallback.hidden=true;resumeTimer()});
const savedState=bridge().widgetState||{};activeWidgetRunId=savedState.runId||null;if(savedState.runId)run={runId:savedState.runId,creationId:savedState.creationId||null,creationUrl:savedState.creationUrl||null,selectedApis:savedState.selectedApis||[],phase:savedState.phase||'spinned',statusUrl:savedState.statusUrl||null,choreography:savedState.choreography||null};if(run)ensureStatusPolling();showRun(bridge().toolOutput);if(savedState.creationId)showCreation({creationId:savedState.creationId,creationUrl:savedState.creationUrl||null,phase:'completed'});window.addEventListener('openai:set_globals',(event)=>showRun(event.detail?.globals?.toolOutput||event.detail?.globals?.toolResponseMetadata?.mcp_tool_result),{passive:true});})();
</script><!-- ${WIDGET_CONTRACT_PROMPT} --></body></html>`;

function chooseProtocolVersion(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSION;
}

function initializeResult(params = {}) {
  return {
    protocolVersion: chooseProtocolVersion(params.protocolVersion),
    capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } },
    serverInfo: { name: 'randomware', title: 'Randomware', version: '0.1.0' },
    instructions: promptSurface('Call open_randomware first to mount the persistent Randomware widget. The widget calls spin_apis directly; then follow the concept and artifact tool choreography.')
  };
}

function widgetResource(origin) {
  const canonicalOrigin = companionOrigin(origin);
  return {
    contents: [{
      uri: MCP_RESOURCE_URI,
      mimeType: MCP_RESOURCE_MIME,
      text: WIDGET_HTML.replaceAll('__RANDOMWARE_COMPANION_ORIGIN__', canonicalOrigin),
      _meta: {
        ui: {
          prefersBorder: true,
          domain: canonicalOrigin,
          csp: { connectDomains: [canonicalOrigin], resourceDomains: [canonicalOrigin], frameDomains: [canonicalOrigin] }
        },
        'openai/widgetCSP': { redirect_domains: [canonicalOrigin] },
        'openai/widgetDescription': 'A sequential API collision slot. Spin the bounded selector, then ask your model to build the specimen.'
      }
    }]
  };
}

function resourceSummary(origin) {
  return { uri: MCP_RESOURCE_URI, name: 'randomware', title: 'Randomware slot', description: 'Sequential API collision slot widget.', mimeType: MCP_RESOURCE_MIME, _meta: { ui: { domain: origin } } };
}

function widgetToolMeta() {
  return {
    ui: { resourceUri: MCP_RESOURCE_URI, visibility: ['model', 'app'] },
    'openai/outputTemplate': MCP_RESOURCE_URI,
    'openai/widgetAccessible': true,
    'openai/toolInvocation/invoking': 'Mounting the slot…',
    'openai/toolInvocation/invoked': 'Slot ready.'
  };
}

function jsonRpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

function callToolResult(structuredContent, text, extra = {}) {
  return { content: [{ type: 'text', text: String(text) }], structuredContent, ...extra };
}

module.exports = {
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCE_URI,
  MCP_RESOURCE_MIME,
  CHOREOGRAPHY_DEADLINES,
  initializeResult,
  conceptAcceptedPrompt,
  artifactRepairPrompt,
  artifactContractPrompt,
  contractPrompt,
  toolDescription,
  ARTIFACT_CONTRACT_LITERALS,
  widgetResource,
  resourceSummary,
  widgetToolMeta,
  widgetToolResult,
  widgetBuildPrompt,
  widgetRepairPrompt,
  jsonRpcError,
  callToolResult
};
