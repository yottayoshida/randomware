const crypto = require('node:crypto');
const { STYLE_DECK } = require('./style-deck');

function unit(seed, label) {
  const digest = crypto.createHash('sha256').update(`${seed}:${label}`).digest();
  return digest.readUInt32BE(0) / 0x100000000;
}

function canonical(ids) {
  return [...ids].sort().join('|');
}

function distance(left, right) {
  const leftTags = new Set([left.category, ...(left.sensory || [])]);
  const rightTags = new Set([right.category, ...(right.sensory || [])]);
  const union = new Set([...leftTags, ...rightTags]);
  const intersection = [...leftTags].filter((tag) => rightTags.has(tag));
  return 1 - intersection.length / Math.max(union.size, 1);
}

function combinations(items, size) {
  const output = [];
  function visit(start, picked) {
    if (picked.length === size) {
      output.push(picked.slice());
      return;
    }
    for (let index = start; index <= items.length - (size - picked.length); index += 1) {
      visit(index + 1, picked.concat(items[index]));
    }
  }
  visit(0, []);
  return output;
}

function selectApis({ seed, registry, history = [], unhealthy = new Set() }) {
  const eligible = registry.filter((api) => api.selectionEnabled !== false && !unhealthy.has(api.id));
  const recent = new Set(history.slice(-3).map(canonical));
  const arity = unit(seed, 'arity') < 0.15 ? 3 : 2;
  const candidates = combinations(eligible, arity).filter((set) => {
    const ids = set.map((api) => api.id);
    if (recent.has(canonical(ids))) return false;
    if (new Set(set.map((api) => api.category)).size === 1) return false;
    return set.some((api) => (api.sensory || []).length > 0);
  });
  if (!candidates.length) throw new Error('no_healthy_combination');
  const ranked = candidates.map((set) => {
    let pairDistance = 0;
    let pairs = 0;
    for (let i = 0; i < set.length; i += 1) {
      for (let j = i + 1; j < set.length; j += 1) {
        pairDistance += distance(set[i], set[j]);
        pairs += 1;
      }
    }
    const score = pairDistance / Math.max(pairs, 1);
    const sensoryCount = set.filter((api) => (api.sensory || []).length > 0).length;
    return { set, score, sensoryCount, tie: unit(seed, canonical(set.map((api) => api.id))) };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie);
  const totalWeight = ranked.reduce((sum, candidate) => sum + (0.3 + candidate.score * 0.2) / (1 + 0.75 * (candidate.sensoryCount - 1)), 0);
  let cursor = unit(seed, 'pick') * totalWeight;
  for (const candidate of ranked) {
    cursor -= (0.3 + candidate.score * 0.2) / (1 + 0.75 * (candidate.sensoryCount - 1));
    if (cursor <= 0) return candidate.set;
  }
  return ranked[ranked.length - 1].set;
}

function selectStyle({ seed, history = [] }) {
  const recent = new Set((Array.isArray(history) ? history : []).slice(-3));
  const eligible = STYLE_DECK.filter((style) => !recent.has(style.id));
  const pool = eligible.length ? eligible : STYLE_DECK;
  return pool[Math.floor(unit(seed, 'style') * pool.length) % pool.length];
}

module.exports = { selectApis, selectStyle, canonical };
