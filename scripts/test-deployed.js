const baseArg = process.argv.find((arg) => arg.startsWith('--base-url='));
const base = (baseArg ? baseArg.slice('--base-url='.length) : process.env.RANDOMWARE_PUBLIC_URL || '').replace(/\/$/, '');
if (!base) { console.error('test:e2e:deployed requires --base-url=HTTPS_URL or RANDOMWARE_PUBLIC_URL'); process.exit(2); }
if (!/^https:\/\//i.test(base)) { console.error('deployed URL must use HTTPS'); process.exit(2); }

(async () => {
  const health = await fetch(`${base}/healthz`); if (!health.ok) throw new Error(`health_status:${health.status}`);
  const healthBody = await health.json(); if (healthBody.ok !== true || healthBody.registry < 10) throw new Error('health_contract_failed');
  const mcp = (message) => fetch(`${base}/mcp`, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify(message) });
  const initialize = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'randomware-deployed-e2e', version: '1.0.0' } } });
  if (!initialize.ok) throw new Error(`mcp_initialize_status:${initialize.status}`);
  const initializeBody = await initialize.json(); if (initializeBody.result?.protocolVersion !== '2025-06-18' || !initializeBody.result?.capabilities?.tools || !initializeBody.result?.capabilities?.resources) throw new Error('mcp_initialize_contract_failed');
  const ready = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' }); if (ready.status !== 202 || (await ready.text()) !== '') throw new Error('mcp_initialized_notification_failed');
  const ping = await mcp({ jsonrpc: '2.0', id: 2, method: 'ping' }); if (!ping.ok || JSON.stringify((await ping.json()).result) !== '{}') throw new Error('mcp_ping_failed');
  const resourceList = await mcp({ jsonrpc: '2.0', id: 3, method: 'resources/list' }); const resourceBody = await resourceList.json(); if (resourceBody.result?.resources?.[0]?.uri !== 'ui://widget/randomware.html') throw new Error('mcp_resource_list_failed');
  const resourceRead = await mcp({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'ui://widget/randomware.html' } }); const resourceReadBody = await resourceRead.json(); const content = resourceReadBody.result?.contents?.[0]; if (content?.mimeType !== 'text/html;profile=mcp-app' || content?._meta?.ui?.csp?.frameDomains) throw new Error('mcp_resource_read_failed');
  const tools = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/list' });
  const toolsBody = await tools.json(); if (toolsBody.result?.tools?.length !== 8) throw new Error('mcp_tool_count_failed');
  const open = toolsBody.result.tools.find((tool) => tool.name === 'open_randomware'); if (open?._meta?.ui?.resourceUri !== 'ui://widget/randomware.html' || open?._meta?.['openai/outputTemplate'] !== 'ui://widget/randomware.html') throw new Error('mcp_render_tool_metadata_failed');
  const get = await fetch(`${base}/mcp`, { headers: { accept: 'text/event-stream' } }); if (get.status !== 405) throw new Error(`mcp_get_status:${get.status}`);
  const index = await fetch(base); if (!index.ok || !(await index.text()).includes('Randomware')) throw new Error('public_index_failed');
  console.log(JSON.stringify({ ok: true, base, registry: healthBody.registry, tools: toolsBody.result.tools.length, protocolVersion: initializeBody.result.protocolVersion, widget: content.mimeType }));
})().catch((error) => { console.error(`deployed acceptance failed: ${error.message}`); process.exitCode = 1; });
