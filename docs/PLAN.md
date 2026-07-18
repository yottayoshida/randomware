# Randomware Implementation Plan

> **For the single Codex `/goal` worker:** execute this plan in order in the current repository and current session. Use test-driven development for behavior, keep commits milestone-scoped, and do not start a later milestone until the current milestone's Must done-criteria pass. Do not delegate the core implementation to another session.

**Goal:** Ship the PRD-defined ChatGPT app and zero-setup companion showcase, safely run model-generated single-page apps against real mediated APIs, deploy it publicly at zero incremental hosting cost, and prepare every submission artifact.

**Architecture:** A stateless Apps SDK MCP server, React widget, companion site, D1 persistence, operation-level API broker, and opaque-origin generated-app sandbox run in one Cloudflare Worker deployment. The player's ChatGPT model creates concepts and full HTML through schema-bound tool calls; Randomware has no owner model key.

**Stack:** TypeScript, Node.js 22, npm workspaces, React 19, Vite, Cloudflare Workers/D1/Static Assets/Cache/Cron, MCP TypeScript SDK and ext-apps, Zod, parse5, acorn, Vitest, Playwright.

## Global execution rules

- Read [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ACCEPTANCE.md](ACCEPTANCE.md), [BUDGET.md](BUDGET.md), and [GOAL.md](GOAL.md) before editing code.
- Run `git status --short --branch` before each milestone. Preserve unrelated human changes and never rewrite competition history.
- At every budget checkpoint, record both Codex Settings > Usage meters in [BUDGET.md](BUDGET.md) and the milestone event in [BUILD_LOG.md](BUILD_LOG.md).
- Use npm and commit `package-lock.json`. Do not introduce another package manager.
- Write a failing unit/integration/browser test before each behavior. Keep implementation files responsibility-focused as defined in `ARCHITECTURE.md` §12.
- Do not implement Should work until all earlier Must done-criteria pass. Do not implement Could work in this goal.
- Do not enable paid hosting, auto top-up, an OpenAI API key, an owner model key, arbitrary APIs, accounts, payments, or multi-file generation.
- Every generated-app request must use the broker even in the vertical slice. Never temporarily run generated code in the widget or owner page realm.
- Stop at an architecture gate that requires owner approval. Do not silently choose a scope-changing fallback.

## Milestone 0 — Mandatory feasibility spike

### Scope

Prove the five gates in `ARCHITECTURE.md` §13 before committing to the production implementation. Spike code lives under `spikes/apps-sdk/` during the milestone and is removed before the milestone commit; the evidence stays in `docs/BUILD_LOG.md`. The spike may use three diagnostic MCP tools and one diagnostic widget, but it must not become product code.

### Work

1. Create the smallest TypeScript MCP server/widget that can echo an artifact's UTF-8 byte count and SHA-256.
2. In a real ChatGPT developer-mode conversation, send deterministic single-file artifacts of exactly 10 KiB, 25 KiB, and 40 KiB as tool arguments. Compare local and received hashes.
3. In the diagnostic widget only, declare representative `connectDomains` for Datamuse, Open-Meteo, and Radio Browser. Record browser console/network results. Production does not retain these domains.
4. Play a Radio Browser stream and an iTunes preview in the widget; repeat in an opaque sandbox nested inside the companion-origin frame. Do not cache the iTunes preview.
5. Serve a companion test page from a Cloudflare preview origin, declare it in `frameDomains`, and test exact `frame-ancestors` values. Separately prove `window.openai.openExternal` link-out.
6. Run the production-shaped parse5/acorn validation and D1 write on a 40 KiB artifact at least 20 times on Workers Free. Record CPU-limit and latency evidence.
7. Remove `spikes/apps-sdk/`, record exact results and decisions in `BUILD_LOG.md`, and update the architecture only if a measured result selects an already-documented fallback.

### Verification commands

```bash
npm --prefix spikes/apps-sdk ci
npm --prefix spikes/apps-sdk run build
npm --prefix spikes/apps-sdk run hashes
npm --prefix spikes/apps-sdk run cloudflare -- --runs=20 --bytes=40960
test ! -d spikes/apps-sdk
git diff --check
```

Expected: all three hash comparisons match; 20/20 Worker validations complete without a repeatable CPU-limit error; the spike directory is absent from the intended commit. Real ChatGPT, CSP, audio, link, and frame evidence is manual and must be pasted into `BUILD_LOG.md` with date, browser, ChatGPT client, and outcome.

### Done-criteria

- Full 10/25/40 KiB artifacts survive one tool call each byte-for-byte.
- Link-out works.
- Direct widget CSP, audio in at least one permitted surface, and nested-frame results are recorded, including failures.
- Cloudflare Free is accepted only after the 20-run CPU check.
- If artifact transport or Cloudflare hosting fails its hard gate, stop and ask the owner; do not continue to Milestone 1.
- Commit: `docs: record Apps SDK feasibility decisions`.

## Milestone 1 — Safe vertical slice: spin → concept → generate → run

### Scope

Build the thinnest complete Must path with three APIs: Deck of Cards, PoetryDB, and Open-Meteo. Use link-out, the opaque sandbox, a minimal operation broker, D1 persistence, one widget, one creation page, and initial static validation. This milestone proves real user's-model generation; it does not use a template or owner API key.

### Files and boundaries

- Create the root npm workspace/tooling files and the directory layout from `ARCHITECTURE.md` §12.
- Create shared schemas/stable error codes in `packages/contracts`.
- Create the run state machine, signed contracts, concept/code prompts, and selection in `packages/core`.
- Create the three minimal registry entries/adapters in `packages/registry`.
- Create parse/byte/network-policy checks and harness injection in `packages/validator`.
- Create D1 migrations/repositories, the Worker routes, MCP resource, and eight tools in `apps/worker`.
- Create the Slot, Concept, Progress, Result, and basic Failure surfaces in `apps/widget`.
- Create `/`, `/c/:id`, `/run/:id`, source, and raw-traffic panels in `apps/site`.

### Work order

1. Bootstrap strict TypeScript/npm workspaces, test/build/lint/format commands, Wrangler local D1, and Vite multi-entry builds.
2. Test and implement shared schemas, phase transitions, idempotency, HMAC run contracts, and three-API selection without repeat/history/category violations.
3. Test and implement minimal registry operations and fixture adapters. All calls map typed params to fixed GET URLs.
4. Test and implement D1 migrations and transactions for runs, concepts, revisions, creations, requests, and budgets.
5. Test and implement `open_randomware`, `spin_apis`, `submit_concept`, `submit_artifact`, `submit_repair`, `get_run`, `mutate_creation`, and `record_choreography_failure` with exact schemas/annotations.
6. Test and implement the concept and artifact validators needed for the vertical path. Reject all direct network primitives and require literal broker calls.
7. Test and implement signed 10-minute runtime capabilities and `/api/runtime/call` with two-call concurrency, request/byte/time limits, fixed adapters, and authoritative request logging.
8. Test and implement `/run/:id` with `sandbox="allow-scripts"`, no same-origin permission, the trusted harness, exact CSP, boot/error events, and no cookie/storage access.
9. Implement widget follow-up choreography, status polling, absolute timers in widget state, sequential reel reveal, concept reveal, Build disclosure, link-out, and event-backed progress.
10. Implement the owner-controlled creation page, source view as inert text, raw request rows, API attribution, AI/personal-data warning, report link, and nonblank failure shell.
11. Run the flow in MCP Inspector, local Chromium, and a real ChatGPT developer-mode conversation. Record one live creation using all selected APIs.

### Verification commands

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration -- vertical-slice
npm run build
npm run dev:worker
```

In a second terminal while the local Worker runs:

```bash
npx @modelcontextprotocol/inspector@latest
npm run test:e2e -- vertical-slice.spec.ts
curl -fsS http://127.0.0.1:8787/healthz
```

Expected: automated commands exit 0; Inspector lists eight annotated tools and validates their schemas; Playwright completes spin→stored concept→artifact→sandbox boot→broker request→source/traffic view at desktop and 390 px.

### Done-criteria

- The real ChatGPT user's model calls `submit_concept` and sends a complete artifact through `submit_artifact`.
- The artifact runs only in the opaque sandbox and calls real selected APIs only through the fixed broker.
- Link-out works; a valid creation boots; source and request records are inspectable; failures have a rendered view.
- No owner model/API key exists in code, config, secret names, or logs.
- All milestone tests pass and evidence is in `BUILD_LOG.md`.
- Commit: `feat: complete safe Randomware vertical slice`.

## Milestone 2 — Complete the safe runtime and failure/repair contract

### Scope

Implement every Must containment, validation, quota, publication, runtime-observation, failure, and single-repair rule. This milestone turns the vertical slice into the PRD safety bar.

### Work order

1. Expand the validator corpus first: one accepted 10/25/40 KB artifact and one fixture for every rejection code in `ARCHITECTURE.md` §6.
2. Implement full parse5/acorn validation, unsafe field/label scan, CSS/URL scan, AST literal API coverage, marker/interaction/ready checks, normalized source, report version, and SHA-256.
3. Implement immutable revision 1/2 storage and a D1 transaction that accepts `submit_repair` only after an artifact-backed failure and only once. Preserve both sources.
4. Implement initial boot/runtime repair triggers for JavaScript, response-shape, timeout, policy, and unused-API failures; keep late visitor failures honest and non-model-dependent.
5. Implement all per-load, per-operation, per-API, global, storage, JSON, asset, and audio caps exactly as specified in `ARCHITECTURE.md` §5.5.
6. Implement manual redirect validation, safe content-type/size streaming, signed asset routes, Radio Browser's exact-resolved media token, and private-host/IP rejection.
7. Implement trusted runtime telemetry, nonce/source checks, authoritative broker usage, ten-minute unused-API finalization, and the full failure taxonomy/death certificate.
8. Implement the gallery listing gate, report hiding, owner bearer-protected unpublish route and CLI, removal page, and retention lock.
9. Add malicious API-content fixtures, capability replay/expiry tests, concurrent idempotency tests, CORS `Origin: null` tests, CSP tests, and browser escape probes.
10. Run a real ChatGPT invalid-artifact→automatic repair flow and a repair-failure flow. Record received artifact counts and both sources.

### Verification commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit -- validator broker state-machine
npm run test:integration -- security repair quotas publication
npm run test:e2e -- containment.spec.ts failure.spec.ts repair.spec.ts
npm run security:scan
npm run build
```

Expected: all commands exit 0; every validator rejection has a stable expected code; Playwright observes zero generated-code requests outside the companion origin, failed access to parent/storage/navigation, one received repair at most, and a nonblank death certificate for every injected failure.

### Done-criteria

- Every generated-app network route is mediated; there is no arbitrary URL input.
- Static checks, opaque sandbox, CSP, broker, caps, logging, reporting, and unpublish all pass their tests.
- One received repair artifact is the hard maximum; failed originals remain inspectable.
- Capacity and upstream failures are owner-controlled views, never raw Cloudflare/upstream pages in tested application paths.
- Commit: `feat: enforce generated app containment and repair limits`.

## Milestone 3 — Complete the product experience

### Scope

Finish every Must experience across Slot, Concept, Progress, Live Creation, Failed Creation, Inspect, Mutate, Spin Again, recent showcase, and mobile. Add Should items only where explicitly gated and all Must tests remain green.

### Work order

1. Test and implement the full widget reducer/recovery path, last-three spin history, same-combination concept history, re-steer-once timers, and local fallback death certificate.
2. Finish deadpan copy, sequential reveal, disclaimer, causal chain, API roles, Build/Reroll, observable progress timings, creation controls, and exact failure-cause copy.
3. Finish companion recent index, creation metadata, source revision switcher, raw traffic, human-readable dataflow, unused/not-yet-observed state, Mutate and Spin Again “open in ChatGPT” links.
4. Make owner warnings/attribution/report controls permanent outside the sandbox and verify generated content cannot cover or remove them.
5. Test keyboard operation, visible focus, reduced motion, contrast, screen-reader names, no horizontal overflow, and 390 px mobile width.
6. If frame embedding passed milestone 0, add `frameDomains` and exact ancestor CSP and test it. Otherwise keep it absent and test link-out copy.
7. After all Must checks pass, implement Stable/Wild/Chaos, dataflow graphic, seeded selection, and slot polish only while the budget is above the optional-work threshold in `BUDGET.md`.

### Verification commands

```bash
npm run test:unit -- widget selection failure-copy
npm run test:integration -- choreography history inspection
npm run test:e2e -- widget.spec.ts creation.spec.ts accessibility.spec.ts mobile.spec.ts
npm run test:e2e -- frame-or-link.spec.ts
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Expected: commands exit 0; the frame-or-link test asserts exactly the milestone-0 decision; all six surfaces are reachable with keyboard at desktop and mobile widths; a remounted widget resumes deadlines rather than resetting them.

### Done-criteria

- US-01 through US-06 behavior is present for the three-API vertical registry.
- Link-out is polished and reliable; embedding is present only with recorded proof.
- Inspect reports source, actual requests, dataflow, and unused APIs.
- Mutate keeps APIs and produces a history-aware prompt; Spin Again reselects.
- No Should failure blocks this milestone; every Must check passes.
- Commit: `feat: complete Randomware player and showcase experience`.

## Milestone 4 — Registry expansion, weighting, health, and demo resilience

### Scope

Expand from three APIs to the 14-entry launch target, complete the implementation-time terms/attribution check, add health automation, finish incongruity weighting, and create the clearly labeled five-combination recorded replay fallback.

### Work order

1. Copy the preparation raw fixtures without modifying them; create bounded adapted-output goldens for all 14 target APIs.
2. For each target entry, record official docs/terms/attribution URL, fixed hosts, media paths, operations, typed params, adapter schema, time/byte/cache/budget values, semantic tags, category, and sensory tags.
3. Run one bounded live check per target. Disable an entry on terms ambiguity, schema mismatch, unhealthy status, or unbounded asset risk. Do not replace entries without recording the reason; stop if fewer than 10 are enabled.
4. Implement the exact Wild weighting formula and 100,000-seed distribution tests. Add Stable/Chaos only if it was enabled in Milestone 3.
5. Implement cron health transitions, local/live verification reports, explicit publish-to-D1, 80% degradation, and disabled-only-manual-restore.
6. Implement cache normalization and provider-specific rate/user-agent/attribution behavior. Ensure Radio Browser mirror selection and media behavior follow the spike outcome.
7. Build five labeled recorded replay combinations from accepted artifacts and adapted fixtures. Replays must not masquerade as real model generation or live API calls.
8. Run five distinct live combinations through local/browser integration before deployment; use at least one visual, one audio if enabled, one geo, one text, and one numeric/state source across the set.

### Verification commands

```bash
npm run registry:verify
npm run registry:verify:live
npm run test:unit -- registry adapters selection
npm run test:integration -- registry-live health cache
npm run test:e2e -- api-matrix.spec.ts demo-replay.spec.ts
npm run acceptance:machine
```

Expected: at least 10 and no more than 18 entries report enabled/healthy; every enabled API has a raw and adapted fixture and official policy metadata; 100,000 seeded spins meet arity/fairness constraints; five live combinations and five clearly labeled replays pass.

### Done-criteria

- The enabled launch set and every drop/add reason are recorded in `BUILD_LOG.md`.
- Every enabled operation is fixed, typed, capped, attributed, health-checked, and covered by a golden fixture.
- The ISS latency finding remains respected and iTunes remains spike-only.
- Selection meets all Must constraints and distribution assertions.
- Commit: `feat: launch verified API registry and health checks`.

## Milestone 5 — Deployment, acceptance, and submission artifacts

### Scope

Deploy the public Worker on a free plan, run full machine/browser/real-ChatGPT acceptance, finish README and submission documents, preserve evidence, and reach the mandatory human `/feedback` stop.

### Work order

1. Record the pre-deployment budget checkpoint. Confirm Cloudflare Workers Free/D1 Free, no payment-required upgrade, auto top-up off, and no API-key Codex sign-in.
2. Create production D1, apply migrations, set only application signing/admin secrets, configure static assets/cron/fail-closed behavior, and deploy the Worker.
3. Run deployed health, MCP, CSP, denial, index, creation, source, traffic, report, and unpublish smoke tests. Roll back only by deploying the prior known-good commit; never delete production data to fix code.
4. Connect the deployed `/mcp` URL in ChatGPT developer mode and run the fixed 10-spin owner protocol from `ACCEPTANCE.md`, including five distinct end-to-end combinations, one same-API mutation, one invalid artifact with one received repair, and one terminal failure.
5. Capture timing and pass/fail evidence, browser/network screenshots, deployment URL, registry count, known limitations, and exact commits in `BUILD_LOG.md`.
6. Complete `README.md` with every PRD §16.6 item, leading with zero-setup showcase/demo for judges who cannot connect. Include exact plan prerequisites and developer-mode connect instructions.
7. Create `docs/DEMO_SCRIPT.md` with a 2:50-or-shorter spoken script and shot list covering every PRD §16.4 item. Prepare the ≤200-character pitch and complete project description.
8. Update `docs/BUDGET.md` final checkpoint and `docs/BUILD_LOG.md` with Sol design, Luna goal, human decisions, commands/evidence, deployed URL, remaining gaps, and fields reserved for the `/feedback` Session ID.
9. Run secret/history checks, license/repository access checks, final diff review, and the full acceptance command.
10. Commit all implementation/submission work, push `main`, verify the public repository and deployed URL from a logged-out browser, and identify the submission commit/tag.

### Verification commands

```bash
npm ci
npm run acceptance:machine
npm run test:e2e:deployed -- --base-url="$RANDOMWARE_PUBLIC_URL"
npm run registry:verify:live
npm run security:scan
npm run secrets:scan
npm run build
git diff --check
git status --short
git log -1 --oneline
```

Deployed smoke commands:

```bash
curl -fsS "$RANDOMWARE_PUBLIC_URL/healthz"
curl -fsSI "$RANDOMWARE_PUBLIC_URL/"
curl -fsSI "$RANDOMWARE_PUBLIC_URL/c/$ACCEPTANCE_CREATION_ID"
curl -fsSI "$RANDOMWARE_PUBLIC_URL/run/$ACCEPTANCE_CREATION_ID"
```

Expected: every command exits 0; CSP/security headers match architecture; the deployed Playwright suite observes no unapproved generated request; the public repository contains an MIT license; the pitch length test is ≤200 characters; `git status --short` is empty after the final commit.

### Done-criteria

- Every machine-checkable Must in `ACCEPTANCE.md` passes.
- Every manual browser/ChatGPT row has dated evidence, including five combinations, failure, repair, source/traffic, mutation, and logged-out public access.
- The measured owner-demo target table is filled honestly; a missed target is recorded and fixed if it is a Must blocker, never hidden.
- README, BUILD_LOG, BUDGET, DEMO_SCRIPT, project description, deployment, public repository, and MIT license satisfy PRD §16.
- No submission-blocking requirement remains except the explicitly human-run `/feedback` step and, if not already done by the human, recording/uploading the spoken demo video.
- Commit: `docs: prepare Randomware submission and deployment evidence`, followed by any necessary final fix commit.

## Mandatory final stop

Do not report the `/goal` complete. Stop and ask the human to run `/feedback` in this same primary Codex session, copy its Session ID into `docs/BUILD_LOG.md` and the private submission note, and return so the ID can be committed. Do not fabricate, infer, or prefill the Session ID. After the human supplies it, rerun the final document/status checks, commit the recorded ID, and report any remaining human submission action explicitly.
