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

### Planned next steps

1. GPT-5.6 Sol (high reasoning effort): technical design pass producing `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/ACCEPTANCE.md`, `docs/BUDGET.md`, `docs/GOAL.md`. Documents only — no code.
2. Switch the session model to GPT-5.6 Luna (max reasoning effort) and run the single Codex `/goal` implementation session driven by `GOAL.md`.
3. Record credit usage at each checkpoint in `BUDGET.md`; after core functionality is complete, run `/feedback` in the implementation session and record the Session ID here.
