const SAMPLE_RATE = 8000;
const DURATION_SECONDS = 4;

function fixtureWave() {
  const samples = SAMPLE_RATE * DURATION_SECONDS;
  const bytes = samples * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + bytes, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24); buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(bytes, 40);
  for (let index = 0; index < samples; index += 1) buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * index) / SAMPLE_RATE) * 5000), 44 + index * 2);
  return buffer;
}

const FIXTURE_WAVE = fixtureWave();

async function fixtureMediaFetcher(_target, options = {}) {
  const range = options.headers instanceof Headers ? options.headers.get('range') : options.headers?.range;
  const match = String(range || '').match(/^bytes=(\d+)-(\d*)$/);
  const start = match ? Number(match[1]) : 0;
  const requestedEnd = match && match[2] ? Number(match[2]) : FIXTURE_WAVE.length - 1;
  const end = Math.min(FIXTURE_WAVE.length - 1, Math.max(start, requestedEnd));
  const body = FIXTURE_WAVE.subarray(start, end + 1);
  return new Response(body, { status: match ? 206 : 200, headers: { 'content-type': 'audio/wav', 'content-length': String(body.length), 'accept-ranges': 'bytes', ...(match ? { 'content-range': `bytes ${start}-${end}/${FIXTURE_WAVE.length}` } : {}) } });
}

module.exports = { fixtureMediaFetcher };
