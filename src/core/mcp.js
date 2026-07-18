const MCP_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(['2025-06-18', '2025-03-26', '2024-11-05']);
const MCP_RESOURCE_URI = 'ui://widget/randomware.html';
const MCP_RESOURCE_MIME = 'text/html;profile=mcp-app';

const WIDGET_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Randomware</title><style>
:root{color-scheme:dark;font-family:Georgia,serif}body{margin:0;background:linear-gradient(135deg,#120b32,#081a24);color:#ffe7c7;padding:18px}main{border:2px solid #ffe7c7;padding:20px;box-shadow:8px 8px 0 #e8614f}h1{font-size:clamp(2rem,8vw,4rem);line-height:.9;margin:0 0 12px;text-transform:uppercase}p{line-height:1.45}button{background:#ffe7c7;color:#120b32;border:0;padding:11px 16px;font:700 1rem Georgia;cursor:pointer;margin:4px 4px 4px 0}button:focus-visible{outline:3px solid #55e6c1}button[disabled]{opacity:.55;cursor:wait}ul{padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px;min-height:34px}li{border:1px solid #55e6c1;padding:6px 9px}#status{color:#55e6c1;min-height:1.4em}small{display:block;margin-top:16px;opacity:.8}</style></head><body><main><p>AI-generated experimental app</p><h1>Randomware</h1><p id="status">Choose nothing. Make something.</p><p>Sequential reveal, bounded APIs, honest failure.</p><ul id="apis" aria-live="polite"></ul><button id="spin" type="button">Spin the slot</button><button id="build" type="button" hidden>Ask the model to build</button><small>Real APIs go in. Random apps come out. Embedding stays off; link-out is final.</small></main><script>
(()=>{const status=document.querySelector('#status');const list=document.querySelector('#apis');const spin=document.querySelector('#spin');const build=document.querySelector('#build');let run=null;const bridge=()=>window.openai||{};const text=(value)=>String(value??'');function save(){try{bridge().setWidgetState?.({runId:run?.runId||null,selectedApis:run?.selectedApis||[]})}catch{}}
function showRun(value){run=value?.structuredContent||value||null;list.replaceChildren();build.hidden=true;if(!run?.selectedApis?.length){status.textContent='The slot is ready.';return}status.textContent='The reels are revealing…';run.selectedApis.forEach((api,index)=>setTimeout(()=>{const chip=document.createElement('li');chip.textContent=text(api.name||api.id);list.append(chip);if(index===run.selectedApis.length-1){status.textContent='Collision selected. The model can now invent the causal chain.';build.hidden=false;save()}},index*420))}
async function spinNow(){spin.disabled=true;status.textContent='Calling the bounded selector…';try{if(typeof bridge().callTool!=='function')throw new Error('ChatGPT widget bridge unavailable');showRun(await bridge().callTool('spin_apis',{seed:crypto.randomUUID(),requestId:crypto.randomUUID()}))}catch(error){status.textContent='The slot failed honestly: '+text(error.message)}finally{spin.disabled=false}}
spin.addEventListener('click',spinNow);build.addEventListener('click',()=>{window.parent.postMessage({jsonrpc:'2.0',method:'ui/message',params:{role:'user',content:[{type:'text',text:'The Randomware widget selected '+(run?.selectedApis||[]).map((api)=>api.name||api.id).join(' + ')+'. Invent the required collision concept, then call submit_concept and continue the documented build choreography.'}]}},'*');status.textContent='Waiting for the model to build the specimen…'});
showRun(bridge().toolOutput);window.addEventListener('openai:set_globals',(event)=>showRun(event.detail?.globals?.toolOutput),{passive:true});})();
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
          csp: { connectDomains: [origin], resourceDomains: [origin] }
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
  initializeResult,
  widgetResource,
  resourceSummary,
  widgetToolMeta,
  jsonRpcError,
  callToolResult
};
