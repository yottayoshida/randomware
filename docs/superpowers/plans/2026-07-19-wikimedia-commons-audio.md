# Wikimedia Commons Audio Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep LibriVox runtime-compatible but permanently out of spins, and add bounded Wikimedia Commons field-recording audio as the selectable replacement.

**Architecture:** Add one registry-level selection flag consumed only by selector and live-health scheduling, leaving broker lookup available for frozen creations. Add one fixed Commons search operation whose adapter rejects files over 8 MiB and non-`upload.wikimedia.org` media before the existing signed `/media` pipeline mints a URL.

**Tech Stack:** CommonJS, Node test runner, Cloudflare Workers/D1, Wrangler, Playwright Chromium.

## Global Constraints

- Do not delete the LibriVox registry entry or alter stored artifacts.
- Commons search is keyless, fixed-parameter, `GET`, `maxRawBytes: 200_000`, and `paramsSchema.additionalProperties: false`.
- Use `filesize:>100`; do not use the rejected `100..2000` range form.
- Sign only audio candidates at or below 8 MiB and hosted by `upload.wikimedia.org`.
- Preserve the existing 5-minute, 8 MiB, two-redirect media containment limits.
- Perform one bounded raw-fixture capture; do not spray a failing upstream.

---

### Task 1: Selection contract

**Files:**
- Modify: `src/core/registry.js`
- Modify: `src/core/selection.js`
- Test: `tests/unit/registry.test.js`
- Test: `tests/unit/selection.test.js`

**Interfaces:**
- Consumes: registry entries and `selectApis({ seed, registry, history, unhealthy })`.
- Produces: immutable `selectionEnabled: false` on LibriVox; selectors filter only entries whose flag is not false.

- [ ] Add failing assertions that LibriVox remains resolvable but is excluded across deterministic selector seeds.
- [ ] Run the focused tests and confirm the assertions fail for the old selector.
- [ ] Add the registry flag and selector filter.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Commons fixture, adapter, and response contract

**Files:**
- Modify: `src/core/registry.js`
- Modify: `src/core/broker.js`
- Modify: `src/core/media.js`
- Modify: `src/server.js`
- Create: `docs/api-candidates/samples/wikimedia-commons-audio.json`
- Create: `docs/api-candidates/adapted/wikimedia-commons-audio.json`
- Regenerate: `src/core/response-contracts.generated.js`
- Test: `tests/unit/registry.test.js`
- Test: `tests/unit/broker.test.js`
- Test: `tests/unit/media.test.js`

**Interfaces:**
- Consumes: MediaWiki `query.pages[].imageinfo[0]` objects and the existing `issueMediaUrl` flow.
- Produces: `{ recording: { title, size, mime, license }, mediaUrl }`, with no raw upstream URL.

- [ ] Add failing registry and adapter tests for the fixed query, ≤8 MiB filter, bounded license, exact host, and signed URL.
- [ ] Run focused tests and confirm RED.
- [ ] Capture one bounded raw response from the fixed Commons query.
- [ ] Implement the adapter and `wikimedia-commons` media-host policy.
- [ ] Generate the adapted golden and response contracts.
- [ ] Re-run focused tests and `npm run registry:verify`.

### Task 3: Health, deployed gates, and evidence

**Files:**
- Modify: `src/core/health.js`
- Modify: `scripts/registry-live.js`
- Modify: `scripts/test-synthetic-deployed.js`
- Modify: `scripts/test-deployed.js`
- Modify: `scripts/browser-acceptance.py`
- Modify: `docs/api-candidates/report.md`
- Modify: `docs/BUILD_LOG.md`
- Modify count references where the launch registry is described.

**Interfaces:**
- Consumes: deployed Commons broker result and signed `/media` URL.
- Produces: selector exclusion proof, HTTP audio proof, and sandboxed `/run` Chromium playback proof.

- [ ] Add failing deployed/Chromium gate assertions for Commons and selector coverage.
- [ ] Skip disabled entries in live health without removing compatibility metadata.
- [ ] Record LibriVox evidence and Commons round-4 evidence.
- [ ] Run `npm run acceptance:machine` and local Chromium acceptance.
- [ ] Deploy with Wrangler, run the full synthetic/deployed gate, then run `/run` Chromium playback with a Commons selection.
- [ ] Commit and push only after fresh verification output is green.
