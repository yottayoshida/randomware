const fs = require('node:fs');
const path = require('node:path');
const { registry } = require('../src/core/registry');
const { Broker } = require('../src/core/broker');

const root = path.resolve(__dirname, '..');

function goldenMedia(apiId, operationId) {
  const fixtureSources = { assets: [], media: null };
  return {
    origin: 'https://randomware.example',
    runId: 'golden-run',
    creationId: 'golden-creation',
    revision: 1,
    capability: { nonce: 'golden-page', expiresAt: Date.now() + 600000 },
    tokenSigner: {
      issueAsset: () => `golden-asset-${apiId}-${operationId}`,
      issueMedia: () => `golden-media-${apiId}-${operationId}`
    },
    mediaStore: {
      createAssetToken: async () => {},
      createMediaToken: async () => {}
    },
    fixtureSources,
    captureAsset: (candidate) => fixtureSources.assets.push({ path: candidate.path, resolvedUrl: candidate.resolvedUrl }),
    captureMedia: (candidate) => { fixtureSources.media = { resolvedUrl: candidate.resolvedUrl }; }
  };
}

async function capture(broker, entry, operation) {
  const media = goldenMedia(entry.id, operation.id);
  const result = await broker.call({
    selectedApis: [{ apiId: entry.id, operationIds: [operation.id] }],
    apiId: entry.id,
    operationId: operation.id,
    params: {},
    media
  });
  return { apiId: entry.id, operationId: operation.id, data: result.data, fixtureSources: media.fixtureSources };
}

async function main() {
  const broker = new Broker({ fixtureMode: 'raw', fixtureRoot: root });
  for (const entry of registry) {
    for (const operation of entry.operations) {
      const target = path.join(root, operation.adaptedFixturePath);
      const fixture = await capture(broker, entry, operation);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`);
    }
  }
  console.log(`adapted fixtures written through production adapters (${registry.length} entries)`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { capture, goldenMedia };
