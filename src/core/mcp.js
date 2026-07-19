const MCP_PROTOCOL_VERSION = '2025-06-18';
const { CHOREOGRAPHY_DEADLINES } = require('./choreography');
const { ARTIFACT_CONTRACT_LITERALS, TOOL_INSTRUCTIONS, artifactContractPrompt, contractPrompt, promptSurface, conceptAcceptedPrompt, artifactRepairPrompt, selectedExamplesPrompt } = require('./artifact-contract');
const { companionOrigin } = require('./urls');
const { registry } = require('./registry');
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
  return promptSurface(`Use Randomware run ${runId}: call get_run, then submit_concept, then submit the complete artifact via submit_artifact.`, selectedExamplesPrompt(run?.selectedApis));
}

function widgetRepairPrompt(run, diagnostics) {
  const input = run && typeof run === 'object' && Array.isArray(run.diagnostics) ? run : { runId: run?.runId, diagnostics };
  return artifactRepairPrompt({ runId: String(input?.runId || 'unknown'), diagnostics: input?.diagnostics, selectedApis: input?.selectedApis });
}

function toolDescription(name) {
  return promptSurface(TOOL_INSTRUCTIONS[name] || `Use the ${name} tool.`);
}

const WIDGET_CONTRACT_PROMPT = contractPrompt();
const WIDGET_SYMBOL_STRIP = registry.map(({ id, name, symbol, category, capability }) => ({ id, name, symbol, category, capability }));
const WIDGET_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Randomware</title><style>
:root{color-scheme:dark;font-family:Georgia,serif;--ink:#ffe7c7;--night:#120b32;--mint:#55e6c1;--hot:#e8614f}*{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,var(--night),#081a24);color:var(--ink);padding:14px}main{border:2px solid var(--ink);padding:clamp(16px,4vw,24px);box-shadow:7px 7px 0 var(--hot)}h1{font-size:clamp(2rem,8vw,4rem);line-height:.9;margin:0 0 12px;text-transform:uppercase}p{line-height:1.42}button,.rw-link{background:var(--ink);color:var(--night);border:0;padding:11px 16px;font:700 1rem Georgia;cursor:pointer;margin:4px 4px 4px 0;text-decoration:none;display:inline-block}button:focus-visible,.rw-link:focus-visible{outline:3px solid var(--mint)}button[disabled]{opacity:.55;cursor:wait}#status{color:var(--mint);min-height:1.4em}.stepper{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:15px 0;padding:0;list-style:none}.stepper li{position:relative;border-top:3px solid #ffffff2c;padding:7px 2px 0;color:#ffffff8c;font:700 .68rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em}.stepper li[data-state="done"]{border-color:var(--mint);color:var(--mint)}.stepper li[data-state="current"]{border-color:var(--hot);color:var(--ink)}.telemetry{display:flex;gap:16px;flex-wrap:wrap;font:700 .75rem system-ui,sans-serif;color:#ffffffb5}.composing{display:flex;align-items:center;gap:9px;color:var(--mint);font:700 .8rem system-ui,sans-serif}.composing::before{content:"";width:22px;height:22px;border:3px solid #55e6c144;border-top-color:var(--mint);border-radius:50%;animation:compose 1s linear infinite}@keyframes compose{to{transform:rotate(360deg)}}.reels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:9px;min-height:112px;padding:0;margin:16px 0;list-style:none}.reel{min-height:112px;display:grid;place-items:center;text-align:center;border:2px solid var(--mint);padding:10px;background:#080a14;overflow:hidden}.reel[data-state="shuffling"] .reel-symbol{animation:rattle .12s steps(2,end) infinite}.reel-symbol{display:block;font-size:2.6rem;line-height:1.1}.reel-copy{display:block;margin-top:7px;font:700 .75rem/1.25 system-ui,sans-serif}.reel.category-audio{border-color:#bd8cff}.reel.category-food{border-color:#ffce69}.reel.category-visual,.reel.category-characters{border-color:#ff9f8d}.reel.category-geo,.reel.category-dates{border-color:var(--mint)}.reels.is-flashing{animation:fullstop .65s ease-out}@keyframes rattle{50%{transform:translateY(-5px) scale(1.08)}}@keyframes fullstop{35%{filter:brightness(2);box-shadow:0 0 28px var(--mint)}100%{filter:none;box-shadow:none}}#reassurance{border-left:3px solid var(--mint);padding-left:10px}#failure{margin-top:16px;border:1px solid var(--hot);padding:12px}#fallback{margin-top:18px;border:1px solid var(--hot);padding:12px}#fallback textarea{width:100%;min-height:110px;background:#080a14;color:var(--ink);border:1px solid var(--mint);padding:10px;font:14px ui-monospace,monospace}#creation{margin-top:18px;border-top:1px solid var(--mint);padding-top:14px}#creation-frame{display:block;width:100%;height:min(82vh,850px);min-height:390px;border:2px solid var(--ink);background:#080a14;margin-top:10px}small{display:block;margin-top:16px;opacity:.8}@media(max-width:430px){body{padding:8px}.stepper li{font-size:.6rem}.reels{grid-template-columns:repeat(2,1fr)}.reels .reel:nth-child(3){grid-column:1/-1}.telemetry{gap:8px}}
</style></head><body><main><p>AI-generated experimental app</p><h1>Randomware</h1><ol id="steps" class="stepper" aria-label="Build progress"><li data-step="spin">spin</li><li data-step="concept">concept</li><li data-step="build">build</li><li data-step="boot">boot</li></ol><div class="telemetry" aria-live="polite"><span id="elapsed">elapsed 0s</span><span id="heartbeat">last activity —</span></div><p id="status">Choose nothing. Make something.</p><p id="composing" class="composing" hidden>Composing. No percentage will be invented.</p><p>Sequential reveal, bounded APIs, honest failure.</p><ol id="apis" class="reels" aria-live="polite"></ol><button id="spin" type="button">Spin the slot</button><button id="build" type="button" hidden>Ask the model to build</button><p id="reassurance" hidden>This run is tracked by the server. Its finished specimen will appear on the showcase even if this session closes.</p><section id="failure" hidden><p><strong id="failure-code"></strong></p><p id="failure-copy"></p><a id="autopsy" class="rw-link" href="#" target="_blank" rel="noopener noreferrer">Read the autopsy</a><button id="failure-spin" type="button">Spin again</button></section><section id="fallback" hidden><p id="fallback-status">The model follow-up could not be posted. Copy this prompt into the conversation.</p><textarea id="build-prompt" readonly aria-label="Build prompt"></textarea><button id="copy-prompt" type="button">Copy build prompt</button><button id="resume-timer" type="button">Resume concept timer</button></section><section id="creation" hidden><p id="creation-status">The creation is ready.</p><iframe id="creation-frame" title="Randomware creation" hidden></iframe><a id="creation-link" class="rw-link" href="#" target="_blank" rel="noopener noreferrer">Download or open the creation</a></section><small>Real APIs go in. Random apps come out. Embedded execution is primary; link-out remains available.</small></main><script>
(()=>{const status=document.querySelector('#status');const list=document.querySelector('#apis');const steps=document.querySelector('#steps');const elapsed=document.querySelector('#elapsed');const heartbeat=document.querySelector('#heartbeat');const composing=document.querySelector('#composing');const reassurance=document.querySelector('#reassurance');const failurePanel=document.querySelector('#failure');const failureCode=document.querySelector('#failure-code');const failureCopy=document.querySelector('#failure-copy');const autopsy=document.querySelector('#autopsy');const failureSpin=document.querySelector('#failure-spin');const spin=document.querySelector('#spin');const build=document.querySelector('#build');const fallback=document.querySelector('#fallback');const fallbackStatus=document.querySelector('#fallback-status');const buildPrompt=document.querySelector('#build-prompt');const copyPrompt=document.querySelector('#copy-prompt');const resumeTimerButton=document.querySelector('#resume-timer');const creation=document.querySelector('#creation');const creationStatus=document.querySelector('#creation-status');const creationFrame=document.querySelector('#creation-frame');const creationLink=document.querySelector('#creation-link');const artifactContractPrompt=${JSON.stringify(WIDGET_CONTRACT_PROMPT)};const symbolStrip=${JSON.stringify(WIDGET_SYMBOL_STRIP)};const companionOrigin='__RANDOMWARE_COMPANION_ORIGIN__';let run=null;let timer=null;let timerState=null;let pollTimer=null;let pollFailures=0;let activeWidgetRunId=null;let revealToken=0;let runStartedAt=0;const bridge=()=>window.openai||{};const text=(value)=>String(value??'');function save(){try{bridge().setWidgetState?.({runId:run?.runId||null,creationId:run?.creationId||null,creationUrl:run?.creationUrl||null,selectedApis:run?.selectedApis||[],phase:run?.phase||null,statusUrl:run?.statusUrl||null,choreography:run?.choreography||null,createdAt:run?.createdAt||runStartedAt||null,deadlineAt:timerState?.finalAt||null,reSteered:Boolean(timerState?.reSteered),paused:Boolean(timerState?.paused)})}catch{}}
function age(ms){if(!Number.isFinite(ms)||ms<0)return '—';const seconds=Math.floor(ms/1000);if(seconds<60)return seconds+'s';const minutes=Math.floor(seconds/60);return minutes+'m '+(seconds%60)+'s'}
function progressIndex(value){if(value?.phase==='completed')return 4;if(value?.phase==='concept_accepted'||value?.phase==='building'||value?.phase==='repair_requested')return 2;if(value?.phase==='spinned')return 1;return 0}
function renderProgress(){const index=progressIndex(run);steps.querySelectorAll('li').forEach((item,position)=>item.dataset.state=position<index?'done':position===index&&index<4?'current':'pending');const active=['spinned','concept_accepted','building','repair_requested'].includes(run?.phase)&&Boolean(activeWidgetRunId);composing.hidden=!active;const start=Number(run?.createdAt||runStartedAt);elapsed.textContent='elapsed '+(start?age(Date.now()-start):'0s');const activity=Number(run?.choreography?.lastActivityAt);heartbeat.textContent='last activity '+(activity?age(Date.now()-activity)+' ago':'—')}
setInterval(renderProgress,1000);renderProgress();
function stopStatusPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=null}
function ensureStatusPolling(){if(pollTimer||!run?.runId)return;pollTimer=setInterval(async()=>{try{const href=run.statusUrl||new URL('/api/runs/'+encodeURIComponent(run.runId),companionOrigin).href;const response=await fetch(href);if(!response.ok)throw new Error('status_http_'+response.status);const next=await response.json();pollFailures=0;showRun(next,'status')}catch(error){pollFailures+=1;console.warn('[Randomware] status polling failed',pollFailures,text(error?.message||error));if(pollFailures>=3)status.textContent='status polling unavailable'}},3000)}
function clearTimer(){if(timer)clearTimeout(timer);timer=null;timerState=null;save()}
function pauseTimer(){if(timer)clearTimeout(timer);timer=null;if(timerState)timerState.paused=true;save()}
function scheduleTimer(){if(!timerState||timerState.paused)return;const phase=timerState.phase;const target=Math.min(timerState.reSteered?timerState.finalAt:timerState.firstAt,timerState.absoluteAt||Infinity);timer=setTimeout(()=>{timer=null;if(!timerState||timerState.paused)return;if(!timerState.reSteered&&Date.now()<(timerState.absoluteAt||Infinity)){timerState.reSteered=true;timerState.finalAt=Math.min(timerState.absoluteAt||Infinity,Date.now()+(${JSON.stringify(CHOREOGRAPHY_DEADLINES)}[phase]?.finalMs||0));status.textContent='Still waiting for the '+phase+'…';save();void sendFollowUp(phase).catch((error)=>showFollowUpFallback(phase,error)).finally(()=>scheduleTimer())}else void recordTimeout()},Math.max(0,target-Date.now()))}
function resumeTimer(){if(!timerState)return;timerState.paused=false;status.textContent='The model follow-up is pending…';scheduleTimer();save()}
function selectedExamples(){const examples=(run?.selectedApis||[]).map(api=>({apiId:api.id||api.apiId,operations:(api.operations||[]).map(operation=>({operationId:operation.id,responseExample:operation.responseExample,outputSchema:operation.outputSchema,semanticFieldPaths:operation.semanticFieldPaths}))})).filter(api=>api.apiId&&api.operations.length);return examples.length?'SELECTED_ADAPTED_RESPONSE_EXAMPLES='+JSON.stringify(examples):''}
function followUpPrompt(phase){const runId=run?.runId||'unknown';const examples=selectedExamples();if(phase==='concept')return ['Use Randomware run '+runId+': call get_run, then submit_concept, then submit the complete artifact via submit_artifact.',artifactContractPrompt,examples].filter(Boolean).join(String.fromCharCode(10,10));const diagnostics=Array.isArray(run?.failure?.diagnostics)&&run.failure.diagnostics.length?run.failure.diagnostics:[run?.failure?.code||'the validator supplied no diagnostic detail'];return ['Artifact rejected for Randomware run '+runId+'. Use submit_repair once with a complete replacement artifact. Exact rejection diagnostics: '+diagnostics.map(text).join('; '),artifactContractPrompt,examples].filter(Boolean).join(String.fromCharCode(10,10))}
function logFollowUpApi(context){const api=bridge();const detail={context,sendFollowUpMessage:typeof api.sendFollowUpMessage,parentPostMessage:typeof window.parent?.postMessage,keys:Object.keys(api)};console.info('[Randomware] follow-up API',detail);return detail}
async function sendFollowUp(phase){const prompt=followUpPrompt(phase);const api=bridge();const detail=logFollowUpApi(phase);if(detail.sendFollowUpMessage!=='function')throw new Error('sendFollowUpMessage unavailable');const result=await api.sendFollowUpMessage({prompt});if(result&&((result.ok===false)||(result.success===false)||result.error))throw new Error(text(result.error||'sendFollowUpMessage returned an unsuccessful result'));status.textContent=phase==='concept'?'Waiting for the model to build the specimen…':'Still waiting for the '+phase+'…';return result}
function showFollowUpFallback(phase,error){const prompt=followUpPrompt(phase);fallback.hidden=false;fallbackStatus.textContent='Follow-up unavailable: '+text(error?.message||error)+'. Copy this prompt into the conversation, then resume the timer when you have pasted it.';buildPrompt.value=prompt;pauseTimer();status.textContent='The model follow-up could not be posted. Manual paste is ready.';save()}
async function recordTimeout(){const phase=timerState?.phase;clearTimer();stopStatusPolling();run={...(run||{}),phase:'failed',failure:{code:'choreography_timeout',detail:phase}};showFailure(run);renderProgress();try{if(typeof bridge().callTool==='function'&&run?.runId)await bridge().callTool('record_choreography_failure',{runId:run.runId,requestId:crypto.randomUUID(),phase,code:'choreography_timeout'})}catch{}}
function startTimer(phase){const limits=${JSON.stringify(CHOREOGRAPHY_DEADLINES)}[phase];if(!limits||!run?.runId)return;clearTimer();const now=Date.now();timerState={phase,firstAt:now+limits.firstMs,finalAt:now+limits.finalMs,absoluteAt:now+limits.absoluteMs,lastActivityAt:now,reSteered:false,paused:false};scheduleTimer();save()}
function updateTimerForRun(){if(run?.choreography){syncTimerFromServer();return}if(run?.phase==='concept_accepted')startTimer('artifact');else if(run?.phase==='repair_requested')startTimer('repair');else if(run?.phase==='completed'||run?.phase==='failed')clearTimer()}
function syncTimerFromServer(){const choreography=run?.choreography;const limits=choreography&&${JSON.stringify(CHOREOGRAPHY_DEADLINES)}[choreography.phase];if(!choreography||!limits)return;if(run.phase==='completed'||run.phase==='failed'){clearTimer();return}const activity=Number(choreography.lastActivityAt)||0;const changed=!timerState||timerState.phase!==choreography.phase||activity>(timerState.lastActivityAt||0);if(changed){if(timer)clearTimeout(timer);timer=null;timerState={phase:choreography.phase,firstAt:Number(choreography.idleDeadlineAt)||Date.now()+limits.firstMs,finalAt:Math.min(Number(choreography.absoluteDeadlineAt)||Infinity,(Number(choreography.idleDeadlineAt)||Date.now()+limits.firstMs)+limits.finalMs),absoluteAt:Number(choreography.absoluteDeadlineAt)||Date.now()+limits.absoluteMs,lastActivityAt:activity,reSteered:Boolean(choreography.reSteered),paused:Boolean(timerState?.paused)};if(!timerState.paused)scheduleTimer();save()}else{timerState.absoluteAt=Number(choreography.absoluteDeadlineAt)||timerState.absoluteAt;save()}}
function creationHref(value){if(value?.creationUrl)return value.creationUrl;return new URL('/c/'+encodeURIComponent(value?.creationId||''),companionOrigin).href}
function showCreation(value){const creationId=value?.creationId;if(!creationId||value?.phase!=='completed')return;run={...(run||{}),...value,creationId};const href=creationHref(run);creation.hidden=false;creationFrame.hidden=false;creationFrame.src=href;creationStatus.textContent='Creation is live in the widget. Use link-out if the embedded frame is unavailable.';creationLink.href=href;creationLink.onclick=(event)=>{if(typeof bridge().openExternal==='function'){event.preventDefault();bridge().openExternal({href,redirectUrl:false})}};status.textContent='Creation accepted and routable.';save()}
function toolResult(value){let envelope=value;for(let depth=0;depth<3&&envelope&&typeof envelope==='object'&&envelope.result&&!envelope.structuredContent;depth++)envelope=envelope.result;const output=envelope?.structuredContent||envelope;if(!output||typeof output!=='object')return null;const hasRunState=['runId','phase','creationId','selectedApis','failure','revisions','nextTool'].some((key)=>Object.prototype.hasOwnProperty.call(output,key));if(!hasRunState&&envelope?.isError!==true)return null;return {output,isError:envelope?.isError===true}}
function displayApi(api){return symbolStrip.find((item)=>item.id===(api.id||api.apiId))||{id:api.id||api.apiId,name:api.name||api.id,symbol:api.symbol||'❓',category:api.category||'unknown',capability:api.capability||'bounded source'}}
function setReel(reel,api){const display=displayApi(api);reel.className='reel category-'+display.category;reel.dataset.state='stopped';reel.innerHTML='';const symbol=document.createElement('span');symbol.className='reel-symbol';symbol.setAttribute('aria-hidden','true');symbol.textContent=display.symbol;const copy=document.createElement('span');copy.className='reel-copy';copy.textContent=display.name+' — '+display.capability;reel.append(symbol,copy)}
function renderReels(reveal){const token=++revealToken;list.replaceChildren();list.classList.remove('is-flashing');const selected=run?.selectedApis||[];if(!selected.length)return;const reels=selected.map((api,index)=>{const reel=document.createElement('li');reel.className='reel';reel.dataset.state=reveal?'shuffling':'stopped';reel.dataset.reel=String(index+1);list.append(reel);if(!reveal)setReel(reel,api);return reel});if(!reveal)return;status.textContent='The reels are shuffling…';const intervals=reels.map((reel,index)=>setInterval(()=>{if(token!==revealToken)return;const display=symbolStrip[(Math.floor(Date.now()/80)+index*5)%symbolStrip.length];reel.innerHTML='<span class="reel-symbol" aria-hidden="true">'+display.symbol+'</span><span class="reel-copy">colliding…</span>'},80));selected.forEach((api,index)=>setTimeout(()=>{if(token!==revealToken)return;clearInterval(intervals[index]);setReel(reels[index],api);reels[index].dataset.stoppedAt=String(Date.now());if(index===selected.length-1){list.classList.add('is-flashing');status.textContent='Collision selected. The model can now invent the causal chain.';build.hidden=false;setTimeout(()=>list.classList.remove('is-flashing'),700);save()}},520+index*520))}
function failureMessage(code){const known={choreography_timeout:'The model went quiet long enough for the referee to close the file.',repair_failed:'The one permitted repair still missed the contract.',capacity_reached:'The specimen reached a published resource limit.'};return known[code]||'The referee stopped the build instead of pretending it succeeded.'}
function showFailure(value){const code=text(value?.failure?.code||value?.code||'choreography_timeout');failurePanel.hidden=false;failureCode.textContent='Build ended: '+code;failureCopy.textContent=failureMessage(code);const href=value?.creationId?creationHref(value):companionOrigin;autopsy.href=href;autopsy.onclick=(event)=>{if(typeof bridge().openExternal==='function'){event.preventDefault();bridge().openExternal({href,redirectUrl:false})}};status.textContent='The build ended honestly: '+code+'.'}
function showRun(value,source='global'){const result=toolResult(value);if(!result)return;const incoming=result.output;if(source==='widget'&&incoming.runId){activeWidgetRunId=incoming.runId;pollFailures=0;runStartedAt=Number(incoming.createdAt)||Date.now()}if(source!=='widget'&&(!activeWidgetRunId||(incoming.runId&&incoming.runId!==activeWidgetRunId)))return;if(result.isError){if(incoming.nextTool==='submit_repair')run={...(run||{}),phase:'repair_requested',choreography:null,failure:incoming};status.textContent='The build needs one bounded repair: '+text(incoming.code||'tool error')+'.';build.hidden=true;updateTimerForRun();renderProgress();save();return}const previous=run;run={...(run||{}),...incoming};if(!incoming.selectedApis&&previous?.selectedApis)run.selectedApis=previous.selectedApis;if(!runStartedAt)runStartedAt=Number(run.createdAt)||Date.now();ensureStatusPolling();fallback.hidden=true;failurePanel.hidden=true;list.replaceChildren();build.hidden=true;updateTimerForRun();renderProgress();if(run.phase==='completed'){stopStatusPolling();showCreation(run);return}if(run.phase==='failed'){stopStatusPolling();showFailure(run);return}if(run.phase==='concept_accepted'){renderReels(false);status.textContent='Concept accepted. The model is composing the artifact…';reassurance.hidden=false;return}if(run.phase==='repair_requested'){renderReels(false);status.textContent='The first artifact needs one bounded repair.';reassurance.hidden=false;return}if(run.phase==='spinned'){renderReels(source==='widget'&&(!previous||previous.runId!==run.runId||!list.children.length));build.hidden=false;return}if(!run?.selectedApis?.length&&!previous)status.textContent='The slot is ready.'}
async function spinNow(){spin.disabled=true;failurePanel.hidden=true;creation.hidden=true;reassurance.hidden=true;status.textContent='Calling the bounded selector…';try{if(typeof bridge().callTool!=='function')throw new Error('ChatGPT widget bridge unavailable');showRun(await bridge().callTool('spin_apis',{seed:crypto.randomUUID(),requestId:crypto.randomUUID()}),'widget')}catch(error){status.textContent='The slot failed honestly: '+text(error.message)}finally{spin.disabled=false}}
spin.addEventListener('click',spinNow);failureSpin.addEventListener('click',spinNow);build.addEventListener('click',()=>{startTimer('concept');fallback.hidden=true;reassurance.hidden=false;status.textContent='Asking the model to build the specimen…';renderProgress();void sendFollowUp('concept').catch((error)=>showFollowUpFallback('concept',error));});copyPrompt.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(buildPrompt.value);fallbackStatus.textContent='Prompt copied. Paste it into the conversation, then resume the timer.'}catch{buildPrompt.focus();buildPrompt.select();fallbackStatus.textContent='Clipboard access was unavailable; the prompt is selected for manual copy.'}});resumeTimerButton.addEventListener('click',()=>{fallback.hidden=true;resumeTimer()});
const savedState=bridge().widgetState||{};activeWidgetRunId=savedState.runId||null;runStartedAt=Number(savedState.createdAt)||0;if(savedState.runId)run={runId:savedState.runId,createdAt:savedState.createdAt||null,creationId:savedState.creationId||null,creationUrl:savedState.creationUrl||null,selectedApis:savedState.selectedApis||[],phase:savedState.phase||'spinned',statusUrl:savedState.statusUrl||null,choreography:savedState.choreography||null};if(run)ensureStatusPolling();showRun(bridge().toolOutput);if(savedState.creationId)showCreation({creationId:savedState.creationId,creationUrl:savedState.creationUrl||null,phase:'completed'});renderProgress();window.addEventListener('openai:set_globals',(event)=>showRun(event.detail?.globals?.toolOutput||event.detail?.globals?.toolResponseMetadata?.mcp_tool_result),{passive:true});})();
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
