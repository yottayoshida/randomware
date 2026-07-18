# Randomware Acceptance Contract

Status: binding verification contract
Date: 2026-07-18

This document maps acceptance to PRD §7, §12, and §16.10. A check is complete only with the stated evidence. Offline fixture replay never substitutes for a live API, real ChatGPT, deployed-browser, or public-access check.

## 1. Required test commands

The implementation must provide these commands with stable exit codes:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
npm run registry:verify
npm run security:scan
npm run secrets:scan
npm run acceptance:machine
```

`npm run acceptance:machine` runs format, lint, types, unit, integration, local Playwright, build, registry fixture validation, security-policy tests, secret scan, and acceptance-document checks. It must not require network access. Live/deployed checks are separate and recorded in `BUILD_LOG.md`.

## 2. Machine-checkable acceptance

### 2.1 PRD §7 functional requirements

| ID | PRD mapping | Machine assertion | Required evidence |
|---|---|---|---|
| M-US01-1 | US-01 arity | Across 100,000 deterministic seeds, 3-API rate is 14–16%; every other spin has 2 | selection unit test |
| M-US01-2 | US-01 uniqueness/history/category/health | No duplicate API, no exact match to previous three sets, no all-one-category set, no nonhealthy selection | property tests using synthetic health/history |
| M-US01-3 | US-01 metadata/reveal | Spin output contains ID/name/category/capability; widget reveals one reel at a time using distinct timestamps | contract test and fake-timer widget test |
| M-US02-1 | US-02 concept schema | Accepted concept contains app name, premise, player action, one role per selected API, ordered causal chain, dependency, interaction, visual direction, and all banned-shape fields | schema/validator tests |
| M-US02-2 | US-02 essential roles | Missing/duplicate/unknown API roles or invalid operations are rejected with stable diagnostics | concept validator corpus |
| M-US02-3 | US-02 heuristic gate | Each banned-shape phrase fixture is blocked; structurally complete eccentric fixtures pass | concept validator corpus |
| M-US02-4 | US-02 reroll | Reroll creates no artifact/revision and includes normalized prior concept history | D1 integration test |
| M-US03-1 | US-03 artifact shape | Artifact outside 10,000–40,000 UTF-8 bytes, malformed HTML/JS, missing mobile/loading/error/attribution/interaction/ready markers, or undeclared API call is rejected | artifact corpus tests |
| M-US03-2 | US-03 real mediation | Accepted fixture app can obtain live-shaped responses only through literal broker operations; direct fetch/XHR/socket/beacon/worker attempts fail | validator, broker, Playwright network tests |
| M-US03-3 | US-03 shareable URL | Accepted creation is persisted and `/c/:id`, `/run/:id`, source, and request routes return owner-controlled responses | D1/HTTP integration tests |
| M-US03-4 | US-03 progress honesty | UI stages correspond one-to-one with stored observable events; no composing/writing token stage exists | reducer/contract snapshot tests |
| M-US04-1 | US-04 source | Source endpoint/view renders exact accepted source as inert text and can switch immutable revisions | hash/integration/browser tests |
| M-US04-2 | US-04 traffic | Broker writes start/end API/operation/status/bytes/cache timestamps and redacts user-text values | D1 integration tests |
| M-US04-3 | US-04 dataflow/unused | Concept dependency renders as human-readable text; zero-call selected APIs move from `not_yet_observed` to `unused` after capability expiry | unit/integration/fake-clock tests |
| M-US05-1 | US-05 no blank failure | Every stable failure code maps to complete death-certificate fields and renders an owner-controlled failure view | exhaustive enum/snapshot/Playwright tests |
| M-US05-2 | US-05 exact failure cause | Invalid concept, artifact schema/parse, policy, runtime JS, upstream, response shape, timeout, unused API, repair, choreography, and capacity fixtures retain their distinct code | exhaustive failure tests |
| M-US05-3 | US-05 one repair | Concurrent/retried calls can create at most revision 1 plus one received repair; the counter increments only after complete repair artifact receipt | D1 transaction/idempotency tests |
| M-US05-4 | US-05 immutable concept | Repair with changed concept ID, API set, operation set, or phase is rejected | repair contract tests |
| M-US05-5 | US-05 choreography | Absolute concept/artifact/repair timers re-steer once, survive widget remount, then render a local failure and idempotently record it | fake-timer widget/integration tests |
| M-US06-1 | US-06 Mutate | Mutation contract preserves canonical API set and includes prior concept summaries | state-machine integration test |
| M-US06-2 | US-06 Spin Again | New spin runs full selection and does not inherit the previous API set as a constraint | state-machine integration test |

### 2.2 PRD §12 safety and quality metrics

| ID | PRD mapping | Machine assertion | Required evidence |
|---|---|---|---|
| M-METRIC-1 | zero unapproved network | Playwright captures no generated-frame request to a destination other than the exact companion origin; broker rejects unknown API/operation/URL/redirect host | containment suite |
| M-METRIC-2 | failure coverage | Every injected pipeline failure renders explanatory Failed Creation state; count equals 100% | parameterized failure suite |
| M-METRIC-3 | API use | Broker log is authoritative and selected API coverage is computed correctly | integration tests |
| M-METRIC-4 | non-100% target | Test configuration never asserts 100% generation success or converts a Failed Creation into an automated fake success | config/snapshot assertion |
| M-METRIC-5 | third-spin probability | 14–16% proxy for “roughly 15%” over fixed seed corpus | selection test |

The model/plan-dominated timing and quality metrics are manual by design and appear in §3.2.

### 2.3 PRD §16.10 final acceptance

| ID | PRD mapping | Machine assertion | Required evidence |
|---|---|---|---|
| M-FINAL-1 | automated tests | `npm run acceptance:machine` exits 0 from a clean install | saved command output in BUILD_LOG |
| M-FINAL-2 | repository/license | repository root contains an MIT `LICENSE`; required docs exist | acceptance script |
| M-FINAL-3 | README | README headings/content checklist covers overview, pitch, media, deployed URL, ChatGPT prerequisites/connect, architecture, environment, setup, env vars, commands, registry, examples, limits, security, judges, license, and exact `Built with Codex and GPT-5.6` heading | Markdown acceptance test |
| M-FINAL-4 | required docs | PRD, architecture, plan, acceptance, budget, build log, and demo script exist under `docs/` | acceptance script |
| M-FINAL-5 | pitch length | UTF-8 submission pitch is no more than 200 Unicode characters | acceptance script |
| M-FINAL-6 | secrets | tracked files and git diff contain no private keys, bearer values, API keys, tokens, `.env` contents, or raw private logs | `npm run secrets:scan` plus manual history check |
| M-FINAL-7 | `/feedback` evidence | `BUILD_LOG.md` has a non-example Session ID in its final feedback field before the post-feedback commit | document test run only after human provides ID |
| M-FINAL-8 | clean release | final build passes and working tree is clean at the identified submission commit | command output |

## 3. Manual browser and ChatGPT acceptance

### 3.1 Fixed environments

Record exact versions in `BUILD_LOG.md`:

- ChatGPT web with a paid personal plan, Developer mode enabled, deployed Randomware app connected, and owner-selected GPT-5.6 for the demo run.
- Current stable Chromium on desktop at 1440×900 and device emulation at 390×844.
- One logged-out/incognito browser for the zero-setup companion path.
- The public production origin and production D1, not localhost.

If Business/Enterprise/Edu is used, record the workspace-admin developer-mode toggle. Free plans cannot be used for the unlisted live app path.

### 3.2 Fixed owner-demo protocol

Use exactly 10 fresh 2-API spins in one acceptance run. Do not discard failures or restart timing. Start timing at the Spin action. Record selected APIs, concept time, first preview time, boot status, interaction performed, selected APIs observed in broker logs, repair count, and final status for each row.

Use at least five distinct combinations. Across the 10 rows include at least one visual, one audio when enabled, one geo, one text, and one number/state API. After the 10 rows, mutate one previously successful API combination twice to produce two additional concepts; these mutation rows do not alter the 10-spin denominators.

The pass calculations are:

- median spin-to-concept reveal ≤10 seconds;
- median spin-to-first-preview ≤90 seconds;
- booted interactive creations ≥7/10;
- among booted creations, completed broker calls for every selected API ≥80% (for 7 booted, at least 6; always use `ceil(0.8 × booted)`);
- at least five distinct combinations complete end-to-end;
- the two same-combination mutations are meaningfully different by owner review;
- fewer than 5 of a separate fixed 10-concept sample could pass as sincere startup pitches.

Timing targets are owner-demo targets, not automated release gates. Record misses honestly. A miss triggers tuning if the core flow is broken or the PRD metric sample fails; it is never converted to fixture evidence.

### 3.3 Manual checklist mapped to PRD §7

| ID | PRD mapping | Manual action and pass condition |
|---|---|---|
| B-US01 | US-01 | Spin in ChatGPT. Two APIs normally and a recorded rare third are revealed sequentially with name/category/capability; no duplicate or unhealthy entry appears. |
| B-US02 | US-02 | Read concept before build. Name, premise, action, causal chain, every API role, Build, and Reroll are understandable without code. Owner judges it eccentric and not a banned shape. |
| B-US03 | US-03 | Accept public-URL disclosure, Build, and open the creation. Progress claims only observed boundaries. Page boots, fits 390 px, visibly loads/errors, attributes APIs, and real interaction produces real broker traffic. |
| B-US04 | US-04 | Open Source, Requests, and Dataflow. Source is readable/inert, request rows match browser action, dependency is understandable, and an intentionally unused fixture is flagged. |
| B-US05 | US-05 | Exercise invalid artifact then terminal repair failure. Exactly one complete repair artifact is accepted; death certificate states the accurate cause; both revisions remain inspectable; there is no blank state. Also let one choreography phase expire and observe one re-steer then failure. |
| B-US06 | US-06 | Mutate keeps the APIs and yields a meaningfully different concept. Spin Again changes the full selection path. |

### 3.4 Safety and containment browser checks

| ID | Action | Pass condition |
|---|---|---|
| B-SEC-1 | In DevTools inspect the generated iframe | `sandbox` contains only `allow-scripts`; no same-origin/forms/popups/download/navigation permission exists. |
| B-SEC-2 | Run the accepted escape-probe artifact | Parent DOM, `window.openai`, cookies, storage, top navigation, popup, download, and direct upstream fetch are unavailable; owner chrome remains intact. |
| B-SEC-3 | Inspect Network while interacting | Generated-frame connect traffic targets only the companion origin; upstream calls originate server-side and match selected registry operations. |
| B-SEC-4 | Attempt unknown API/operation and expired/replayed capability | Styled blocked/disallowed or capacity failure appears; no upstream request occurs. |
| B-SEC-5 | View malicious text fixture | Script-like API text is inert text and does not alter owner/widget DOM. |
| B-SEC-6 | Inspect public creation chrome | AI-generated notice, personal/payment-data warning, attribution, and report/remove link remain outside and above the sandbox. |
| B-SEC-7 | Submit a report then owner-unpublish | Creation leaves the recent index immediately; all public/source/run routes show the owner removal view. |
| B-SEC-8 | Test Radio Browser if audio enabled | Only a broker-resolved signed media URL plays; arbitrary media URL input is rejected; stream stops at time/byte cap. |

### 3.5 PRD §16.10 and submission checks

| ID | Manual action and pass condition |
|---|---|
| B-FINAL-1 | From logged-out Chromium, public origin loads recent index and at least one creation with no setup. |
| B-FINAL-2 | In ChatGPT, deployed primary flow spin→concept→build→run→inspect→mutate/spin works end-to-end. |
| B-FINAL-3 | Five distinct combinations have dated evidence and one failed generation is intentional, accurate, and inspectable. |
| B-FINAL-4 | Deployed URL and `/mcp` are reachable over HTTPS; link-out works. Embedding is checked only if the spike enabled it. |
| B-FINAL-5 | Public GitHub repository is reachable logged out, includes MIT license and the identified submission commit/tag, and contains no private evidence. |
| B-FINAL-6 | README begins with zero-setup judge path and demo, then gives copy-paste developer-mode connect instructions with paid-plan/admin prerequisites. |
| B-FINAL-7 | README's `Built with Codex and GPT-5.6` section accurately distinguishes PRD, Sol design, Luna goal implementation, human decisions, Codex contribution, runtime GPT-5.6, and $100 constraint. |
| B-FINAL-8 | `DEMO_SCRIPT.md` is at most 2:50 and spoken text covers Codex and GPT-5.6, human decisions, Sol/Luna roles, budget, single goal, real spin/concept/app/traffic, and second result. |
| B-FINAL-9 | Project description covers every PRD §16.3 point; elevator pitch is ≤200 characters. |
| B-FINAL-10 | Both usage meters and final credit balance are recorded; auto top-up is off; hosting shows zero incremental cost. |
| B-FINAL-11 | Human runs `/feedback` in the primary implementation session and its Session ID is recorded in `BUILD_LOG.md` and private submission note. |
| B-FINAL-12 | No known submission-blocking requirement remains. Any human-only demo recording/upload or Devpost action is named explicitly, not reported as complete. |

## 4. Evidence format

For every manual row, `BUILD_LOG.md` records:

```text
check ID | date/time and timezone | commit | deployed URL/build | environment |
action | observed result | pass/fail | screenshot/log path without secrets | notes
```

Timing tables include all denominator rows, including timeouts and failures. Screenshots may show product UI and tool names but must not expose private conversation content, capabilities, Worker secrets, admin tokens, or chain-of-thought.

## 5. Release rule

The implementation goal may reach its mandatory `/feedback` stop only when all machine Must checks and manual Must rows pass, or when a documented budget stop condition prevents further work. Should failures are recorded and do not block release. The executor must not claim final completion before the human provides and records the `/feedback` Session ID.
