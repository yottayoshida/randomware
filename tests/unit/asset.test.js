const test = require('node:test');
const assert = require('node:assert/strict');
const { ASSET_LIMITS, prepareAssetData, collectAssetCandidates, rewriteAssetCandidates, validateAssetUrl, fetchAsset } = require('../../src/core/asset');
const { getRegistryEntry } = require('../../src/core/registry');
const { RunStore } = require('../../src/core/store');

const cases = {
  'deck-of-cards': { cards: [{ image: 'https://deckofcardsapi.com/static/img/AS.png', images: { png: 'https://deckofcardsapi.com/static/img/AS.png' } }] },
  artic: { data: [{ image_id: '0431a3a2-e470-677e-671a-b4dacf14468d', thumbnail: { lqip: 'data:image/gif;base64,aW1hZ2U=' } }], config: { iiif_url: 'https://www.artic.edu/iiif/2' } },
  'dog-ceo': { message: 'https://images.dog.ceo/breeds/terrier/test.jpg' },
  randomuser: { results: [{ picture: { large: 'https://randomuser.me/api/portraits/women/51.jpg', thumbnail: 'https://randomuser.me/api/portraits/thumb/women/51.jpg' } }] },
  'wiki-onthisday': { selected: [{ text: 'event', year: 2024, pages: [{ title: 'Example', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a.jpg/330px-a.jpg' } }] }] },
  'met-museum': { primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/example.jpg', primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg' },
  tvmaze: [{ show: { image: { medium: 'https://static.tvmaze.com/uploads/images/medium_portrait/1/example.jpg' } } }],
  rickandmorty: { image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg', url: 'https://rickandmortyapi.com/api/character/1' },
  'open-food-facts': { product: { image_url: 'https://images.openfoodfacts.org/images/products/301/front.jpg' } },
  themealdb: { meals: [{ strMealThumb: 'https://www.themealdb.com/images/media/meals/example.jpg', strSource: 'https://example.com/recipe' }] },
  'nasa-images': { collection: { href: 'http://images-api.nasa.gov/search?q=PIA12348', items: [{ href: 'https://images-assets.nasa.gov/image/PIA12348/collection.json', data: [{ nasa_id: 'PIA12348', title: 'Galaxy', description: 'A bounded description.', date_created: '2010-01-01T00:00:00Z', center: 'JPL', keywords: ['space'] }], links: [{ href: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg', rel: 'preview', render: 'image' }] }] } },
  'loc-photos': { results: [{ id: 'http://www.loc.gov/item/example/', title: 'The moon', date: '1900', contributor: ['Example'], description: ['A moon photograph.'], subject: ['moon'], location: ['space'], image_url: ['https://tile.loc.gov/image-services/iiif/example/full/pct:100/0/default.jpg'], url: 'https://www.loc.gov/item/example/' }], facets: [{ huge: true }] }
};

test('every image-bearing operation rewrites all allowlisted fields without leaking an upstream asset host', async () => {
  for (const [apiId, raw] of Object.entries(cases)) {
    const entry = getRegistryEntry(apiId);
    assert.ok(entry.assetPolicy.resolvedPaths.length > 0, `${apiId}:asset_policy_missing`);
    const data = prepareAssetData(apiId, raw);
    const candidates = collectAssetCandidates(entry, data);
    assert.ok(candidates.length > 0, `${apiId}:asset_candidate_missing`);
    for (const candidate of candidates) assert.equal(validateAssetUrl(candidate.resolvedUrl, entry.assetPolicy).href, new URL(candidate.resolvedUrl).href);
    let minted = 0;
    const rewritten = await rewriteAssetCandidates(data, candidates, () => `https://randomware.randomware.workers.dev/api/runtime/asset/signed-${minted++}`);
    const serialized = JSON.stringify(rewritten);
    assert.match(serialized, /https:\/\/randomware\.randomware\.workers\.dev\/api\/runtime\/asset\/signed-/i, `${apiId}:signed_asset_missing`);
    for (const candidate of candidates) {
      const upstreamHost = new URL(candidate.resolvedUrl).hostname;
      if (upstreamHost) assert.equal(serialized.includes(upstreamHost), false, `${apiId}:raw_asset_host_leaked`);
      const served = await fetchAsset({ target: candidate.resolvedUrl, policy: entry.assetPolicy, fetcher: async () => new Response(Buffer.from('image'), { headers: { 'content-type': 'image/png', 'content-length': '5' } }) });
      assert.match(served.contentType, /^image\//, `${apiId}:image_content_type_missing`);
    }
  }
});

test('Met adapter emits a stable fixed-field summary instead of provider-owned nested measurements', () => {
  const result = prepareAssetData('met-museum', { objectID: 436121, title: 'Wheat Field', artistDisplayName: 'Vincent van Gogh', measurements: [{ elementMeasurements: { Height: 10, Depth: 2 } }], primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/example.jpg' });
  assert.deepEqual(Object.keys(result).sort(), ['artistDisplayName', 'classification', 'country', 'creditLine', 'culture', 'department', 'dimensions', 'dynasty', 'isPublicDomain', 'medium', 'objectDate', 'objectID', 'objectName', 'objectURL', 'period', 'primaryImage', 'primaryImageSmall', 'repository', 'title'].sort());
  assert.equal(result.measurements, undefined);
  assert.equal(result.primaryImage, null);
  assert.equal(result.classification, null);
});

test('NASA and Library of Congress adapters expose only bounded summaries and fixture-bound image fields', () => {
  const nasa = prepareAssetData('nasa-images', cases['nasa-images']);
  assert.deepEqual(nasa, { items: [{ nasaId: 'PIA12348', title: 'Galaxy', description: 'A bounded description.', dateCreated: '2010-01-01T00:00:00Z', center: 'JPL', keywords: ['space'], imageUrl: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg' }] });
  assert.doesNotMatch(JSON.stringify(nasa), /http:\/\/images-api\.nasa\.gov|collection\.json/);
  const loc = prepareAssetData('loc-photos', cases['loc-photos']);
  assert.deepEqual(loc, { results: [{ id: 'http://www.loc.gov/item/example/', title: 'The moon', date: '1900', contributors: ['Example'], description: 'A moon photograph.', subjects: ['moon'], locations: ['space'], recordUrl: 'https://www.loc.gov/item/example/', imageUrl: 'https://tile.loc.gov/image-services/iiif/example/full/pct:100/0/default.jpg' }] });
  assert.equal(loc.facets, undefined);
});

test('asset validation rejects credentials, private hosts, non-HTTPS, and hosts outside the registry policy', () => {
  const policy = getRegistryEntry('dog-ceo').assetPolicy;
  assert.throws(() => validateAssetUrl('https://user:pass@images.dog.ceo/a.jpg', policy), /asset_credentials/);
  assert.throws(() => validateAssetUrl('https://127.0.0.1/a.jpg', policy), /asset_private_host/);
  assert.throws(() => validateAssetUrl('http://images.dog.ceo/a.jpg', policy), /asset_scheme/);
  assert.throws(() => validateAssetUrl('https://evil.example/a.jpg', policy), /asset_host_rejected/);
  assert.throws(() => validateAssetUrl('data:image/gif;base64,aW1hZ2U=', policy), /asset_scheme/);
});

test('ArtIC inline thumbnail is served through the same bounded image route without an upstream fetch', async () => {
  const policy = getRegistryEntry('artic').assetPolicy;
  const result = await fetchAsset({ target: 'data:image/gif;base64,aW1hZ2U=', policy, fetcher: async () => { throw new Error('unexpected_upstream_fetch'); } });
  assert.equal(result.contentType, 'image/gif');
  assert.equal(Buffer.from(await result.response.arrayBuffer()).toString(), 'image');
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
