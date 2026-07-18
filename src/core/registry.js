const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const operation = (id, description, pathTemplate, fixturePath, timeoutMs = 4000) => ({
  id, description, method: 'GET', pathTemplate, fixturePath, adaptedFixturePath: `docs/api-candidates/adapted/${fixturePath}`, timeoutMs,
  paramsSchema: { type: 'object', additionalProperties: false }, outputSchema: { type: 'object' },
  maxRawBytes: 200_000, cacheTtlSeconds: 30, adapt: 'bounded-json'
});

const assetPolicies = {
  'deck-of-cards': { allowedHosts: ['deckofcardsapi.com', 'images.deckofcards.io'], resolvedPaths: ['cards.*.image', 'cards.*.images.png', 'cards.*.images.svg'] },
  artic: { allowedHosts: ['www.artic.edu'], resolvedPaths: ['data.image_url', 'data.*.image_url'], allowDataImages: true },
  'dog-ceo': { allowedHosts: ['images.dog.ceo'], resolvedPaths: ['message'] },
  randomuser: { allowedHosts: ['randomuser.me'], resolvedPaths: ['results.*.picture.large', 'results.*.picture.medium', 'results.*.picture.thumbnail'] },
  'wiki-onthisday': { allowedHosts: ['upload.wikimedia.org'], resolvedPaths: ['selected.*.pages.*.thumbnail.source', 'selected.*.pages.*.originalimage.source'] },
  'met-museum': { allowedHosts: ['images.metmuseum.org'], resolvedPaths: ['primaryImage', 'primaryImageSmall', 'additionalImages.*'] },
  tvmaze: { allowedHosts: ['static.tvmaze.com'], resolvedPaths: ['*.show.image.medium', '*.show.image.original'] },
  rickandmorty: { allowedHosts: ['rickandmortyapi.com'], resolvedPaths: ['image'] },
  'open-food-facts': { allowedHosts: ['images.openfoodfacts.org'], resolvedPaths: ['product.image_url'] },
  themealdb: { allowedHosts: ['www.themealdb.com'], resolvedPaths: ['meals.*.strMealThumb'] }
};

const rows = [
  ['deck-of-cards', 'Deck of Cards', 'games', 'https://deckofcardsapi.com/', 'https://deckofcardsapi.com/', ['deckofcardsapi.com'], operation('draw', 'draw a card', '/api/deck/new/draw/?count=1', 'deck-of-cards.json')],
  ['poetrydb', 'PoetryDB', 'text', 'https://github.com/thundercomb/poetrydb', 'https://github.com/thundercomb/poetrydb', ['poetrydb.org'], operation('random', 'get a poem', '/random', 'poetrydb.json')],
  ['datamuse', 'Datamuse', 'text', 'https://www.datamuse.com/api/', 'https://www.datamuse.com/api/', ['api.datamuse.com'], operation('words', 'find related words', '/words?rel_jja=quiet&max=5', 'datamuse.json')],
  ['artic', 'Art Institute of Chicago', 'visual', 'https://api.artic.edu/docs/', 'https://www.artic.edu/policies', ['api.artic.edu', 'www.artic.edu'], operation('artwork', 'get an artwork', '/api/v1/artworks/4?fields=id,title,image_id,thumbnail,artist_display,date_display', 'artic.json')],
  ['dog-ceo', 'Dog CEO', 'visual', 'https://dog.ceo/dog-api/about', 'https://dog.ceo/dog-api/about', ['dog.ceo', 'images.dog.ceo'], operation('random', 'get a dog image', '/api/breeds/image/random', 'dog-ceo.json')],
  ['radio-browser', 'Radio Browser', 'audio', 'https://docs.radio-browser.info/', 'https://docs.radio-browser.info/', ['de1.api.radio-browser.info'], operation('station', 'find a radio station', '/json/stations/search?limit=8&order=random&hidebroken=true', 'radio-browser-de1.json')],
  ['open-meteo', 'Open-Meteo', 'geo', 'https://open-meteo.com/en/docs', 'https://open-meteo.com/en/terms', ['api.open-meteo.com'], operation('forecast', 'get weather', '/v1/forecast?latitude=35.68&longitude=139.76&current=temperature_2m,weather_code', 'open-meteo.json')],
  ['frankfurter', 'Frankfurter', 'numbers', 'https://frankfurter.dev/', 'https://frankfurter.dev/', ['api.frankfurter.dev'], operation('rates', 'get exchange rates', '/v2/rate/USD/JPY', 'frankfurter-dev.json')],
  ['randomuser', 'RandomUser', 'identity', 'https://randomuser.me/documentation', 'https://randomuser.me/terms', ['randomuser.me'], operation('person', 'get a fictional person', '/api/?inc=name,gender,nat,picture&results=1', 'randomuser.json')],
  ['wiki-onthisday', 'Wikipedia On This Day', 'history', 'https://www.mediawiki.org/wiki/API:On_this_day', 'https://www.mediawiki.org/wiki/API:REST_API/Policies', ['api.wikimedia.org'], operation('events', 'get an event from today', '/feed/onthisday/2024/07/18', 'wiki-onthisday.json')],
  ['usgs-quakes', 'USGS Earthquakes', 'geo', 'https://earthquake.usgs.gov/fdsnws/event/1/', 'https://earthquake.usgs.gov/data/comcat/', ['earthquake.usgs.gov'], operation('recent', 'get recent earthquakes', '/fdsnws/event/1/query?format=geojson&limit=5&orderby=time-asc', 'usgs-quakes.json')],
  ['met-museum', 'Met Museum', 'visual', 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access', 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access', ['collectionapi.metmuseum.org'], operation('object', 'get a public-domain object', '/public/objects/1', 'met-museum.json')],
  ['nager-date', 'Nager.Date', 'dates', 'https://github.com/nager/Nager.Date', 'https://github.com/nager/Nager.Date', ['date.nager.at'], operation('holidays', 'get public holidays', '/api/v3/PublicHolidays/2024/JP', 'nager-date.json')],
  ['tvmaze', 'TVMaze', 'culture', 'https://www.tvmaze.com/api', 'https://www.tvmaze.com/api', ['api.tvmaze.com'], operation('show', 'find a TV show', '/search/shows?q=space', 'tvmaze.json')],
  ['rickandmorty', 'Rick and Morty API', 'characters', 'https://rickandmortyapi.com/documentation', 'https://rickandmortyapi.com/about', ['rickandmortyapi.com'], operation('character', 'get a character', '/api/character/1', 'rickandmorty.json')],
  ['open-food-facts', 'Open Food Facts', 'food', 'https://openfoodfacts.github.io/openfoodfacts-server/api/', 'https://world.openfoodfacts.org/terms-of-use', ['world.openfoodfacts.org', 'images.openfoodfacts.org'], operation('product', 'get a product by barcode', '/api/v3/product/3017624010701.json?fields=code,product_name,brands,nutriscore_grade,image_url', 'open-food-facts.json')],
  ['librivox', 'LibriVox', 'books', 'https://librivox.org/api/info', 'https://librivox.org/pages/public-domain/', ['librivox.org', 'archive.org'], operation('book', 'get a public-domain audiobook', '/api/feed/audiobooks/?id=47&format=json&fields=id,title,authors,url_librivox,url_rss,url_zip_file', 'librivox.json', 6000)],
  ['themealdb', 'TheMealDB', 'food', 'https://www.themealdb.com/docs_api_guide.php', 'https://www.themealdb.com/terms_of_use.php', ['www.themealdb.com'], operation('meal', 'get a meal', '/api/json/v1/1/random.php', 'themealdb.json')]
];

const registry = deepFreeze(rows.map(([id, name, category, docsUrl, termsUrl, upstreamHosts, op]) => ({
  id, name, category, capability: op.description, semanticTags: [category, 'public', 'bounded'], sensory: ['visual', 'audio', 'geo'].includes(category) ? [category] : [],
  docsUrl, termsUrl, attribution: { text: `${name} attribution`, url: docsUrl, license: 'provider terms' },
  upstreamHosts, assetPolicy: { ...(assetPolicies[id] || { allowedHosts: [], resolvedPaths: [] }), variableMediaHost: category === 'audio' },
  fixturePath: `docs/api-candidates/samples/${op.fixturePath}`, defaultWeight: 1, dailyBudget: 250,
  operations: [op]
})));

function getRegistryEntry(id) {
  const entry = registry.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('unknown_registry_entry');
  return entry;
}

module.exports = { registry, getRegistryEntry, deepFreeze };
