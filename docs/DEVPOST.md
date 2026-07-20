# Devpost submission content (working copy)

Prepared 2026-07-20. Paste-ready content for the Devpost form. The video link is added last.

## Project name

Randomware

## Elevator pitch (≤200 chars)

Randomware turns 2–3 public APIs into a brand-new GPT-5.6 app—or an honest, inspectable failure. Real APIs go in; random apps come out.

## About the project

## Inspiration

Randomware comes from collision aesthetics: when two things that share nothing are forced together, the result is something no human would have planned. We wanted to aim that at the AI-slop problem from the opposite direction — instead of asking a model to be plausibly useful, we make it invent a connection nobody requested, then hold that invention accountable with real data, real limits, and a real cause of death when it fails. Deliberate uselessness, with receipts.

## What it does

Randomware is a slot machine for software. A spin selects 2–3 bounded public APIs from a health-gated registry (seeded draw, no repeats of recent combos, weighted toward the most dissimilar pairings). Your own GPT-5.6 session then invents an eccentric concept, submits a complete single-page app, and gets exactly one repair attempt. The result is either a working creation or an honest, fully inspectable failure — both are published as specimens with source, mediated request logs, dataflow records, and a death certificate when things go wrong.

## How we built it

The build followed a deliberately constrained protocol, fully documented in [docs/BUILD_LOG.md](https://github.com/yottayoshida/randomware/blob/main/docs/BUILD_LOG.md):

- **Budget: one ChatGPT Plus subscription ($20/mo, weekly Codex allowance) + the $100 Build Week Codex credit grant (2,500 credits).** Design docs were written by GPT-5.6 Sol (high reasoning), then the entire implementation ran as a single Codex `/goal` session on GPT-5.6 Luna. Every meter checkpoint is transcribed in the build log; auto top-up stayed off. PRD preparation used Claude, before and outside the Codex budget, and is disclosed in the log.
- **Runtime: no owner model key.** Generation, repair, and re-steering all run in the player's own ChatGPT session via an Apps SDK (MCP) connector. The server is a Cloudflare Worker + D1 on the free tier — zero incremental hosting cost.
- **Containment first.** Generated HTML runs only in an opaque `sandbox="allow-scripts"` iframe. A static validator blocks network primitives and unsafe sinks; a short-lived signed capability lets the app call only its selected operations through a server-side broker. Upstream data is bounded, attributed, and rendered as untrusted text.

## Challenges

The hardest bugs were the ones our own tests could not see: machine gates stayed green while real ChatGPT clients failed, because synthetic drivers mirror the implementation's assumptions. External probes against the deployed surface found the real-client contract gaps. The platform itself was the other adversary — intermittent safety-layer swallowing of parameterized tool calls (an acknowledged platform issue) shaped the choreography: server-side idempotency, widget-owned deadlines, one bounded auto-nudge, and honest timeouts instead of fake progress.

## What we learned

An owner acceptance protocol of 10 consecutive fresh spins (no discards) finished 10/10 booted with zero stalls, every selected API confirmed by real broker traffic — and both timing targets honestly missed (median spin-to-preview ~5.4 minutes; model composition time is the price of real invention). Honesty turned out to be the best product decision: recorded failures, visible autopsies, and truthful meters are what make the strange results trustworthy.

## Built with (tags)

javascript, node.js, cloudflare-workers, cloudflare-d1, chatgpt, apps-sdk, mcp, gpt-5.6, codex, openai, rest-api, web-audio

## Try it out links

- https://randomware.randomware.workers.dev/
- https://github.com/yottayoshida/randomware

## Video demo link

https://youtu.be/V86lJeaDVpg
