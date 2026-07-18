const test = require('node:test');
const assert = require('node:assert/strict');
const { ASSET_LIMITS, prepareAssetData, collectAssetCandidates, rewriteAssetCandidates, validateAssetUrl, fetchAsset } = require('../../src/core/asset');
const { getRegistryEntry } = require('../../src/core/registry');
const { RunStore } = require('../../src/core/store');

const cases = {
  'deck-of-cards': { cards: [{ image: 'https://deckofcardsapi.com/static/img/AS.png', images: { png: 'https://deckofcardsapi.com/static/img/AS.png' } }] },
  artic: { data: [{ image_id: '0431a3a2-e470-677e-671a-b4dacf14468d' }], config: { iiif_url: 'https://www.artic.edu/iiif/2' } },
  'dog-ceo': { message: 'https://images.dog.ceo/breeds/terrier/test.jpg' },
  randomuser: { results: [{ picture: { large: 'https://randomuser.me/api/portraits/women/51.jpg', thumbnail: 'https://randomuser.me/api/portraits/thumb/women/51.jpg' } }] },
  'wiki-onthisday': { selected: [{ text: 'event', year: 2024, pages: [{ title: 'Example', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a.jpg/330px-a.jpg' } }] }] },
  'met-museum': { primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/example.jpg', primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg' },
  tvmaze: [{ show: { image: { medium: 'https://static.tvmaze.com/uploads/images/medium_portrait/1/example.jpg' } } }],
  rickandmorty: { image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg', url: 'https://rickandmortyapi.com/api/character/1' },
  'open-food-facts': { product: { image_url: 'https://images.openfoodfacts.org/images/products/301/front.jpg' } },
  themealdb: { meals: [{ strMealThumb: 'https://www.themealdb.com/images/media/meals/example.jpg', strSource: 'https://example.com/recipe' }] }
};

test('every image-bearing operation rewrites all allowlisted fields without leaking an upstream asset host', async () => {
  for (const [apiId, raw] of Object.entries(cases)) {
    const entry = getRegistryEntry(apiId);
    assert.ok(entry.assetPolicy.resolvedPaths.length > 0, `${apiId}:asset_policy_missing`);
    const data = prepareAssetData(apiId, raw);
    const candidates = collectAssetCandidates(entry, data);
    assert.ok(candidates.length > 0, `${apiId}:asset_candidate_missing`);
    for (const candidate of candidates) assert.equal(validateAssetUrl(candidate.resolvedUrl, entry.assetPolicy).hostname, new URL(candidate.resolvedUrl).hostname);
    let minted = 0;
    const rewritten = await rewriteAssetCandidates(data, candidates, () => `https://randomware.randomware.workers.dev/api/runtime/asset/signed-${minted++}`);
    const serialized = JSON.stringify(rewritten);
    assert.match(serialized, /https:\/\/randomware\.randomware\.workers\.dev\/api\/runtime\/asset\/signed-/i, `${apiId}:signed_asset_missing`);
    for (const candidate of candidates) assert.equal(serialized.includes(new URL(candidate.resolvedUrl).hostname), false, `${apiId}:raw_asset_host_leaked`);
  }
});

test('asset validation rejects credentials, private hosts, non-HTTPS, and hosts outside the registry policy', () => {
  const policy = getRegistryEntry('dog-ceo').assetPolicy;
  assert.throws(() => validateAssetUrl('https://user:pass@images.dog.ceo/a.jpg', policy), /asset_credentials/);
  assert.throws(() => validateAssetUrl('https://127.0.0.1/a.jpg', policy), /asset_private_host/);
  assert.throws(() => validateAssetUrl('http://images.dog.ceo/a.jpg', policy), /asset_scheme/);
  assert.throws(() => validateAssetUrl('https://evil.example/a.jpg', policy), /asset_host_rejected/);
});

test('asset fetch enforces image MIME, per-asset bytes, and validated redirects', async () => {
  const policy = getRegistryEntry('dog-ceo').assetPolicy;
  let calls = 0;
  const fetched = await fetchAsset({
    target: 'https://images.dog.ceo/a.jpg', policy,
    fetcher: async () => { calls += 1; return calls === 1 ? new Response(null, { status: 302, headers: { location: '/b.jpg' } }) : new Response(Buffer.from('image'), { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '5' } }); }
  });
  assert.equal(fetched.contentType, 'image/jpeg');
  assert.equal(calls, 2);
  await assert.rejects(() => fetchAsset({ target: 'https://images.dog.ceo/a.jpg', policy, fetcher: async () => new Response('not image', { headers: { 'content-type': 'text/html' } }) }), /asset_content_type/);
  await assert.rejects(() => fetchAsset({ target: 'https://images.dog.ceo/a.jpg', policy, fetcher: async () => new Response(null, { headers: { 'content-type': 'image/jpeg', 'content-length': String(ASSET_LIMITS.bytesEach + 1) } }) }), /asset_bytes_cap/);
});

test('asset page quota permits 8 MiB total and rejects the next image', () => {
  const store = new RunStore();
  const run = store.createRun({ requestId: 'asset-quota', selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }] });
  for (let index = 0; index < 4; index += 1) {
    const tokenId = `asset_${index}`;
    store.createAssetToken(run.id, { tokenId, pageId: 'page', creationId: 'creation', revision: 1, apiId: 'dog-ceo', operationId: 'random', resolvedUrl: `https://images.dog.ceo/${index}.jpg`, expiresAt: Date.now() + 60000, maxBytes: ASSET_LIMITS.bytesEach, pageMaxBytes: ASSET_LIMITS.bytesPerPage });
    store.reserveAsset(tokenId, ASSET_LIMITS.bytesEach);
    store.finishAsset(tokenId, ASSET_LIMITS.bytesEach);
  }
  store.createAssetToken(run.id, { tokenId: 'asset_4', pageId: 'page', creationId: 'creation', revision: 1, apiId: 'dog-ceo', operationId: 'random', resolvedUrl: 'https://images.dog.ceo/4.jpg', expiresAt: Date.now() + 60000, maxBytes: ASSET_LIMITS.bytesEach, pageMaxBytes: ASSET_LIMITS.bytesPerPage });
  assert.throws(() => store.reserveAsset('asset_4', 1), /asset_page_bytes_cap/);
});
