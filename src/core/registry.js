const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const responseContracts = require('./response-contracts.generated');

const operation = (id, description, pathTemplate, fixturePath, timeoutMs = 4000, maxRawBytes = 200_000, cacheMs = 300_000) => ({
  id, description, method: 'GET', pathTemplate, fixturePath, adaptedFixturePath: `docs/api-candidates/adapted/${fixturePath}`, timeoutMs,
  paramsSchema: { type: 'object', additionalProperties: false },
  ...responseContracts[fixturePath],
  maxRawBytes, cacheMs, adapt: 'bounded-json'
});

const replayOperation = (id, description, pathTemplate, fixturePath, timeoutMs = 4000, maxRawBytes = 200_000) => operation(id, description, pathTemplate, fixturePath, timeoutMs, maxRawBytes, 0);

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
  themealdb: { allowedHosts: ['www.themealdb.com'], resolvedPaths: ['meals.*.strMealThumb'] },
  'nasa-images': { allowedHosts: ['images-assets.nasa.gov'], resolvedPaths: ['items.*.imageUrl'] },
  'loc-photos': { allowedHosts: ['tile.loc.gov'], resolvedPaths: ['results.*.imageUrl'] }
};

const mediaPolicies = Object.freeze({
  'radio-browser': { kind: 'radio-browser', allowedHosts: [] },
  librivox: { kind: 'librivox', allowedHosts: ['archive.org', '*.archive.org'] },
  'wikimedia-commons-audio': { kind: 'wikimedia-commons', allowedHosts: ['upload.wikimedia.org'] }
});

const rows = [
  ['deck-of-cards', 'Deck of Cards', 'games', 'https://deckofcardsapi.com/', 'https://deckofcardsapi.com/', ['deckofcardsapi.com'], replayOperation('draw', 'draw a card', '/api/deck/new/draw/?count=1', 'deck-of-cards.json')],
  ['poetrydb', 'PoetryDB', 'text', 'https://github.com/thundercomb/poetrydb', 'https://github.com/thundercomb/poetrydb', ['poetrydb.org'], replayOperation('random', 'get a poem', '/random', 'poetrydb.json')],
  ['datamuse', 'Datamuse', 'text', 'https://www.datamuse.com/api/', 'https://www.datamuse.com/api/', ['api.datamuse.com'], operation('words', 'find related words', '/words?rel_jja=quiet&max=5', 'datamuse.json')],
  ['artic', 'Art Institute of Chicago', 'visual', 'https://api.artic.edu/docs/', 'https://www.artic.edu/policies', ['api.artic.edu', 'www.artic.edu'], operation('artwork', 'get an artwork', '/api/v1/artworks/4?fields=id,title,image_id,thumbnail,artist_display,date_display', 'artic.json')],
  ['dog-ceo', 'Dog CEO', 'visual', 'https://dog.ceo/dog-api/about', 'https://dog.ceo/dog-api/about', ['dog.ceo', 'images.dog.ceo'], replayOperation('random', 'get a dog image', '/api/breeds/image/random', 'dog-ceo.json')],
  ['radio-browser', 'Radio Browser', 'audio', 'https://docs.radio-browser.info/', 'https://docs.radio-browser.info/', ['de1.api.radio-browser.info'], replayOperation('station', 'find a radio station', '/json/stations/search?limit=8&order=random&hidebroken=true', 'radio-browser-de1.json')],
  ['open-meteo', 'Open-Meteo', 'geo', 'https://open-meteo.com/en/docs', 'https://open-meteo.com/en/terms', ['api.open-meteo.com'], operation('forecast', 'get weather', '/v1/forecast?latitude=35.68&longitude=139.76&current=temperature_2m,weather_code', 'open-meteo.json')],
  ['frankfurter', 'Frankfurter', 'numbers', 'https://frankfurter.dev/', 'https://frankfurter.dev/', ['api.frankfurter.dev'], operation('rates', 'get exchange rates', '/v2/rate/USD/JPY', 'frankfurter-dev.json')],
  ['randomuser', 'RandomUser', 'identity', 'https://randomuser.me/documentation', 'https://randomuser.me/terms', ['randomuser.me'], replayOperation('person', 'get a fictional person', '/api/?inc=name,gender,nat,picture&results=1', 'randomuser.json')],
  ['wiki-onthisday', 'Wikipedia On This Day', 'history', 'https://www.mediawiki.org/wiki/API:On_this_day', 'https://www.mediawiki.org/wiki/API:REST_API/Policies', ['api.wikimedia.org'], operation('events', 'get an event from today', '/feed/v1/wikipedia/en/onthisday/events/07/18', 'wiki-onthisday.json', 4000, 512_000)],
  ['usgs-quakes', 'USGS Earthquakes', 'geo', 'https://earthquake.usgs.gov/fdsnws/event/1/', 'https://earthquake.usgs.gov/data/comcat/', ['earthquake.usgs.gov'], operation('recent', 'get recent earthquakes', '/fdsnws/event/1/query?format=geojson&limit=5&orderby=time-asc', 'usgs-quakes.json')],
  ['met-museum', 'Met Museum', 'visual', 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access', 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access', ['collectionapi.metmuseum.org'], operation('object', 'get a public-domain object', '/public/collection/v1/objects/436121', 'met-museum.json')],
  ['nager-date', 'Nager.Date', 'dates', 'https://github.com/nager/Nager.Date', 'https://github.com/nager/Nager.Date', ['date.nager.at'], operation('holidays', 'get public holidays', '/api/v3/PublicHolidays/2024/JP', 'nager-date.json')],
  ['tvmaze', 'TVMaze', 'culture', 'https://www.tvmaze.com/api', 'https://www.tvmaze.com/api', ['api.tvmaze.com'], operation('show', 'find a TV show', '/search/shows?q=space', 'tvmaze.json')],
  ['rickandmorty', 'Rick and Morty API', 'characters', 'https://rickandmortyapi.com/documentation', 'https://rickandmortyapi.com/about', ['rickandmortyapi.com'], operation('character', 'get a character', '/api/character/1', 'rickandmorty.json')],
  ['open-food-facts', 'Open Food Facts', 'food', 'https://openfoodfacts.github.io/openfoodfacts-server/api/', 'https://world.openfoodfacts.org/terms-of-use', ['world.openfoodfacts.org', 'images.openfoodfacts.org'], operation('product', 'get a product by barcode', '/api/v3/product/3017624010701.json?fields=code,product_name,brands,nutriscore_grade,image_url', 'open-food-facts.json')],
  ['librivox', 'LibriVox', 'books', 'https://librivox.org/api/info', 'https://librivox.org/pages/public-domain/', ['librivox.org', 'archive.org'], operation('book', 'get a public-domain audiobook', '/api/feed/audiobooks/?id=47&format=json&fields=id,title,authors,url_librivox,url_rss,url_zip_file', 'librivox.json', 10000)],
  ['themealdb', 'TheMealDB', 'food', 'https://www.themealdb.com/docs_api_guide.php', 'https://www.themealdb.com/terms_of_use.php', ['www.themealdb.com'], replayOperation('meal', 'get a meal', '/api/json/v1/1/random.php', 'themealdb.json')],
  ['nasa-images', 'NASA Image and Video Library', 'visual', 'https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf', 'https://www.nasa.gov/nasa-brand-center/images-and-media/', ['images-api.nasa.gov', 'images-assets.nasa.gov'], operation('search', 'find a NASA image', '/search?q=PIA12348&media_type=image', 'nasa-images.json')],
  ['loc-photos', 'Library of Congress Photos', 'visual', 'https://www.loc.gov/apis/json-and-yaml/', 'https://www.loc.gov/legal/', ['www.loc.gov', 'tile.loc.gov'], operation('search', 'find a Library of Congress photograph', '/photos/?q=moon&fo=json&c=2', 'loc-photos.json', 6000)],
  ['wikimedia-commons-audio', 'Wikimedia Commons Audio', 'audio', 'https://www.mediawiki.org/wiki/API:Imageinfo', 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use', ['commons.wikimedia.org'], operation('recording', 'find a bounded field recording', '/w/api.php?action=query&generator=search&gsrsearch=field%20recording%20filetype%3Aaudio%20filesize%3A%3E100&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiextmetadatafilter=LicenseShortName&format=json&formatversion=2', 'wikimedia-commons-audio.json', 5000)]
];

const symbols = Object.freeze({
  'dog-ceo': '🐕', 'open-meteo': '🌤️', frankfurter: '💱', 'usgs-quakes': '🌋', rickandmorty: '🛸',
  'deck-of-cards': '🃏', datamuse: '🔤', randomuser: '👤', 'open-food-facts': '🥫', 'radio-browser': '📻',
  librivox: '🎧', artic: '🖼️', 'met-museum': '🏛️', tvmaze: '📺', poetrydb: '📜',
  'wiki-onthisday': '📅', 'nager-date': '🗓️', themealdb: '🍲', 'nasa-images': '🪐', 'loc-photos': '📚',
  'wikimedia-commons-audio': '🔔'
});

const registry = deepFreeze(rows.map(([id, name, category, docsUrl, termsUrl, upstreamHosts, op]) => ({
  id, name, symbol: symbols[id], category, capability: op.description, semanticTags: [category, 'public', 'bounded'], sensory: ['visual', 'audio', 'geo'].includes(category) ? [category] : [], selectionEnabled: id !== 'librivox',
  docsUrl, termsUrl, attribution: id === 'wikimedia-commons-audio'
    ? { text: 'Credit Wikimedia Commons and display result.data.recording.license', url: 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia', license: 'file-specific LicenseShortName' }
    : { text: `${name} attribution`, url: docsUrl, license: 'provider terms' },
  upstreamHosts, assetPolicy: { ...(assetPolicies[id] || { allowedHosts: [], resolvedPaths: [] }), variableMediaHost: category === 'audio' }, mediaPolicy: mediaPolicies[id] || null,
  fixturePath: `docs/api-candidates/samples/${op.fixturePath}`, defaultWeight: 1, dailyBudget: id === 'loc-photos' ? 240 : 250,
  operations: [op]
})));

function getRegistryEntry(id) {
  const entry = registry.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('unknown_registry_entry');
  return entry;
}

module.exports = { registry, getRegistryEntry, deepFreeze };
