const test = require('node:test');
const assert = require('node:assert/strict');
const { selectApis, selectStyle } = require('../../src/core/selection');
const { STYLE_DECK } = require('../../src/core/style-deck');

const registry = [
  { id: 'deck', name: 'Deck', category: 'games', sensory: [] },
  { id: 'poetry', name: 'Poetry', category: 'text', sensory: [] },
  { id: 'weather', name: 'Weather', category: 'geo', sensory: ['geo'] },
  { id: 'radio', name: 'Radio', category: 'audio', sensory: ['audio'] },
  { id: 'art', name: 'Art', category: 'visual', sensory: ['visual'] }
];

test('selector returns unique healthy APIs and only uses the deterministic three-way band', () => {
  const result = selectApis({ seed: 'seed-1', registry, history: [] });
  assert.ok(result.length === 2 || result.length === 3);
  assert.equal(new Set(result.map((api) => api.id)).size, result.length);
  assert.ok(result.some((api) => api.sensory.length > 0));
});

test('selector excludes exact recent combinations and unhealthy entries', () => {
  const result = selectApis({
    seed: 'seed-2',
    registry,
    history: [['deck', 'poetry']],
    unhealthy: new Set(['radio'])
  });
  assert.notDeepEqual(result.map((api) => api.id).sort(), ['deck', 'poetry']);
  assert.ok(!result.some((api) => api.id === 'radio'));
});

test('selector remains near-uniform while preserving the three-way band', () => {
  const expanded = Array.from({ length: 18 }, (_, index) => ({ id: `api-${index}`, name: `API ${index}`, category: index % 3 === 0 ? 'visual' : `category-${index}`, sensory: index % 3 === 0 ? ['visual'] : [] }));
  const counts = Object.fromEntries(expanded.map((api) => [api.id, 0])); let three = 0;
  for (let index = 0; index < 5000; index += 1) { const result = selectApis({ seed: String(index), registry: expanded }); three += result.length === 3 ? 1 : 0; result.forEach((api) => { counts[api.id] += 1; }); }
  const values = Object.values(counts);
  assert.ok(three / 5000 > 0.14 && three / 5000 < 0.16);
  assert.ok(Math.max(...values) / Math.min(...values) < 2.5);
});

test('style deck has eight immutable owner-curated cartridges', () => {
  assert.equal(STYLE_DECK.length, 8);
  assert.deepEqual(STYLE_DECK.map((style) => style.id), ['paper-certificate', 'video-game-hud', 'flash-app', 'board-game', 'gacha-app', 'retro-90s-pixel', 'teletext', 'vhs-jacket']);
  for (const style of STYLE_DECK) {
    assert.equal(Object.isFrozen(style), true);
    for (const field of ['name', 'symbol', 'palette', 'typography', 'motion', 'era', 'avoid']) assert.ok(style[field]);
  }
});

test('style draw is deterministic and avoids the three most recent cartridges', () => {
  const first = selectStyle({ seed: 'style-seed', history: [] });
  assert.equal(selectStyle({ seed: 'style-seed', history: [] }).id, first.id);
  const recent = STYLE_DECK.slice(0, 3).map((style) => style.id);
  const selected = selectStyle({ seed: 'style-history-seed', history: recent });
  assert.ok(!recent.includes(selected.id));
});
