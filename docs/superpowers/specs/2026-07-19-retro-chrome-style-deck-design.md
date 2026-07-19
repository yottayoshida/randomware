# Retro Chrome and Style Deck Design

## Status

Owner-approved implementation contract, transcribed 2026-07-19. The owner-provided design board and directive are the approval source; no product scope is renegotiated here.

## Boundaries

- Change only the MCP widget template, companion presentation pages and CSS, registry display data, run/style selection, concept/style validation, prompt projection, keeper display, and their tests.
- Do not change broker mediation, capability quotas, sandbox/CSP containment of generated artifacts, or stored artifact HTML.
- Existing artifacts remain immutable. Style applies to newly spun runs and newly generated concepts.

## Style architecture

`src/core/style-deck.js` owns eight deep-frozen entries: paper certificate, video-game HUD, Flash app, board game, gacha app, 90s pixel, teletext, and VHS jacket. Each entry carries an ID, display name, emoji, and bounded palette, typography, motion, era, and caution vocabulary.

`selectStyle(seed, history)` hashes the same spin seed under an independent `style` namespace and excludes up to the three most recent style IDs when alternatives exist. Widget state preserves that history and supplies it through the typed `spin_apis.styleHistory` field. Every run stores `styleId`; tool/status summaries also expose the resolved style entry.

`submit_concept.styleId` is required, enumerated from the deck, and must exactly match the run draw. The full deck is projected into `RANDOMWARE_CONTRACT_JSON`; the selected entry plus the common inline-CSS/no-external-assets/containment statement is projected into concept acceptance, widget build, code, and repair guidance. Synthetic payload construction uses only deployed schemas and result/prompt context.

## Presentation architecture

The widget becomes one 390 px retro-OS window using the owner tokens, stepper, stepped reel motion, lamp bank, permanent guidance, status bar, honest build telemetry, failure panel, style cartridge, and existing fallback/embed/state behavior.

Companion pages use paper/document tokens. `/c` renders a perforated specimen record, revision/status stamp, style receipt, API chips, document-themed autopsy surfaces, integrated navigation, then the unchanged generated iframe. `/` keeps the judge bridge, adds a paper masthead, embeds the first eligible completed curated specimen in a teal machine window, and follows with compact curated cards.

The index CSP gains only `frame-src 'self'` for its same-origin hero. Generated `/run` containment remains unchanged.

## Acceptance

- Unit/integration tests cover deterministic style selection, recent-style avoidance, deep freeze, schema enum, exact-match rejection, D1/in-memory persistence, prompt fidelity, keeper and companion receipts.
- Chromium covers reel stop/style cartridge, truthful build telemetry, deceased panel/actions, paper/stamp `/c`, and index hero iframe.
- Deployed e2e validates the new widget markers, absolute companion behavior, style result, and structured rejection of an invalid `styleId` enum.

