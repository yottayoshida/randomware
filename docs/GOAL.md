# Randomware Single-Session Execution Contract

This file is the authoritative contract for the one GPT-5.6 Luna `/goal` implementation run. The short `/goal` prompt points here; do not reinterpret or renegotiate the PRD.

## Objective

Implement, verify, and publicly deploy the complete Randomware MVP defined by `docs/PRD.md`, using the architecture and milestones below, without expanding or shrinking scope. The majority of core functionality must be completed in this one primary Codex session. Runtime invention/code/repair must use the executing player's ChatGPT session; Randomware must never add an owner model key.

## Read before changing any file

Read completely, in this order:

1. `docs/PRD.md`
2. `docs/api-candidates/report.md`
3. `docs/api-candidates/results.tsv`
4. `docs/api-candidates/results-round2.tsv`
5. consult `docs/api-candidates/samples/` fixtures on demand while implementing each registry entry; do not read them all upfront
6. `docs/ARCHITECTURE.md`
7. `docs/PLAN.md`
8. `docs/ACCEPTANCE.md`
9. `docs/BUDGET.md`
10. `docs/BUILD_LOG.md`
11. read the current official Apps SDK MCP server, ChatGPT UI, and reference pages linked from `ARCHITECTURE.md` upfront; consult the state, security, deploy, connect, and testing pages as needed per milestone

Then inspect `git status --short --branch`, recent commits, and the repository tree. Preserve unrelated owner changes and competition history.

## Non-negotiable architecture

- TypeScript/React/Vite app, stateless Streamable-HTTP MCP server, companion site, broker, and D1 persistence deploy as one Cloudflare Worker/Static Assets/D1 project on free tiers.
- Generated HTML executes only at `/run/:id` in an iframe with `sandbox="allow-scripts"` and no same-origin permission. Never inject generated code into the widget or companion shell.
- Every generated-app network request uses a short-lived selected-operation capability and the registry-limited broker. No tool or HTTP route accepts an arbitrary upstream URL.
- Production widget CSP connects only to the Randomware companion origin. `frameDomains` and in-conversation embedding are enabled only if the first spike proves them with exact ancestor policy. Link-out is always implemented and is the Must path.
- The server has no model. Concepts, code, and the one repair are supplied by the user's model through the exact MCP choreography/schemas. A repair counts only when a complete repair artifact reaches the server.
- API bodies are untrusted data and never enter model choreography prompts. Source is shown as inert text. Provider attribution and caps are enforced.
- There are no accounts, payments, arbitrary APIs, multi-file apps, generated backends, permanent-hosting promise, owner model/API key, or paid hosting plan.

## Execution order and gates

Execute `docs/PLAN.md` in order. At most one milestone is active. Use tests first for behavior, run every listed verification command, record evidence/budget, and commit before continuing.

### Gate 0 — Feasibility

Complete PLAN Milestone 0 first. Prove 10/25/40 KiB artifact arguments, diagnostic widget `connectDomains`, audio, companion `frameDomains`/link-out, and 40 KiB validation on Cloudflare Free. Remove spike code and retain evidence in `BUILD_LOG.md`.

Stop for owner direction if byte-perfect full-artifact transport fails or Cloudflare Free repeatedly exceeds its CPU limit. Do not introduce chunking, paid hosting, a different database/host, or an owner key without explicit approval. Direct widget CSP/audio/frame failures use only the fallbacks already defined in `ARCHITECTURE.md`.

### Gate 1 — Safe vertical slice

Complete PLAN Milestone 1: with the minimal registry, prove spin → user's-model concept → user's-model full artifact → validation/persistence → opaque sandbox → mediated real API call → source/traffic inspection → link-out. Generated code must be mediated/contained from its first execution; an unsafe prototype is not permitted.

### Gate 2 — Safe runtime

Complete PLAN Milestone 2: full validator, capability broker, CSP/sandbox, assets/media, quotas, immutable revisions, exact single repair, runtime observation, failure taxonomy, death certificate, report/listing/unpublish, and containment browser tests. Do not proceed with a known sandbox/network escape.

After Milestone 2's done-criteria pass, pause before Gate 3 and ask the human to obtain an independent security-focused review from a fresh Codex session running GPT-5.6 Sol at high reasoning effort with no shared conversation context. That session reviews the validator, broker, capability signing, sandbox/CSP headers, and repair transaction; it writes no code and saves only a findings document under `docs/reviews/`. In this primary session, fix and reverify fact-based defects before Milestone 3, record and defer style or scope findings, and record the review round and dispositions in `docs/BUILD_LOG.md`. If the combined-cap rule in `docs/BUDGET.md` requires a skip, record the skip and reason explicitly.

### Gate 3 — Product experience

Complete PLAN Milestone 3: all Must surfaces and US-01 through US-06, widget recovery/timeouts, honest progress, inspect, mutate/spin again, recent index, mobile/accessibility, and the spike-selected frame-or-link path. Implement Should work only if every preceding Must passes and `BUDGET.md` permits it. Implement no Could work.

### Gate 4 — Registry

Complete PLAN Milestone 4: implementation-time terms/attribution/health check, 18-entry target, fixed typed operations/adapters, fixtures, health tooling, weighting/distribution tests, and labeled replay fallback. Record every enabled/disabled/promoted API reason. Continue with 12–18 healthy entries; stop below 10. Keep ISS excluded and iTunes spike-only.

### Gate 5 — Deploy and submit

Complete PLAN Milestone 5: deploy on zero-incremental-cost hosting; run all machine, local-browser, deployed-browser, and real-ChatGPT checks in `ACCEPTANCE.md`; manually verify 10 fixed 2-API spins including at least five distinct combinations, a mutation, a repaired artifact, and a terminal failure; finish README, BUILD_LOG, BUDGET, DEMO_SCRIPT, project description, pitch, public-repository/license/secret checks; push and identify the submission commit/tag.

## Verification discipline

- A claim is supported by fresh command output or dated manual evidence. Never report a test as passing because its code looks correct.
- `npm run acceptance:machine` must pass from `npm ci` before final handoff.
- Use a real Chromium browser for the companion experience, CSP/network capture, mobile width, escape probes, report/unpublish, and logged-out public access.
- Use a real ChatGPT developer-mode conversation connected to the deployed `/mcp` for model/tool choreography. MCP Inspector or fixture mode does not substitute.
- Record every row of the fixed owner-demo protocol, including failures/timeouts. Do not cherry-pick.
- Fixture replay is visibly labeled and never counts as real API/model evidence.
- Verify generated-frame network destinations are zero outside the companion origin; verify broker logs show only selected operations.
- Keep `docs/BUILD_LOG.md` current after every milestone, not reconstructed at the end.

## Budget discipline

Apply `docs/BUDGET.md` before each milestone. Record both plan usage and grant credit balance at every checkpoint. Use Codex signed in with ChatGPT, leave auto top-up off, and keep the final 300-credit reserve untouched except for its enumerated submission blockers.

Stop immediately on any Budget §4 hard condition. Preserve the working state and report exact meters, completed gates, unmet Must, and the minimum next decision. Budget pressure never authorizes deleting a Must, enabling paid hosting, or calling an owner-funded model.

## Scope and decision rules

- PRD Must items are release blockers; Won't items remain out. Should items are nonblocking and budget-gated. Could items are not part of this goal.
- Do not redesign the product, add frameworks/services not required by the architecture, or perform unrelated refactors.
- Make ordinary implementation choices within the written contracts autonomously. Ask the owner only at an explicit architecture/budget gate or when an external account action cannot be performed without the human.
- If a manual external action is needed for Cloudflare, ChatGPT developer mode, GitHub visibility, video recording/upload, or Devpost, prepare everything possible, give one exact action, then resume verification after the human completes it.
- Do not expose secrets, private logs, prompt contents, chain-of-thought, signed capabilities, or admin tokens in commits/evidence.

## Completion bar

Do not say the project or goal is complete until all PRD Must acceptance checks in `docs/ACCEPTANCE.md` pass, the deployed app/repository are publicly reachable, the five-combination minimum and failure path are evidenced, required submission documents are complete, and no submission-blocking requirement remains. If a budget hard stop occurs, report blocked status instead of completion.

## Mandatory final stop and human handoff

When every check that Codex can perform has passed, **stop without reporting goal completion**. Before asking for `/feedback`, ask the human to obtain an independent whole-repository review against `docs/ACCEPTANCE.md` from a fresh Codex session running GPT-5.6 Sol at high reasoning effort with no shared conversation context. That session writes no code and saves only a findings document under `docs/reviews/`. In this primary session, fix fact-based defects in at most one fix round, record and defer style or scope findings, record the review and dispositions in `docs/BUILD_LOG.md`, and rerun `npm run acceptance:machine`. If `docs/BUDGET.md` requires a skip, record the skip and reason; the skip does not waive acceptance.

Only after that review gate and the fresh machine-acceptance rerun may the primary session ask the human to run `/feedback` here and copy the resulting Session ID into `docs/BUILD_LOG.md` and the private submission note. Never fabricate or infer the ID.

After the human returns with the Session ID, record it, rerun document/secret/status checks, commit and push that evidence, and explicitly list any remaining human-only demo-video or Devpost action. Only then may the implementation result be reported against the completion bar.
