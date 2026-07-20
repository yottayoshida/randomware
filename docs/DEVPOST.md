# Devpost submission content (working copy)

Prepared 2026-07-21. Paste-ready content for the Devpost form.

## Project name

Randomware

## Elevator pitch

A slot machine for software: spin real public APIs, and GPT-5.6 invents a working app from the collision in real time. No templates—every result is a unique invention, receipts intact.

## About the project

## Inspiration

The name comes from a Japanese band — Omoide Hatoba, "Memory Wharf" — made by welding two stock sentimental words into something that belongs to neither. I wanted to do the same thing with APIs: force two unrelated public data sources together and see what connection a model invents when no human gave it an idea.

The creative bet is that this is the right way to answer AI slop. Slop is what happens when generation optimizes for plausible usefulness. Randomware optimizes for the opposite: implausible, singular existence. And hallucination — confidently inventing connections that don't exist — becomes the entire point, except the invention has to run as working software against real data. Grounded confabulation, with receipts.

The product rules enforce the stance. A concept that a reasonable PM could pitch without irony is a rejected concept. Generated apps play it completely straight — the comedy lives in the gap between the absurdity of the premise and the sincerity of the execution. Only Randomware's own chrome provides the dry commentary: build narration, failure reports, and death certificates for specimens that didn't make it.

## What it does

Randomware is a slot machine for software. A spin selects 2–3 real public APIs from a 20-entry health-gated registry — weighted toward the most dissimilar pairings — plus one of eight visual style cartridges (Paper Certificate, Video Game HUD, Teletext Dispatch, VHS Jacket…). The player's own GPT-5.6 session then invents a structured concept — causal chain, API roles, one observable dependency, a banned-shape self-assessment — and submits a complete single-page app. One bounded repair attempt is allowed.

Accepted specimens run in an opaque `sandbox="allow-scripts"` iframe. The generated app can call only its selected operations through a server-side broker; every other network primitive is blocked by a static validator before the HTML is even accepted. Source code, mediated request logs, and dataflow records are inspectable on every specimen page. Failed specimens get an honest death certificate that states the accurate cause — and both failed revisions remain readable.

The same two APIs can yield wildly different apps. "Deck of Cards × Dog CEO" produced *Pawns & Paws* — a board game where drawn cards set movement rules for summoned dog pawns, with every press fetching a fresh card and a fresh dog through the broker. Every spin is a first contact.

## How I built it

The build mirrors the product's constraint: everything must have receipts.

- **$100 budget, honestly metered.** One ChatGPT Plus subscription (weekly Codex allowance) plus the $100 Build Week credit grant (2,500 credits). GPT-5.6 Sol wrote the five design documents — architecture, plan, acceptance criteria, budget contract, and a single goal file. Then GPT-5.6 Luna executed one `/goal` implementation session. After repeated real-client defects (13+ bugs reproduced only by external probes, not by the project's own test gates), I escalated the same session to GPT-5.6 Sol for the final contract-coherence pass. Every meter checkpoint from 2,500 down to 148 is transcribed in the build log. Auto top-up stayed off the entire time.
- **No owner API key at runtime.** Generation, repair, and re-steering all run in the player's own ChatGPT session via an Apps SDK (MCP) connector. The server is a Cloudflare Worker + D1 on the free tier — zero incremental hosting cost.
- **Containment first.** A static validator blocks fetch, XHR, WebSocket, eval, storage, parent/top access, credential fields, external URLs, and 15 other pattern classes before the artifact is accepted. A short-lived HMAC-signed capability lets the app call only its selected operations. Upstream data is bounded, attributed, and rendered as untrusted text. PRD preparation used Claude Code, before and outside the Codex budget; this is disclosed in the build log.

## Challenges

**The tests lied — repeatedly.** The hardest class of bugs was invisible to every machine gate. Synthetic test drivers stayed green while real ChatGPT clients failed, because the drivers mirrored the implementation's own assumptions rather than the real client's behavior. The runtime data contract was the first case: generated apps were never told what shape `window.randomware.call` returns, so they guessed wrong — and the synthetic driver guessed the same wrong way. I found four distinct classes of this "self-mirroring" failure, each discovered only by external curl probes against the deployed surface.

**The broker cache had no expiration.** The build log documented a "5-minute TTL." The code had a plain `Map` with no timestamp. Every API response was frozen for the life of the Worker isolate. Dog CEO's `/random` returned the same dog forever. This was discovered during demo recording when I noticed that pressing "draw again" never changed the picture.

**The platform fought back.** ChatGPT's safety layer intermittently swallowed parameterized tool calls — an acknowledged platform issue. Instead of fighting it, I leaned into honest choreography: server-side idempotency so interrupted calls can be safely repeated, widget-owned deadlines with a single bounded auto-nudge, and real timeouts that produce a death certificate instead of fake progress. Two consecutive mutation calls were blocked during the acceptance ceremony; the exact payload is preserved in the conversation as evidence.

**The spin guard that worked everywhere except production.** Three consecutive Codex repair rounds produced a widget Spin-button guard that passed every local and fixture test but remained permanently disabled in real ChatGPT. The root cause was never identified — the widget code was proven correct in every reproducible environment. After the third round, with credits at the reserve floor, I removed the phase-based guard entirely and kept only the in-flight-only guard that cannot structurally get stuck. Recorded as a known limitation and a process lesson about irreproducible platform behavior.

## What I learned

I ran an acceptance protocol of 10 consecutive fresh spins — no discards, no restarts, failures counted. All 10 booted and produced real broker traffic from every selected API. Both timing targets were honestly missed: median concept time 81.5 seconds (target: 10), median spin-to-preview 5.4 minutes (target: 90 seconds). Real invention is slower than a template. The contract says timing misses don't trigger tuning unless the core flow is broken — and 10/10 boot with zero stalls meant the core flow held.

The biggest surprise was that honesty became the product's strongest feature. Recorded failures, visible autopsies, truthful meters, and a build log that hides nothing — including the self-mirroring bugs, the cache lie, and the platform fights — turned out to be what makes the strange results trustworthy. When a specimen says it used Dog CEO and Frankfurter, the broker log proves it. When it dies, the death certificate says why.

Final balance: **148 credits remaining** out of 2,500. The [build log](https://github.com/yottayoshida/randomware/blob/main/docs/BUILD_LOG.md) is the other half of this submission.

## Built with (tags)

javascript, node.js, cloudflare-workers, cloudflare-d1, chatgpt, apps-sdk, mcp, gpt-5.6, codex, openai, rest-api, web-audio

## Try it out links

- https://randomware.randomware.workers.dev/
- https://github.com/yottayoshida/randomware

## Video demo link

https://youtu.be/V86lJeaDVpg
