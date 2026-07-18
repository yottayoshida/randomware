# Technical Design Brief — input for the GPT-5.6 Sol design pass

You are running the one-time technical design pass for Randomware. Your output is the complete technical design and implementation plan that a later, single Codex `/goal` session (executed by GPT-5.6 Luna at max reasoning effort) will implement without renegotiation.

## Read first

- [PRD.md](PRD.md) — the product contract, including §16 Submission Contract. Do not renegotiate it.
- [api-candidates/report.md](api-candidates/report.md), [api-candidates/results.tsv](api-candidates/results.tsv), and [api-candidates/samples/](api-candidates/samples/) — live-verified API data with real response fixtures.
- The official Apps SDK documentation at https://developers.openai.com/apps-sdk — especially `build/mcp-server`, `build/chatgpt-ui` (widget CSP: `connectDomains` / `resourceDomains` / `frameDomains`), and `reference` (the `window.openai` API). The product ships as a ChatGPT app + companion site (PRD §3).

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
- **Product shape (decided by the owner, 2026-07-18): hybrid.** A ChatGPT app (Apps SDK) runs spin + generation on the executing user's own plan, refereed by Randomware's MCP tools; a companion site serves each creation at a shareable URL (declared in the widget's `frameDomains`), sandboxes execution, and doubles as the public showcase. Hosting for both the MCP server and the site must add zero incremental cost — free tiers (e.g. Vercel Hobby, Cloudflare) or services bundled in an already-paid plan (ChatGPT Sites beta, which offers hosted secrets and D1/R2 storage); paid hosting plans are out (PRD §13.5).
- **Mandatory first implementation milestone: a feasibility spike** proving (a) a full single-file HTML artifact passes through tool arguments at realistic size (10–40KB), (b) `connectDomains` actually permits the registry's upstream hosts from the widget — community reports exist of the CSP allowlist being ignored, (c) audio playback works in the widget or in the nested frame (Radio Browser streams, iTunes previews), (d) the companion-site origin embeds via `frameDomains`. Documented fallbacks, in order: DOM-injection execution inside the widget if nested frames fail; link-out to the creation URL if embedding fails entirely; the external-site + owner-key + strict-caps architecture only as a last resort requiring the owner's sign-off.

## Appendix — planned `/goal` message (for the later Luna session, verbatim draft)

```
/goal Implement GOAL.md. Read docs/PRD.md, docs/ARCHITECTURE.md, docs/PLAN.md, docs/ACCEPTANCE.md, and docs/BUDGET.md before changing code. Complete the MVP without expanding scope, create and run the required tests at every milestone, verify the full demo flow in a real browser, deploy a working public version, and stop only when every Must acceptance criterion passes or the documented budget stop condition is reached.
```
