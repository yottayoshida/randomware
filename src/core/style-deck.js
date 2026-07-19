function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const STYLE_COMMON_RULE = 'Use inline CSS only; use no external assets, fonts, stylesheets, scripts, SVG, or nested frames. Every style remains subject to the unchanged Randomware broker, artifact validator, sandbox, CSP, and 390 CSS-pixel usability contract.';

const STYLE_DECK = deepFreeze([
  { id: 'paper-certificate', name: 'Paper Certificate', symbol: '📜', palette: 'warm paper, carbon ink, faded red seal, ruled blue lines', typography: 'dot-matrix monospace, registry labels, stamped capitals', motion: 'perforation tear, stamp impact, line-feed crawl', era: 'municipal certificate printer and public records counter', avoid: 'Do not make a passive report; controls must visibly alter the certified result.' },
  { id: 'video-game-hud', name: 'Video Game HUD', symbol: '🎮', palette: 'electric cyan, warning amber, health green, night-sky panels', typography: 'condensed console monospace, score numerals, mission labels', motion: 'achievement pop, meter drain, minimap pulse, targeting sweep', era: 'late-console tactical HUD and arcade mission overlay', avoid: 'Do not reduce the APIs to decorative gauges or an unreadable overlay pile.' },
  { id: 'flash-app', name: 'Flash App', symbol: '💿', palette: 'candy gradients, chrome silver, ultraviolet, glossy lime highlights', typography: 'chunky rounded vector lettering, tiny bitmap utility labels', motion: 'elastic tween, bevel press, splash transition, orbiting sticker', era: '2000s browser portal and experimental Flash microsite', avoid: 'No external media or plugin mimicry; keep controls obvious and keyboard usable.' },
  { id: 'board-game', name: 'Board Game', symbol: '🎲', palette: 'painted cardboard, felt green, pawn red, rulebook cream', typography: 'box-title slab, card monospace, small-caps rule text', motion: 'die tumble, tile flip, card deal, pawn step', era: 'family tabletop box with punched tokens and folded board', avoid: 'Do not create a static board illustration; every API must change playable rules.' },
  { id: 'gacha-app', name: 'Gacha App', symbol: '✨', palette: 'jewel gradients, rarity gold, midnight violet, holographic cyan', typography: 'bold mobile display face, rarity stars, compact result labels', motion: 'capsule shake, reveal burst, rarity shimmer, banner snap', era: 'mobile character summon screen and limited-event banner', avoid: 'No manipulative purchases, fake currency, timers, or dark patterns; one honest free interaction.' },
  { id: 'retro-90s-pixel', name: 'Retro 90s Pixel', symbol: '👾', palette: 'strict four-color palette, CRT black, phosphor green, cartridge magenta', typography: 'pixel monospace, tile-map labels, chunky score digits', motion: 'sprite walk, scanline scroll, palette flash, stepped parallax', era: '90s handheld and 16-bit cartridge game', avoid: 'Keep text legible at 390px; scanlines and dithering must never bury controls.' },
  { id: 'teletext', name: 'Teletext Dispatch', symbol: '📟', palette: 'black field, primary red, green, blue, yellow and white blocks', typography: 'fixed character grid, block mosaic glyphs, page-number labels', motion: 'page snap, row reveal, cursor blink, signal reacquisition', era: 'Ceefax and broadcast text information service', avoid: 'Do not become a passive information page; preserve interaction and clear focus states.' },
  { id: 'vhs-jacket', name: 'VHS Jacket', symbol: '📼', palette: 'sun-faded cyan, rental red, tracking white, magnetic-tape black', typography: 'oversized video-box display, catalog monospace, sticker labels', motion: 'tracking jitter, pause stripe, sleeve slide, rewind counter', era: '1980s–90s rental cassette package and worn playback deck', avoid: 'Noise must be decorative only; never obscure content, controls, attribution, or errors.' }
]);

const STYLE_IDS = Object.freeze(STYLE_DECK.map((style) => style.id));
const styleById = new Map(STYLE_DECK.map((style) => [style.id, style]));

function getStyle(id) {
  const style = styleById.get(id);
  if (!style) throw new Error('unknown_style');
  return style;
}

module.exports = { STYLE_COMMON_RULE, STYLE_DECK, STYLE_IDS, getStyle, deepFreeze };
