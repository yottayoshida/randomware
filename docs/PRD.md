# Randomware — Product Requirements Document

| Field | Value |
|-------|-------|
| Status | Ready for technical design |
| Date | 2026-07-18 |
| Event | OpenAI Build Week |
| Category | Apps for Your Life |
| Product owner | yotta |

This document defines **what** Randomware is and what it must do. It intentionally leaves out **how**: architecture, framework, containment mechanics, prompt design, and repository layout are reserved for the technical design pass (§14). Where a statement here constrains implementation, treat it as a product requirement, not a design suggestion.

## 1. Summary

**Randomware is a slot machine for software.** It randomly selects two or three real public APIs, then GPT-5.6 invents, implements, and launches a completely new working web app from that combination in real time. Every spin produces something unpredictable: sometimes useful, sometimes absurd, sometimes a glorious failure — and the unpredictability itself is the product. Usefulness is never the goal; when it happens, it is a happy accident. The goal is eccentric, gloriously unnecessary software that no human would have thought to ask for.

Tagline: **Real APIs go in. Random apps come out.**

Elevator pitch (submission-ready, ≤200 characters):

> Randomware is a slot machine for software: it picks 2–3 public APIs, then GPT-5.6 invents, builds, and launches a brand-new web app. Useful, absurd, or broken—every spin is a surprise.

## 2. Background

Most AI app builders start with a human idea: the user describes what they want, and the AI implements it. Randomware inverts that relationship. The human provides no idea at all; a random set of real public APIs becomes the creative constraint, and GPT-5.6 must invent *what to build* before building it.

Public APIs matter because they connect the generated apps to reality. Each API carries real data, real capabilities, and real quirks. GPT-5.6 has to find meaning in combinations no template system could enumerate — and because the APIs are real, the results actually run instead of being staged mockups.

The creative stance is a **collision aesthetic**. Like a band name that welds two unrelated sentimental clichés into something strange and new (the product owner's touchstone: Omoide Hatoba — "Memory Wharf" — a Japanese band named by colliding two stock words of sentimental pop songs), Randomware welds APIs that share nothing — a deck of cards and live radio, poetry and exchange rates — and forces a meaning that never existed to hold them together.

This is also a deliberate creative answer to the two most criticized behaviors of generative AI. **Slop** is what happens when generation optimizes for plausible usefulness at scale; Randomware optimizes for the opposite — implausible, singular existence. **Hallucination** is confidently inventing what is not there; Randomware demands exactly that invention — a connection between unrelated APIs that no documentation supports — and then holds the hallucination accountable by forcing it to run as working software against real data. Grounded confabulation, with receipts.

## 3. Product definition

One sentence: a slot machine that combines randomly selected public APIs and uses GPT-5.6 to generate a different working web app every time.

Randomware ships as two connected surfaces:

1. A **ChatGPT app** (Apps SDK) — the slot machine itself. The player spins inside ChatGPT, and their own GPT-5.6 session performs the invention, implementation, and repair, refereed by Randomware's tools. Generation is billed to the executing user's plan; the owner's API key is not in the runtime path.
2. A **companion showcase site** — every creation is served at its own shareable URL, sandboxed, and collected into a public gallery of masterpieces and corpses. It is the zero-setup front door for judges and the "open in ChatGPT" entry point for players.

Core loop:

```
Spin (in ChatGPT)
 → 2–3 APIs are selected
 → the user's GPT-5.6 invents what this combination should become (the Concept)
 → the player triggers the build
 → the user's GPT-5.6 implements a working single-page app; Randomware validates it
 → the creation runs sandboxed — embedded in the conversation and live at its own URL
 → the player enjoys a success, an oddity, or a failure
 → Spin again, or Mutate the same APIs into a different concept
```

## 4. Experience promises

1. The same API combination does not always produce the same app.
2. Every selected API plays an essential role in the generated app's behavior.
3. Generated apps call the real APIs; they are not mockups.
4. A good app is never guaranteed — and that is intentional.
5. Failures are shown as results in their own right, never hidden.
6. No coding knowledge is needed to play.
7. The curious can inspect the generated source code and the actual API traffic.

### Creative principles

These govern every prompt, every generated app, and every line of product copy:

- **Deadpan sincerity.** The machine never winks. Every absurd combination is treated as a legitimate product brief and executed with total seriousness — the comedy lives in the gap between the absurdity of the premise and the sincerity of the execution. Generated apps play it completely straight; only Randomware's own chrome (build narration, failure reports) provides the dry commentary.
- **Uselessness is a feature.** Randomware does not apologize for pointless creations; it aspires to them. An app that is beautiful, functional, and utterly unnecessary is a full success.
- **Beyond human imagination.** A concept that a reasonable product manager could pitch without irony is a failed concept. If it could launch on Product Hunt unironically, it is rejected as insufficiently eccentric.
- **Collision naming.** Generated app names follow the collision aesthetic: two unrelated, evocative words jammed together ("Weather Dealer", "Bark Librarian", "Orbital Poet") — earnest, slightly wrong, memorable.

## 5. Target users

Primary: people who enjoy weird web toys; people curious about generative AI creativity; fans of public APIs and vibe coding; creators who use randomness as inspiration; hackathon and demo audiences.

Secondary: beginners who absorb how APIs combine; developers who read the generated code; people stuck on ideation.

Live spinning requires a ChatGPT account whose plan supports apps; visitors without one still get the full showcase site — gallery, replays, and creation pages.

Educational value is a welcome side effect, not the goal.

## 6. Non-goals

- A programming-education curriculum
- User accounts, social features, votes, rankings
- Breeding / lineage / rarity game systems or API character collections (fun metaphors, not mechanics)
- Generating multi-file apps or apps with their own backends
- Permanent hosting of generated apps
- Users bringing their own API keys or registering arbitrary APIs
- Production-grade generated apps or guaranteed code safety
- App Directory listing by submission time — the external review timeline is not a dependency; developer-mode connect plus the public showcase is the MVP bar

## 7. Functional requirements

### US-01 — Spin

As a player, I spin the slot to get random APIs, because the combination itself is the fun.

Acceptance criteria:

- A spin selects 2 APIs by default; with roughly 15% probability a third is added.
- The same API never appears twice in one spin.
- Each selected API shows its name, category, and a short capability description.
- The reels stop one by one — anticipation is part of the experience.
- Selection avoids: combinations identical to any of the previous 3 spins; combinations whose APIs all share one category; APIs currently marked unhealthy.

### US-02 — Concept reveal

As a player, I see what GPT-5.6 decided to invent before it is built.

Acceptance criteria:

- Shows: app name, a one-line premise, what the player will do, and how each API contributes.
- Shows a one-line causal chain of the invention (e.g. "draw a card → the card becomes a country → fetch its weather → the weather picks a radio station"). The chain itself is a punchline, and it makes every API's role visible.
- Every selected API has an essential role; decorative APIs are not allowed.
- Boring shapes are rejected before display: plain dashboards, plain search boxes, plain quizzes, plain random-fact display, thin clones of well-known apps.
- Concepts that read like a plausible startup or utility pitch are rejected as insufficiently eccentric (Creative principles, §4).
- Target: the concept appears within ~10 seconds of the spin — the first punchline must land fast.
- The player can reroll the concept without triggering a build (cheap), or proceed to build.

### US-03 — Build & run

As a player, I run the invented app for real.

Acceptance criteria:

- The generated app is a single self-contained page served at its own URL by the companion site and embedded in the ChatGPT conversation.
- It calls the real selected APIs during use.
- It has visible loading and error states, works at mobile width, and displays API attribution.
- Build progress is shown in honest, understandable stages (inventing / writing / checking / running / repairing) — no fake progress, no raw model internals.
- Target: first preview within 90 seconds of the spin.

### US-04 — Inspect

As a player, I can look under the hood.

Acceptance criteria:

- Generated source code can be viewed.
- The actual API requests made by the running app can be viewed.
- How the APIs connect (dataflow) is presented in some human-readable form.
- If a selected API was never actually used at runtime, that is flagged.

### US-05 — Failure as content

As a player, when generation fails I still get a show.

Acceptance criteria:

- No blank screens: every failure produces a Failed Creation view.
- The failure cause is stated accurately but playfully, distinguishing at least: invalid concept, broken generated code, upstream API failure, response-shape mismatch, blocked/disallowed behavior, timeout, unused API, repair failure.
- Exactly one automatic repair attempt happens before a failure is declared; repair may fix the implementation but must not change the concept.
- Failed code remains inspectable.

### US-06 — Again

As a player, I go again.

Acceptance criteria:

- **Mutate**: same APIs, different concept — history-aware, so consecutive concepts differ meaningfully.
- **Spin Again**: full re-randomization.

## 8. Experience surfaces

Requirement-level description; layout and visuals are design decisions.

1. **Slot** — logo, tagline, reels, spin control, and the honest disclaimer "Results may be useful, absurd, or broken."
2. **Concept reveal** — the invention, its API roles, Build and Reroll actions. No code is generated at this stage.
3. **Build progress** — real pipeline stages only, staged as a show; the wait is part of the act, never a silent progress bar.
4. **Live creation** — the running app plus its name, APIs used, status, entry points to code / traffic / dataflow inspection, Mutate, and Spin Again.
5. **Failed creation** — a deadpan death certificate: accurate cause of death, an epitaph, inherited traits, survival time, and a specimen number; the remains stay inspectable.
6. **Showcase site** — every creation at a permanent shareable URL; a public gallery of past successes and corpses; replays; and the entry point into ChatGPT for live spins. Zero setup for visitors.

Every generated app must permanently display an "AI-generated experimental app" notice and must never ask for passwords, personal data, or payment details (§11).

## 9. API material

### Registry policy

- Only a curated, pre-verified registry of public APIs is used — no runtime discovery of arbitrary APIs.
- Launch size: 12–18 APIs. Already satisfied by verified candidates; see Appendix A and [api-candidates/report.md](api-candidates/report.md).
- Every registry entry must be: key-free, HTTPS (or explicitly proxied), JSON, acceptable under its terms for demo use, tolerant of demo-level rate limits, and captured with at least one real example response.
- Per-API health status (healthy / degraded / disabled) must exist and be respected by selection.

### Selection behavior

- Default 2 APIs, ~15% chance of 3.
- Constraints as in US-01, plus: prefer at least one "sensory" API (visual, audio, or geo) per spin so results have presence.
- Actively prefer semantic distance between the selected APIs — the slot exists to produce collisions, not curated pairings. Kindred APIs make boring offspring.
- The visible experience is a fair slot; internal selection may weight combinations to maximize incongruity. Weighting internals are a design decision.
- Should-level: selectable moods — Stable (compatible picks), Wild (default, incongruity-weighted), Chaos (3 APIs, fewest guardrails).

## 10. Generation rules

- Concept and implementation are separately visible stages for the player (US-02 / US-03); the concept is a contract the implementation must follow.
- All selected APIs are essential, and at least one API's output must influence another API call, the app's rules, or the interface state — never just parallel display.
- The player must have something to do (input, choice, or manipulation); purely passive display is rejected.
- A first-time player should understand the generated app within about 30 seconds.
- The app's name and copy follow the collision-naming principle (§4); its visual direction must commit to one extreme aesthetic. "Clean minimal SaaS" is banned as a style — the generic default look of AI-generated frontends is treated as a defect.
- Novelty pressure: the history of previous concepts for the same combination is used to avoid repeats.
- One repair attempt maximum (US-05).
- In-product model: GPT-5.6 performs invention, implementation, and repair — running in the executing user's own ChatGPT session, on their plan. Randomware's server referees: it validates artifacts, counts repair attempts, and refuses anything beyond the single-repair limit.

## 11. Safety requirements

Threat framing: the product intentionally runs freshly AI-generated code in visitors' browsers, so containment is a feature requirement, not an afterthought.

- Generated code must not be able to read or manipulate the host page, cookies, or storage.
- Generated code must not reach any network destination other than the selected, registry-approved API endpoints, via a mediated channel controlled by the host.
- Attempts to do otherwise must be blocked and surfaced as a failure cause.
- Per-creation limits are required: execution time, request count, and response size.
- Generation cost lands on the executing user's ChatGPT plan, so the owner's wallet is structurally out of the runtime path. Abuse control is still required for what the owner does host: per-user and global caps on creation storage/serving and on proxied public-API traffic, degrading gracefully (never a raw error).
- API responses must be treated as untrusted content when rendered, and as untrusted text wherever they enter a model prompt — public API data can contain user-submitted or adversarial content (e.g. Radio Browser station names are community-edited).
- No secrets may ship to the browser; there is nothing for users to configure or leak.
- Every creation displays the AI-generated notice and a "do not enter real personal or payment data" warning.
- Accepted residual risk (explicit): this is a short-lived experimental toy, not a hardened code sandbox. The mediation and containment above are the bar; formal sandbox completeness is not.

## 12. Success metrics

- A first-time visitor, unassisted, completes spin → concept → run → interact → respin within 3 minutes.
- Spin-to-concept-reveal ≤ 10 seconds and spin-to-first-preview ≤ 90 seconds (targets).
- ≥ 70% of 2-API creations boot to an interactive state.
- ≥ 80% of booted creations actually call every selected API at runtime.
- 0 network requests to unapproved hosts from generated code.
- 100% of failures produce an explanatory Failed Creation view.
- ≥ 5 API combinations verified end-to-end before submission; the same combination demonstrably yields different concepts.
- Pre-submission eccentricity check: if a majority of sampled concepts could pass for sincere startup pitches, generation is tuned too safe and must be retuned.
- Explicit non-goal: a 100% success rate. If nothing ever fails, the guardrails are too tight.

## 13. Build constraints (the meta-challenge)

The way Randomware is built mirrors what it does, and this is part of the submission story:

1. This PRD is written before any technical design or code.
2. One GPT-5.6 Sol session (high reasoning effort) converts the PRD into the full technical design and implementation plan — documents only, no code: `ARCHITECTURE.md`, `PLAN.md`, `ACCEPTANCE.md`, `BUDGET.md`, `GOAL.md`.
3. The session model is switched to GPT-5.6 Luna (max reasoning effort), and the implementation is executed as a single Codex `/goal` run driven by `GOAL.md`.
4. The majority of core functionality must be implemented in that one Codex session; its `/feedback` Session ID is part of the submission.
5. Hard budget: the $100 credit grant covers the Codex build (design pass + implementation session). Runtime generation is billed to each executing user's own ChatGPT plan, and development-time test spins run on the owner's own ChatGPT plan (recorded in `BUILD_LOG.md`), so no API-key spend is expected — any that does occur counts inside the $100. Post-submission public usage is out of scope. Auto-recharge stays off. Hosting must add zero incremental cost — a free tier or a service already bundled in an existing plan; paid hosting is out. A reserve must be protected for deployment fixes, README completion, verification, and demo recording; concrete stop conditions live in `BUDGET.md`.
6. The finished product must be publicly deployed; judges must be able to play without local setup.

## 14. Reserved for the technical design pass

The design pass must decide — and this PRD deliberately does not: overall architecture, framework, and hosting; the exact containment and API-mediation mechanism; static and runtime validation strategy; prompt and output-schema design for concept, code, and repair; streaming/progress mechanics; persistence (session-only vs stored); registry data model and health-check tooling; selection weighting internals; test strategy including golden fixtures and a fallback demo mode; budget allocation and stop conditions; the `GOAL.md` contract; repository layout; the MCP server and tool choreography (how tool descriptions steer the user's model through concept → build → single repair); the widget architecture and CSP declaration (`connectDomains` for the API registry, `frameDomains` for the companion site); creation storage and serving on the companion site; and the early feasibility spike covering the four undocumented Apps SDK risks (tool-argument size for full HTML artifacts, CSP allowlist reliability, widget audio playback, nested-frame embedding of the companion site).

Constraint on the design pass itself: produce documents only. Application code belongs exclusively to the single Codex `/goal` session.

## 15. Scope (MoSCoW)

**Must**: ≥10 verified APIs; 2-API spin with occasional 3; slot experience in the ChatGPT widget; concept and single-page app generation by the user's own GPT-5.6 session; contained execution with a platform-enforced API allowlist; creation pages served at shareable URLs by the companion site; pre-run and runtime checks with server-side repair-attempt limits; single auto-repair; success and failure result views; source view; API traffic view; Mutate; Spin Again; public showcase deployment; judge connect instructions (developer mode); README; demo video; `/feedback` Session ID.

**Should**: Stable / Wild / Chaos moods; dataflow visualization; session-local history; seeded reproducibility; streamed build progress; pre-verified demo combinations with an offline demo mode; a staged "chaos spin" fanfare for rare 3-API spins; a basic showcase gallery of past creations (masterpieces and corpses).

**Could**: favorites, screenshots, curated failed-creation collections, daily combination; a "twist" modifier reel (an injected external constraint such as a tone or genre — held in reserve as an anti-convergence lever only if testing shows concepts becoming samey; the default belief is that eccentricity must come from the API collision itself).

**Won't**: accounts, payments, arbitrary user APIs, exporting generated apps to production, multi-file or native generation, long-running autonomous agents.

## 16. Submission Contract

The project is not complete until every requirement in this section is satisfied.

### 16.1 Working project

- A publicly accessible deployed version of Randomware is available.
- Judges can reach the experience two ways, both documented in the README: (a) the public showcase site — gallery, replays, and creation pages — with zero setup; (b) live spins by connecting the ChatGPT app (developer-mode MCP connect) via copy-paste instructions.
- The primary flow (spin → concept → build → run → inspect → spin/mutate again) works end-to-end in a real ChatGPT session.
- At least five API combinations tested end-to-end before submission.
- Failures produce the intentional Failed Creation view, never a blank or broken interface.

### 16.2 Category

Submit under **Apps for Your Life**. Randomware is a consumer-facing creative toy; educational value is secondary and is not the category justification.

### 16.3 Project description

Must clearly explain: what Randomware is; what happens on a spin; how APIs are selected; how GPT-5.6 invents and implements each app; how generated code is validated and executed safely; why fixed templates could not reproduce this; why failed creations are deliberately part of the experience; and why deliberate uselessness is the point — the project's creative answer to AI slop and hallucination.

### 16.4 Demo video

- Public YouTube video, under 3 minutes, showing the real deployed application.
- Spoken audio must explicitly cover both Codex and GPT-5.6 — text overlays alone are not sufficient.
- Must show: a spin; the selected APIs; GPT-5.6 generating an original concept; the generated app running and being used; real API traffic or the dataflow view; a second spin or mutation proving results are not predetermined.
- Must state: where Codex accelerated development; which decisions were made by a human; how GPT-5.6 Sol was used for design and GPT-5.6 Luna for implementation; the $100 budget constraint; that the majority of core functionality was completed in one Codex `/goal` session.

### 16.5 Code repository

- Public GitHub repository with an MIT license (already in place).
- No API keys, credentials, private logs, or secrets committed.
- Final PRD, architecture, plan, acceptance criteria, budget plan, build log, and demo script are all in `docs/`.
- Meaningful commit history through the competition period is preserved; the submitted version is tagged or clearly identified.

### 16.6 README

Must include: product overview; elevator pitch; screenshots or an animated demo; deployed showcase URL; ChatGPT app connect instructions (developer mode); architecture overview; requirements and supported environment; local setup; required environment variables; development, test, build, and deployment commands; API registry explanation; sample combinations; known limitations; the security model for generated apps; clear instructions for judges; license.

Must also contain a dedicated section titled **Built with Codex and GPT-5.6** explaining: the PRD came first; GPT-5.6 Sol (high effort) produced the technical design; GPT-5.6 Luna (max effort) executed the main `/goal` implementation; what Codex implemented; which decisions required human direction; how Codex accelerated the work; how GPT-5.6 is used inside the finished product; how the build stayed within the $100 allowance.

### 16.7 Codex session evidence

- The majority of core functionality is implemented in a single primary Codex `/goal` session; the main implementation is not split across sessions unnecessarily.
- After core functionality is complete, `/feedback` is run from that session; the Session ID is recorded in `docs/BUILD_LOG.md` and in a private submission note, and entered into the Devpost form.
- Relevant Codex logs or screenshots demonstrating the build process are kept. No secrets or private chain-of-thought content is published.

### 16.8 Build log

`docs/BUILD_LOG.md` records: the competition start point; initial repository state; PRD completion; the Sol design session; the Luna `/goal` implementation session; major milestones; important human decisions; tests and browser verification performed; deployment result; credit usage at major checkpoints; the final `/feedback` Session ID; known incomplete or reduced-scope items.

### 16.9 Budget constraint

- The entire submission-ready project is completed within the $100 credit allowance (the Codex design pass and implementation session; any API-key model spend during development also counts — expected to be zero, since generation runs on ChatGPT plans).
- Post-submission public usage is excluded.
- Stop conditions: feature work stops when the remaining budget reaches the reserved submission amount; the reserve is spent only on broken acceptance criteria, deployment, or submission blockers — never on optional polish. Final usage is recorded in `docs/BUDGET.md`.

### 16.10 Final acceptance

The primary Codex goal must not report completion until: the deployed app is reachable; the primary flow works in a real browser; required automated tests pass; at least five API combinations are manually verified; a failed generation is handled correctly; the repository is accessible and licensed; the README is complete including the Codex/GPT-5.6 section; the demo script and project description are ready; the elevator pitch fits the form's character limit; the `/feedback` Session ID is obtained and recorded; no submission-blocking requirement remains.

## Appendix A — Verified API candidates (2026-07-18)

Full verification data, fixtures, and rejection reasons: [api-candidates/report.md](api-candidates/report.md).

Primary set (17), rebalanced for collision value on 2026-07-18: Deck of Cards (games/state), PoetryDB (text/culture), Datamuse (words), Art Institute of Chicago (art/images), Open Library (books), REST Countries (geo/knowledge), Dog CEO (images/animals), Radio Browser (audio/realtime), Open-Meteo (weather/geo), Frankfurter (currency), Advice Slip (text/playful), PokéAPI (game characters/rich data), RandomUser (identity/persona), Wikipedia On This Day (history), USGS Earthquakes (realtime/geo), TheMealDB (food/images), iTunes Search (music/audio previews).

Backup set (14): Met Museum, Zippopotam, Nager.Date, TVMaze, Cat Facts, Useless Facts, xkcd (proxy-only), Bored API (proxy-only), Where The ISS At (9–10s latency — demo-path risk), Open Trivia DB (demoted: invites the banned plain-quiz shape), Sunrise-Sunset (demoted: thin data), TheCocktailDB, Free Dictionary API, Open Notify people-in-space (HTTP-only, proxy-only).

Rejected (4): Numbers API (no HTTPS), Quotable (TLS failure), Jikan (persistent 504), wttr.in (wrong content type, overload-prone).

## Appendix B — 3-minute demo outline

- 0:00–0:20 — Problem framing: "Most AI app builders begin with an idea. Randomware begins with no idea at all."
- 0:20–0:45 — Spin; the reels land on 2–3 APIs.
- 0:45–1:10 — GPT-5.6's invented concept; how the APIs connect.
- 1:10–1:50 — Build It; the generated app boots; the player uses it; real APIs respond.
- 1:50–2:15 — Under the hood: source, requests, dataflow.
- 2:15–2:35 — Spin again; a completely different result.
- 2:35–2:50 — A Failed Creation: "Sometimes it creates an app. Sometimes it creates a corpse."
- 2:50–3:00 — Close: "Real APIs go in. Random apps come out."
