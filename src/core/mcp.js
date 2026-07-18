const MCP_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(['2025-06-18', '2025-03-26', '2024-11-05']);
const MCP_RESOURCE_URI = 'ui://widget/randomware.html';
const MCP_RESOURCE_MIME = 'text/html;profile=mcp-app';
const CHOREOGRAPHY_DEADLINES = Object.freeze({ concept: Object.freeze({ firstMs: 60000, finalMs: 120000 }), artifact: Object.freeze({ firstMs: 300000, finalMs: 900000 }), repair: Object.freeze({ firstMs: 300000, finalMs: 900000 }) });

function widgetToolResult(value) {
  let envelope = value;
  for (let depth = 0; depth < 3 && envelope && typeof envelope === 'object' && envelope.result && !envelope.structuredContent; depth += 1) envelope = envelope.result;
  const output = envelope?.structuredContent || envelope;
  if (!output || typeof output !== 'object') return null;
  const hasRunState = ['runId', 'phase', 'creationId', 'selectedApis', 'failure', 'revisions', 'nextTool'].some((key) => Object.prototype.hasOwnProperty.call(output, key));
  if (!hasRunState && envelope?.isError !== true) return null;
  return { output, isError: envelope?.isError === true };
}

const WIDGET_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Randomware</title><style>
:root{color-scheme:dark;font-family:Georgia,serif}body{margin:0;background:linear-gradient(135deg,#120b32,#081a24);color:#ffe7c7;padding:18px}main{border:2px solid #ffe7c7;padding:20px;box-shadow:8px 8px 0 #e8614f}h1{font-size:clamp(2rem,8vw,4rem);line-height:.9;margin:0 0 12px;text-transform:uppercase}p{line-height:1.45}button,.rw-link{background:#ffe7c7;color:#120b32;border:0;padding:11px 16px;font:700 1rem Georgia;cursor:pointer;margin:4px 4px 4px 0;text-decoration:none;display:inline-block}button:focus-visible,.rw-link:focus-visible{outline:3px solid #55e6c1}button[disabled]{opacity:.55;cursor:wait}ul{padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px;min-height:34px}li{border:1px solid #55e6c1;padding:6px 9px}#status{color:#55e6c1;min-height:1.4em}#creation{margin-top:18px;border-top:1px solid #55e6c1;padding-top:14px}#creation-frame{display:block;width:100%;height:min(78vh,720px);min-height:390px;border:2px solid #ffe7c7;background:#080a14;margin-top:10px}small{display:block;margin-top:16px;opacity:.8}</style></head><body><main><p>AI-generated experimental app</p><h1>Randomware</h1><p id="status">Choose nothing. Make something.</p><p>Sequential reveal, bounded APIs, honest failure.</p><ul id="apis" aria-live="polite"></ul><button id="spin" type="button">Spin the slot</button><button id="build" type="button" hidden>Ask the model to build</button><section id="creation" hidden><p id="creation-status">The creation is ready.</p><iframe id="creation-frame" title="Randomware creation" hidden></iframe><a id="creation-link" class="rw-link" href="#" target="_blank" rel="noopener noreferrer">Download or open the creation</a></section><small>Real APIs go in. Random apps come out. Embedded execution is primary; link-out remains available.</small></main><script>
(()=>{const status=document.querySelector('#status');const list=document.querySelector('#apis');const spin=document.querySelector('#spin');const build=document.querySelector('#build');const creation=document.querySelector('#creation');const creationStatus=document.querySelector('#creation-status');const creationFrame=document.querySelector('#creation-frame');const creationLink=document.querySelector('#creation-link');let run=null;let timer=null;let timerState=null;let activeWidgetRunId=null;let revealToken=0;const bridge=()=>window.openai||{};const text=(value)=>String(value??'');function save(){try{bridge().setWidgetState?.({runId:run?.runId||null,creationId:run?.creationId||null,selectedApis:run?.selectedApis||[],phase:run?.phase||null,deadlineAt:timerState?.finalAt||null,reSteered:Boolean(timerState?.reSteered)})}catch{}}
function clearTimer(){if(timer)clearTimeout(timer);timer=null;timerState=null;save()}
function followUp(phase){window.parent.postMessage({jsonrpc:'2.0',method:'ui/message',params:{role:'user',content:[{type:'text',text:'Randomware is still waiting in the '+phase+' phase. Continue now with the required tool call; send the complete artifact in the tool argument, not prose.'}]}},'*')}
async function recordTimeout(){const phase=timerState?.phase;clearTimer();status.textContent='The '+phase+' phase ended honestly: choreography timeout.';try{if(typeof bridge().callTool==='function'&&run?.runId)await bridge().callTool('record_choreography_failure',{runId:run.runId,phase,code:'choreography_timeout'})}catch{}}
function startTimer(phase){const limits=${JSON.stringify(CHOREOGRAPHY_DEADLINES)}[phase];if(!limits||!run?.runId)return;clearTimer();const now=Date.now();timerState={phase,firstAt:now+limits.firstMs,finalAt:now+limits.finalMs,reSteered:false};const schedule=()=>{const target=timerState.reSteered?timerState.finalAt:timerState.firstAt;timer=setTimeout(()=>{if(!timerState)return;if(!timerState.reSteered){timerState.reSteered=true;status.textContent='Still waiting for the '+phase+'…';followUp(phase);save();schedule()}else recordTimeout()},Math.max(0,target-Date.now()))};schedule();save()}
function updateTimerForRun(){if(run?.phase==='concept_accepted')startTimer('artifact');else if(run?.phase==='repair_requested')startTimer('repair');else if(run?.phase==='completed'||run?.phase==='failed')clearTimer()}
function creationHref(creationId){return new URL('/c/'+encodeURIComponent(creationId),window.location.origin).href}
function showCreation(value){const creationId=value?.creationId;if(!creationId||value?.phase!=='completed')return;const href=creationHref(creationId);run={...(run||{}),...value,creationId};creation.hidden=false;creationFrame.hidden=false;creationFrame.src=href;creationStatus.textContent='Creation is live in the widget. Use link-out if the embedded frame is unavailable.';creationLink.href=href;creationLink.onclick=(event)=>{if(typeof bridge().openExternal==='function'){event.preventDefault();bridge().openExternal({href,redirectUrl:false})}};status.textContent='Creation accepted and routable.';save()}
function toolResult(value){let envelope=value;for(let depth=0;depth<3&&envelope&&typeof envelope==='object'&&envelope.result&&!envelope.structuredContent;depth++)envelope=envelope.result;const output=envelope?.structuredContent||envelope;if(!output||typeof output!=='object')return null;const hasRunState=['runId','phase','creationId','selectedApis','failure','revisions','nextTool'].some((key)=>Object.prototype.hasOwnProperty.call(output,key));if(!hasRunState&&envelope?.isError!==true)return null;return {output,isError:envelope?.isError===true}}
function renderReels(reveal){const token=++revealToken;list.replaceChildren();const selected=run?.selectedApis||[];const append=(api)=>{if(token!==revealToken)return;const chip=document.createElement('li');chip.textContent=text(api.name||api.id);list.append(chip)};if(!selected.length)return;if(!reveal){selected.forEach(append);return}status.textContent='The reels are revealing…';selected.forEach((api,index)=>setTimeout(()=>{append(api);if(token===revealToken&&index===selected.length-1){status.textContent='Collision selected. The model can now invent the causal chain.';build.hidden=false;save()}},index*420))}
function showRun(value,source='global'){const result=toolResult(value);if(!result)return;const incoming=result.output;if(source==='widget'&&incoming.runId)activeWidgetRunId=incoming.runId;if(source!=='widget'&&(!activeWidgetRunId||(incoming.runId&&incoming.runId!==activeWidgetRunId)))return;if(result.isError){if(incoming.nextTool==='submit_repair')run={...(run||{}),phase:'repair_requested',failure:incoming};status.textContent='The build needs one bounded repair: '+text(incoming.code||'tool error')+'.';build.hidden=true;updateTimerForRun();save();return}const previous=run;run={...(run||{}),...incoming};if(!incoming.selectedApis&&previous?.selectedApis)run.selectedApis=previous.selectedApis;list.replaceChildren();build.hidden=true;updateTimerForRun();if(run.phase==='completed'){showCreation(run);return}if(run.phase==='failed'){status.textContent='The build ended honestly: '+text(run.failure?.code||'choreography timeout')+'.';return}if(run.phase==='concept_accepted'){renderReels(false);status.textContent='Concept accepted. The model is composing the artifact…';return}if(run.phase==='repair_requested'){renderReels(false);status.textContent='The first artifact needs one bounded repair.';return}if(run.phase==='spinned'){renderReels(source==='widget'&&(!previous||previous.runId!==run.runId||!list.children.length));build.hidden=false;return}if(!run?.selectedApis?.length&& !previous)status.textContent='The slot is ready.'}
async function spinNow(){spin.disabled=true;status.textContent='Calling the bounded selector…';try{if(typeof bridge().callTool!=='function')throw new Error('ChatGPT widget bridge unavailable');showRun(await bridge().callTool('spin_apis',{seed:crypto.randomUUID(),requestId:crypto.randomUUID()}),'widget')}catch(error){status.textContent='The slot failed honestly: '+text(error.message)}finally{spin.disabled=false}}
spin.addEventListener('click',spinNow);build.addEventListener('click',()=>{startTimer('concept');window.parent.postMessage({jsonrpc:'2.0',method:'ui/message',params:{role:'user',content:[{type:'text',text:'The Randomware widget selected '+(run?.selectedApis||[]).map((api)=>api.name||api.id).join(' + ')+'. Invent the required collision concept, then call submit_concept and continue the documented build choreography.'}]}},'*');status.textContent='Waiting for the model to build the specimen…'});
activeWidgetRunId=bridge().widgetState?.runId||null;showRun(bridge().toolOutput);if(bridge().widgetState?.creationId)showCreation({creationId:bridge().widgetState.creationId,phase:'completed'});window.addEventListener('openai:set_globals',(event)=>showRun(event.detail?.globals?.toolOutput||event.detail?.globals?.toolResponseMetadata?.mcp_tool_result),{passive:true});})();
</script></body></html>`;

function chooseProtocolVersion(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSION;
}

function initializeResult(params = {}) {
  return {
    protocolVersion: chooseProtocolVersion(params.protocolVersion),
    capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } },
    serverInfo: { name: 'randomware', title: 'Randomware', version: '0.1.0' },
    instructions: 'Call open_randomware first to mount the persistent Randomware widget. The widget calls spin_apis directly; then follow the concept and artifact tool choreography.'
  };
}

function widgetResource(origin) {
  return {
    contents: [{
      uri: MCP_RESOURCE_URI,
      mimeType: MCP_RESOURCE_MIME,
      text: WIDGET_HTML,
      _meta: {
        ui: {
          prefersBorder: true,
          domain: origin,
          csp: { connectDomains: [origin], resourceDomains: [origin], frameDomains: [origin] }
        },
        'openai/widgetCSP': { redirect_domains: [origin] },
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
  widgetResource,
  resourceSummary,
  widgetToolMeta,
  widgetToolResult,
  jsonRpcError,
  callToolResult
};
