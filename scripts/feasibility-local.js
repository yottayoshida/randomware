const crypto = require('node:crypto');
const { validateArtifact } = require('../src/core/validator');

const selectedApis = [{ apiId: 'open-meteo', operationIds: ['forecast'] }];
function specimen(bytes) {
  const head = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section data-randomware="loading">loading</section><section data-randomware="error">error</section><main data-randomware="interactive"><button>go</button></main><footer data-randomware="attribution">source</footer><script>window.randomware.call("open-meteo","forecast",{});window.randomware.ready();</script>';
  const close = '</body></html>'; return `${head}${'x'.repeat(Math.max(0, bytes - Buffer.byteLength(head + close)))}${close}`;
}
const results = [10000, 25000, 40000].map((bytes) => {
  const html = specimen(bytes); const validation = validateArtifact(html, { selectedApis }); const localHash = crypto.createHash('sha256').update(html).digest('hex');
  return { requestedBytes: bytes, actualBytes: Buffer.byteLength(html), localHash, validatorHash: validation.sha256, accepted: validation.ok, bytePerfect: Buffer.byteLength(html) === bytes && localHash === validation.sha256 };
});
console.log(JSON.stringify({ status: results.every((row) => row.accepted && row.bytePerfect) ? 'pass' : 'fail', results }, null, 2));
if (results.some((row) => !row.accepted || !row.bytePerfect)) process.exitCode = 1;
