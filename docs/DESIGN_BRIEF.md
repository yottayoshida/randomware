# Technical Design Brief — input for the GPT-5.6 Sol design pass

You are running the one-time technical design pass for Randomware. Your output is the complete technical design and implementation plan that a later, single Codex `/goal` session (executed by GPT-5.6 Luna at max reasoning effort) will implement without renegotiation.

## Read first

- [PRD.md](PRD.md) — the product contract, including §16 Submission Contract. Do not renegotiate it.
- [api-candidates/report.md](api-candidates/report.md), [api-candidates/results.tsv](api-candidates/results.tsv), and [api-candidates/samples/](api-candidates/samples/) — live-verified API data with real response fixtures.

## Deliverables

Write exactly these five documents, in English. Documents only — see Hard constraints.

1. **`docs/ARCHITECTURE.md`** — answer every question reserved in PRD §14: overall architecture, framework, hosting; the exact containment and API-mediation mechanism for generated apps; static and runtime validation strategy; prompt and output-schema design for concept, code, and repair; streaming/progress mechanics; persistence; registry data model and health-check tooling; selection weighting internals; repository layout. Include a threat-model section that satisfies PRD §11.
2. **`docs/PLAN.md`** — a milestone-ordered implementation plan sized for one Codex `/goal` session: vertical slice first (spin → concept → generate → run, minimal registry), then the safe runtime, then the product experience, then API expansion, then submission artifacts (README completion, `BUILD_LOG.md` updates, `DEMO_SCRIPT.md`, deployment). Every milestone states its scope, its verification command(s), and its done-criteria.
3. **`docs/ACCEPTANCE.md`** — acceptance criteria mapped to PRD §7, §12, and §16.10, split into machine-checkable (commands) and manual (browser) checks.
4. **`docs/BUDGET.md`** — allocation of the 2,500-credit ($100) grant with hard stop conditions per PRD §13.5 and §16.9, and a usage-checkpoint table to be filled in during the build. Suggested split from the preparation phase, adjustable with justification: design ≈ 300 credits, implementation ≈ 1,400, generation testing ≈ 500, final reserve ≈ 300.
5. **`docs/GOAL.md`** — the execution contract for the single `/goal` run: required reading list, ordered milestones referencing `PLAN.md`, verification requirements including real-browser end-to-end proof, deployment, the no-scope-expansion rule, budget stop conditions, and the mandatory final stop point: stop and ask the human to run `/feedback` and record the Session ID in `BUILD_LOG.md`.

## Hard constraints

- **Documents only.** Do not write application code, scaffolding, configuration files, or package manifests. Code belongs exclusively to the later single Codex `/goal` session.
- Do not expand or shrink PRD scope. Must items stay Must; Won't items stay out.
- Design for the executor: GPT-5.6 Luna is a high-volume model, so instructions must be explicit, unambiguous, and checkpointed with verifiable commands. Ambiguity in your documents becomes wasted credits in the build.
- The in-product model is GPT-5.6 (concept invention, code generation, repair). API keys live server-side only.
- Use the verified API data as the registry basis. If you drop or add an API, record the reason. Respect the ISS latency finding (report.md).
- Every generated-app network pathway goes through the mediated, registry-limited channel (PRD §11).
- When finished, commit the five documents to `main` with a clear commit message.

## Notes

- The `/goal` message itself is limited to 4,000 characters; `GOAL.md` carries the detail and the `/goal` message only points to it.
- `DEMO_SCRIPT.md` is not your deliverable; `PLAN.md` assigns it to the final milestone of the implementation session.
- **Hosting candidate — ChatGPT Sites.** Sites (Codex's hosted app platform, public beta since June–July 2026) is the preferred deployment target for narrative coherence: Codex writes the code and Codex hosts it, and no third-party deploy auth is needed. Confirmed from the official docs: hosted environment variables/secrets, public publishing ("anyone on the internet"), and deployment from a compatible local project. Unconfirmed and deal-breaker-class: (a) whether the hosted backend can make outbound requests to arbitrary public API hosts — the mediation proxy needs ~17 upstreams, one of them HTTP-only; (b) streaming/SSE support for build progress; (c) beta usage limits under judge traffic. `ARCHITECTURE.md` must decide Sites vs a conventional host (e.g. Vercel). Hard constraint either way: hosting must add zero incremental cost — a free tier (e.g. Vercel Hobby) or a service bundled in an already-paid plan (Sites during beta); paid hosting plans are out (PRD §13.5). If Sites is chosen, the first deployment milestone in `PLAN.md` must be a cheap feasibility spike proving secret-backed OpenAI calls, arbitrary-host egress, and public access — and verifying whether Sites usage is metered against the same credit pool as the Codex build (if so, that consumption counts inside the $100 and `BUDGET.md` must account for it) — with a documented fallback path to the conventional host.

## Appendix — planned `/goal` message (for the later Luna session, verbatim draft)

```
/goal Implement GOAL.md. Read docs/PRD.md, docs/ARCHITECTURE.md, docs/PLAN.md, docs/ACCEPTANCE.md, and docs/BUDGET.md before changing code. Complete the MVP without expanding scope, create and run the required tests at every milestone, verify the full demo flow in a real browser, deploy a working public version, and stop only when every Must acceptance criterion passes or the documented budget stop condition is reached.
```
