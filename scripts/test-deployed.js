const baseArg = process.argv.find((arg) => arg.startsWith('--base-url='));
const base = (baseArg ? baseArg.slice('--base-url='.length) : process.env.RANDOMWARE_PUBLIC_URL || '').replace(/\/$/, '');
if (!base) { console.error('test:e2e:deployed requires --base-url=HTTPS_URL or RANDOMWARE_PUBLIC_URL'); process.exit(2); }
if (!/^https:\/\//i.test(base)) { console.error('deployed URL must use HTTPS'); process.exit(2); }

(async () => {
  const health = await fetch(`${base}/healthz`); if (!health.ok) throw new Error(`health_status:${health.status}`);
  const healthBody = await health.json(); if (healthBody.ok !== true || healthBody.registry < 10) throw new Error('health_contract_failed');
  const tools = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  const toolsBody = await tools.json(); if (toolsBody.result?.tools?.length !== 8) throw new Error('mcp_tool_count_failed');
  const index = await fetch(base); if (!index.ok || !(await index.text()).includes('Randomware')) throw new Error('public_index_failed');
  console.log(JSON.stringify({ ok: true, base, registry: healthBody.registry, tools: toolsBody.result.tools.length }));
})().catch((error) => { console.error(`deployed acceptance failed: ${error.message}`); process.exitCode = 1; });
