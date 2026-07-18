# Randomware Grant Budget and Stop Conditions

Status: binding cost-control contract
Date: 2026-07-18
Grant: 2,500 credits = $100, therefore 1 credit = $0.04

## 1. Accounting boundary

The $100 grant covers the Sol design pass, the single Luna implementation `/goal`, Codex-driven verification, and any development-time API-key model spend. Expected API-key model spend is $0 because product generation and owner test spins run in the executing user's ChatGPT session/plan. Post-submission public product usage is outside the grant accounting boundary, but hosting must still add zero incremental cost.

Codex uses plan-included usage before it draws from the grant credit balance. Consequently, a stable credit balance does not mean a session used no Codex capacity. Every checkpoint must record both values shown in Codex Settings > Usage:

1. plan usage (the exact displayed value and reset/limit context); and
2. grant credit balance.

Do not convert plan usage into credits or merge the meters. Credit consumption is the decrease between two credit-balance snapshots; plan usage is reported separately in the UI's own units.

The build must use Codex signed in with ChatGPT. API-key sign-in bills the platform account and would not reliably consume this grant. Auto top-up/auto recharge remains off for the entire project.

## 2. Deadlines

- Grant redemption deadline: **2026-07-21 17:00 PT**.
- Grant validity: 14 days after actual redemption.
- Submission deadline: **2026-07-21 17:00 PT**.
- Tokyo reference: because July uses Pacific Daylight Time, the submission/redemption deadline is **2026-07-22 09:00 JST**. PT is authoritative if a displayed deadline differs.

At the start of the implementation session, record the actual redemption timestamp and calculated grant-expiry timestamp. If the grant is not redeemed, stop before code changes and have the owner redeem it. The submission deadline, not the later grant expiry, controls feature work.

## 3. Allocation

| Envelope | Credits | Dollars | Purpose | Exhaustion action |
|---|---:|---:|---|---|
| Sol technical design | 300 | $12 | five design documents, source verification, commit | design stops; unresolved ambiguity is recorded rather than extended |
| Luna implementation | 1,400 | $56 | feasibility, vertical slice, safe runtime, experience, registry | stop feature work and preserve a runnable Must path |
| Codex E2E/verification | 500 | $20 | browser iterations, deployed fixes, acceptance evidence, two independent reviews | run only failing Must checks; stop exploratory polish |
| Final reserve | 300 | $12 | broken Must acceptance, deployment, README/submission docs, demo blockers | never spend on Should/Could work |
| **Total** | **2,500** | **$100** |  |  |

Implementation guidance within the 1,400-credit envelope:

| PLAN milestone group | Planning share | Purpose |
|---|---:|---|
| Milestone 0 feasibility | 200 | eliminate Apps SDK/hosting unknowns before product code |
| Milestone 1 vertical slice | 350 | first real safe end-to-end flow |
| Milestone 2 safe runtime | 350 | containment, validation, caps, repair/failure |
| Milestone 3 experience | 250 | all Must surfaces and mobile |
| Milestone 4 API expansion | 250 | launch registry, health, weighting, fixtures |

These shares are control limits, not permission to consume the amount. Unused credits roll forward to E2E/reserve. Moving credits out of the 300-credit final reserve is prohibited. Moving more than 100 credits between non-reserve envelopes requires a one-sentence reason in the checkpoint table.

The post-Milestone-2 security review and pre-`/feedback` whole-repository review are funded only from the 500-credit Codex E2E/verification envelope and have a **150-credit combined cap**. Record their measured combined spend and outcome in `BUILD_LOG.md`; unused review allowance remains in the E2E/verification envelope. Before starting either review, apply §4 to the remaining Must work and untouched reserve. If the review would trigger a hard-stop threshold or the remaining E2E/verification balance cannot fund it within the combined cap, skip that review and record the skip and exact budget reason explicitly. A review skip never waives an acceptance requirement or an already-active hard stop.

## 4. Hard stop conditions

Stop immediately and report the condition to the owner when any item below is true:

1. Codex Settings > Usage cannot show both plan usage and credit balance at a required checkpoint. No new milestone starts until the snapshot is recorded.
2. The grant is unredeemed at implementation start, expired, or shows an unexpected account.
3. Codex is signed in with an API key rather than ChatGPT, or auto top-up is enabled.
4. Grant credit balance is **300 credits or less**. Only an already-started reserve-eligible action may finish; otherwise stop.
5. The projected cost to finish remaining Must work plus the untouched 300-credit reserve exceeds the measured credit balance. Stop before consuming the reserve and present the measured blocker; do not silently drop a Must.
6. A non-reserve envelope is exhausted before its required deliverable passes. Stop optional iteration, run the shortest diagnostic needed, and request owner direction if a Must remains blocked.
7. Any hosting/dependency path requires a paid plan, credit card charge, usage-based billing without a hard free cutoff, or owner model/API spend. Do not activate it.
8. Cloudflare Free cannot reliably process the 40 KB artifact validation spike. Stop at PLAN Milestone 0 and request approval before selecting the documented multi-vendor fallback.
9. Full artifact transport through tool arguments fails. Stop; chunking or an owner key is a product-contract change.
10. Fewer than 10 APIs can pass implementation-time health/terms/safety checks. Stop rather than shrinking the registry Must.

“Stop” means preserve the working tree and evidence, update `BUILD_LOG.md` and this file, state the exact unmet Must and remaining meters, and ask the owner. It does not mean claim partial work is complete.

## 5. Optional-work stop conditions

Should work is allowed only when all earlier Must checks pass and all of these are true:

- credit balance is greater than 1,200 credits;
- the plan meter is not at a warning or limit state;
- the remaining implementation/verification estimate plus 300-credit reserve fits inside the current balance;
- the submission deadline leaves time for the full final acceptance protocol.

At or below 1,200 credits, stop moods, animation polish, embedded execution work beyond its spike decision, prettified traffic, dataflow graphics, replay curation, and other Should items. Could items receive zero grant allocation and are not implemented in the primary goal.

## 6. Reserve policy

The last 300 credits may be used only for:

- a failing Must acceptance criterion;
- a broken public deployment or MCP connection;
- required README, BUILD_LOG, BUDGET, DEMO_SCRIPT, project-description, or `/feedback` evidence;
- a demo-recording blocker in the real deployed Must path;
- secret removal or security correction required for submission.

The reserve may not be used for visual polish, additional APIs above 10 healthy entries, Should embedding, new moods, favorites, screenshots, performance tuning after metrics pass, or speculative refactoring.

## 7. Zero-incremental-cost runtime controls

The deployment stays on Cloudflare Workers Free and D1 Free. The owner verifies the dashboard shows no paid Workers plan. Application caps are intentionally below provider limits:

- 5,000 proxied upstream calls per UTC day;
- 250 calls per API per day by default;
- 2,000 stored creations;
- 40 KB source and at most two revisions per creation;
- broker/cache/storage limits from `ARCHITECTURE.md` §5.5.

Reaching an application cap degrades gracefully and disables new work; it never triggers paid overage. If Cloudflare changes its free-tier terms before deployment, re-run the cost check and stop if a charge can occur.

## 8. Usage checkpoint table

The worker fills a row immediately at each boundary. Copy the exact UI wording; do not estimate a meter. `Not yet measured` is an explicit incomplete checkpoint and blocks the next milestone.

| Checkpoint | Timestamp/timezone | Plan usage (exact UI) | Credit balance | Credit delta | Expected next envelope | Decision/reason |
|---|---|---|---:|---:|---:|---|
| Sol design start | 2026-07-18 JST (retroactive entry) | Not captured before the design session — honest baseline omission | 2,500 (owner-confirmed at redemption) | — | 300 | Meters are owner-transcribed from Codex Settings; the plan meter is account-wide and includes any non-project usage |
| Sol design end | 2026-07-18 11:21 JST | 33% of weekly limit used (ChatGPT Plus) | 2,500 | 0 | — | Design pass + three bounded addenda ran entirely on plan-included usage; grant untouched |
| Luna `/goal` start | 2026-07-18 11:21 JST (same snapshot as design end) | 33% of weekly limit used (ChatGPT Plus) | 2,500 | 0 | 1,400 | ChatGPT sign-in and auto top-up off confirmed by owner; `/goal` starts immediately after this snapshot |
| Milestone 0 feasibility end | 2026-07-18 12:31 JST | 99% of the weekly limit remaining (ChatGPT Plus) | 2,500 | 0 | 1,200 | Owner-transcribed snapshot recorded; real ChatGPT Apps SDK feasibility evidence remains pending |
| Primary model escalation: Luna → Sol high | 2026-07-18 JST | Not re-measured at switch | Not re-measured at switch | — | 500 verification | Owner-directed escalation in the same primary session after 13+ real-client defects, including three schema/validator-drift defects; no meter value is inferred |
| Milestone 1 vertical slice end | Not yet measured | Not yet measured | Not yet measured | Not yet measured | 850 | Preserve first runnable path |
| Milestone 2 safe runtime end | Not yet measured | Not yet measured | Not yet measured | Not yet measured | 500 | All security Must checks pass |
| Milestone 3 experience end | Not yet measured | Not yet measured | Not yet measured | Not yet measured | 250 | Apply optional-work threshold |
| Milestone 4 registry end | Not yet measured | Not yet measured | Not yet measured | Not yet measured | 500 verification | At least 10 healthy entries |
| Pre-deployment | 2026-07-18 12:31 JST | 99% of the weekly limit remaining (ChatGPT Plus) | 2,500 | 0 | 500 verification | Owner snapshot immediately before remote D1/deployment; free-plan path directed by owner |
| Post-deployment E2E | Not yet measured | Not yet measured | Not yet measured | Not yet measured | 300 reserve | Stop non-reserve work |
| Pre-demo/submission | Not yet measured | Not yet measured | Not yet measured | Not yet measured | 300 reserve | Reserve-eligible blockers only |
| Final after `/feedback` | Not yet measured | Not yet measured | Not yet measured | Not yet measured | 0 | Record total, remaining balance, final plan meter |

Meter continuity note (2026-07-18 12:31 JST, owner-transcribed): the ChatGPT Plus weekly plan meter **reset** between the Luna `/goal` start snapshot and Milestone 0 closure. Current snapshot: plan usage **99% of the weekly limit remaining** (fresh weekly window); grant credit balance **2,500** (delta 0 since redemption). Plan-usage percentages are comparable only within one weekly window — do not compare post-reset values against the pre-reset 33% figure. The Milestone 0 end row must be filled from this or a fresher owner-transcribed snapshot.

## 9. Checkpoint calculation

At each row:

1. Open Codex Settings > Usage and transcribe both meters.
2. Compute credit delta only when both adjacent credit balances are numeric: `previous balance - current balance`.
3. Note whether usage came from plan, credits, or both exactly as the UI indicates; do not infer when it does not.
4. Re-estimate only the next envelope and total remaining Must work, rounded up.
5. Apply hard stops before starting the next milestone.
6. Copy the checkpoint and any allocation move into `BUILD_LOG.md`.

The final project description may state it stayed within $100 only after the final row proves credit consumption did not exceed 2,500 and any counted development API spend is added (expected $0).
