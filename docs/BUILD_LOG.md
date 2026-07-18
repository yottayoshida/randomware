# Build Log

Chronological record of how Randomware is being built, kept for the OpenAI Build Week submission. Newest entries last.

## 2026-07-18 — Preparation (before the Codex build)

- Product direction consolidated into [PRD.md](PRD.md). No technical design decisions were made; everything architectural is explicitly reserved for the design pass (PRD §14).
- 29 candidate public APIs verified with live requests ([api-candidates/report.md](api-candidates/report.md)). 15 primary + 9 backup adopted; 4 rejected (no HTTPS, TLS failure, persistent 504, wrong content type). Real response bodies and headers captured under `api-candidates/samples/` as fixture material.
- Repository created: public, MIT licensed.
- Tooling disclosure: this preparation step (PRD authoring and API verification) was done with Claude Code, before and outside the $100 Codex budget. No application code was written during preparation.
- Design-pass brief added ([DESIGN_BRIEF.md](DESIGN_BRIEF.md)): the instruction document handed to the GPT-5.6 Sol design session, so the design pass starts from a single "read this and execute" prompt.

## 2026-07-18 — Product shape decision (pre-design)

- Owner decision: generation must be billed to the executing user's own ChatGPT plan, not the owner's API key. Verified against current platform capabilities: an external-web "sign in with ChatGPT and bill the user's plan" API is not shipped (feature-request stage); the Apps SDK is the shipped mechanism.
- Product shape fixed as **hybrid**: a ChatGPT app (Apps SDK — spin + generation, refereed by MCP tools) plus a companion showcase site (creation URLs, sandboxed execution, gallery). PRD and design brief updated accordingly.
- Four undocumented Apps SDK risks moved into a mandatory first-milestone spike: tool-argument size for HTML artifacts, widget CSP allowlist reliability, audio playback, `frameDomains` embedding of the companion site.

## 2026-07-18 — Adversarial feasibility review (pre-design)

- An independent adversarial review (a fresh Claude subagent with no shared conversation context, verifying platform claims against official docs) audited the PRD and design brief for design-pass readiness. Verdict: NOT READY — 1 P0, 7 P1, 8 P2, 5 P3 findings. Every finding was individually verified by the orchestrator and all were accepted; none were vacuous.
- Headline corrections applied: containment enforcement restated as the owner's proxy + per-surface CSP (a widget CSP cannot govern creation pages — the P0); the DOM-injection fallback prohibited (it would expose `window.openai` to generated code); creation retention defined (through the judging window, no commitment beyond); choreography non-compliance made a first-class failure with a widget-owned timeout; model-pinning claims removed (choreography must be model-agnostic); a UGC publication policy added (password/payment-input rejection, owner-controlled chrome with report link, curated gallery, instant unpublish); an audio/media exception defined (mediation-resolved stream URLs only); registry policy extended to secondary asset domains and provider demo keys; latency/quality metrics scoped to the owner's demo environment; per-upstream API budgets added; judge instructions now state developer-mode plan prerequisites; pre-authorized descopes added to §15 (link-out as the Must bar, raw traffic list, minimal showcase index); demo outline re-timed to ≤2:50.
- Correction to earlier entries: "29 candidate APIs, 15 primary + 9 backup" reflects round 1 only; after round 2 the totals are 35 APIs across 36 checks, 17 primary + 14 backup, 4 rejected.

## 2026-07-18 — Design phase closed; budget checkpoints recorded

- Sol design phase complete: five design documents (`afa3995`) plus three bounded addenda — incremental reading requirements (`b655361`), 18-entry launch registry (`3a7f05e`), and independent review checkpoints (`e347087`).
- Meters at design end, owner-transcribed from Codex Settings > Usage at 2026-07-18 11:21 JST: plan usage 33% of the weekly limit (ChatGPT Plus), grant credit balance 2,500 — untouched (credit delta 0). Codex consumes plan-included usage before grant credits, so the design phase cost plan quota only. The baseline plan percentage before the design session was not captured; recorded as an honest omission.
- Auto top-up is off and Codex is signed in with ChatGPT (owner-confirmed). The Luna `/goal` implementation run starts from this snapshot in the same primary session.

### Planned next steps

1. GPT-5.6 Sol (high reasoning effort): technical design pass producing `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/ACCEPTANCE.md`, `docs/BUDGET.md`, `docs/GOAL.md`. Documents only — no code.
2. Switch the session model to GPT-5.6 Luna (max reasoning effort) and run the single Codex `/goal` implementation session driven by `GOAL.md`.
3. Record credit usage at each checkpoint in `BUDGET.md`; after core functionality is complete, run `/feedback` in the implementation session and record the Session ID here.
