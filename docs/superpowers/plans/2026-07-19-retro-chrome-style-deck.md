# Retro Chrome and Style Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved retro-OS/paper companion UI and a server-enforced eight-entry aesthetic draw for every new run.

**Architecture:** A deep-frozen style deck and deterministic selector feed run state, generated schemas, prompt surfaces, widget state, and paper receipts. Existing presentation functions remain server-rendered; broker, containment, and stored HTML stay unchanged.

**Tech Stack:** Dependency-free Node.js, Cloudflare Workers/D1 metadata JSON, MCP Apps SDK HTML resource, server-rendered HTML/CSS, Node test runner, Playwright Chromium.

## Global Constraints

- Preserve broker, capability, sandbox, generated `/run` CSP, and stored artifacts.
- Keep deadpan English copy and honest, non-percent progress.
- Use only CSS animation with `prefers-reduced-motion` support.
- Use the exact owner color tokens and monospace system stack.
- Deploy only after `acceptance:machine` and deployed gates pass.

### Task 1: Style deck and deterministic selection

- [ ] Add failing unit tests for eight frozen entries, deterministic draw, and recent-three avoidance.
- [ ] Add `src/core/style-deck.js` and export `selectStyle` from selection.
- [ ] Run the targeted selection tests green.

### Task 2: Run persistence and concept contract

- [ ] Add failing tests for `styleId` in in-memory/D1 run state, schema enum, exact-match validation, and structured bad-enum errors.
- [ ] Thread `styleId` and `styleHistory` through HTTP/MCP spin, summaries, stores, and validators.
- [ ] Run store, concept, MCP, integration, and D1 tests green.

### Task 3: Prompt and keeper projection

- [ ] Add failing prompt-fidelity and keeper receipt tests for every selected style token and common containment statement.
- [ ] Add the deck to the shared manifest and selected style to concept/code/widget/repair prompts and keeper output.
- [ ] Update synthetic construction to derive `styleId` from visible run/schema state; run targeted tests green.

### Task 4: Widget retro-OS surface

- [ ] Add failing widget source and Chromium assertions for title bar, stepper states, style cartridge, lamp bank, guidance, status bar, build telemetry, deceased panel, and reduced motion.
- [ ] Rework widget HTML/CSS/JS while preserving follow-up fallback, state persistence, polling, sequential reveal, embed, and link-out.
- [ ] Run widget syntax/unit and Chromium checks green.

### Task 5: Paper companion pages

- [ ] Add failing presentation/browser assertions for index hero, paper tokens, `/c` perforation/stamp/style/API chips, autopsy styling, integrated navigation, and iframe position.
- [ ] Update presentation HTML, external CSS, and index same-origin frame CSP.
- [ ] Run presentation, integration, containment, and Chromium checks green.

### Task 6: Full verification and deployment

- [ ] Update `BUILD_LOG.md` with scope, evidence, known provider skips, and owner-transcribed meter state only.
- [ ] Run `acceptance:machine`, commit, push `main`, and deploy with Wrangler.
- [ ] Run the deployed e2e once, record Worker version and results, and report that the ChatGPT connector must be refreshed/recreated.

