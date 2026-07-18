const { ARTIFACT_CONTRACT } = require('./artifact-contract');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function createArtifact({ appName, selected }) {
  const calls = selected.map(({ apiId, operationId }) => `window.randomware.call(${JSON.stringify(apiId)},${JSON.stringify(operationId)},{})`).join(',');
  const labels = selected.map(({ apiId }) => `<li>${escapeHtml(apiId)}</li>`).join('');
  const script = `const out=document.querySelector('#result');document.querySelector('#go').addEventListener('click',async()=>{out.dataset.state='loading';try{const values=await Promise.all([${calls}]);out.textContent=values.map((value)=>JSON.stringify(value.data||value)).join('\\n');out.dataset.state='interactive'}catch(error){out.textContent='The broker returned a safe failure: '+error.message;out.dataset.state='error'}});${ARTIFACT_CONTRACT.ready};`;
  const padding = `/* bounded specimen padding ${'collision '.repeat(950)} */`;
  return `<!doctype html><html><head><meta charset="utf-8">${ARTIFACT_CONTRACT.viewport} content="width=device-width,initial-scale=1"><title>${escapeHtml(appName)}</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 20%,#e8614f 0 8%,transparent 28%),linear-gradient(135deg,#120b32,#081a24);color:#ffe7c7;font:16px Georgia,serif;padding:clamp(18px,6vw,72px)}main{max-width:850px;margin:auto;border:3px solid #ffe7c7;padding:clamp(22px,5vw,60px);box-shadow:14px 14px 0 #e8614f}h1{font-size:clamp(2.2rem,8vw,6rem);line-height:.9;margin:0 0 18px;text-transform:uppercase;letter-spacing:-.08em}p{max-width:55ch;line-height:1.5}button{background:#ffe7c7;color:#120b32;border:0;padding:14px 24px;font:700 1rem Georgia;cursor:pointer}button:focus-visible{outline:4px solid #55e6c1}pre{white-space:pre-wrap;min-height:8rem;border-left:4px solid #55e6c1;padding:16px;background:#0005}ul{display:flex;gap:12px;flex-wrap:wrap;padding:0;list-style:none}li{border:1px solid #55e6c1;padding:4px 8px}section[data-randomware="error"]{display:none}footer{margin-top:32px;font-size:.8rem}</style></head><body><main><section ${ARTIFACT_CONTRACT.markers[0]} hidden>Awaiting the specimen…</section><h1>${escapeHtml(appName)}</h1><p>A serious instrument for colliding unrelated public signals. The machine has selected these ingredients:</p><ul>${labels}</ul><button id="go" type="button">Perform the collision</button><section ${ARTIFACT_CONTRACT.markers[2]}><pre id="result" aria-live="polite">Press the button to ask the mediated broker.</pre></section><section ${ARTIFACT_CONTRACT.markers[1]}>The collision failed honestly; inspect the specimen traffic.</section><footer ${ARTIFACT_CONTRACT.markers[3]}>AI-generated experimental app · API attribution is preserved by Randomware.</footer></main><script>${script}</script>${padding}</body></html>`;
}

module.exports = { createArtifact, escapeHtml };
