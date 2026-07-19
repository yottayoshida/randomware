const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs', 'api-candidates', 'samples');
const MAX_BYTES = 200_000;
const candidates = [
  ['gbif.json', 'https://api.gbif.org/v1/occurrence/search?mediaType=StillImage&limit=2'],
  ['nasa-images.json', 'https://images-api.nasa.gov/search?q=PIA12348&media_type=image'],
  ['loc-photos.json', 'https://www.loc.gov/photos/?q=moon&fo=json&c=2']
];
const requested = new Set(process.argv.slice(2));

async function capture(name, url) {
  const started = Date.now();
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Randomware/0.1 (competition demo)' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${name}:status_${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error(`${name}:content_type_${type}`);
  const raw = Buffer.from(await response.arrayBuffer());
  if (raw.byteLength > MAX_BYTES) throw new Error(`${name}:response_too_large_${raw.byteLength}`);
  const parsed = JSON.parse(raw.toString('utf8'));
  fs.writeFileSync(path.join(output, name), `${JSON.stringify(parsed, null, 2)}\n`);
  const headerText = [...response.headers.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}: ${value}`).join('\n');
  fs.writeFileSync(path.join(output, name.replace(/\.json$/, '.headers')), `${headerText}\n`);
  return { name, status: response.status, bytes: raw.byteLength, latencyMs: Date.now() - started, finalUrl: response.url };
}

(async () => {
  const results = [];
  for (const candidate of candidates) {
    if (!requested.size || requested.has(candidate[0])) results.push(await capture(...candidate));
  }
  console.log(JSON.stringify(results));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
