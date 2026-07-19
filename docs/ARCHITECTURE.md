# Randomware Technical Architecture

Status: implementation contract
Date: 2026-07-18
Product contract: [PRD.md](PRD.md)

## 1. Decisions at a glance

Randomware is one TypeScript repository deployed as one Cloudflare Worker with Static Assets and D1. The Worker exposes the remote MCP endpoint, the companion site, the creation-serving routes, the registry-limited API broker, health checks, and storage. The ChatGPT widget and companion-site bundles are built with React and Vite and served from the same deployment origin.

The implementation uses:

- TypeScript in strict mode, Node.js 22 for local tooling, npm workspaces, React 19, Vite, Vitest, Playwright, Zod, `parse5`, and `acorn`.
- `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, and Cloudflare's `agents` package with the web-standard `createMcpHandler` for stateless Streamable HTTP on `/mcp`.
- Cloudflare Workers Static Assets for the widget/site bundles, D1 for durable records, Worker Cache API for cacheable API responses, and a Cron Trigger for health checks.
- Cloudflare Workers Free and D1 Free for production. The implementation must not enable a paid plan. Free-tier limits are application limits, not capacity targets.
- The companion origin as the only production `connectDomains` entry. The widget also declares that same companion origin in `frameDomains` for the owner-authorized embedding retest; link-out through `window.openai.openExternal` remains the fallback. The bounded ancestor allowlist used by both companion documents is `https://chatgpt.com https://chat.openai.com https://web-sandbox.oaiusercontent.com https://*.web-sandbox.oaiusercontent.com`; the single subdomain wildcard is required because ChatGPT inserts a connector-specific sandbox ancestor, and the owner records the real-client result.

This is a deliberately server-refereed architecture. There is no owner model call, OpenAI API key, arbitrary-URL proxy, dynamic package installation, user account, or generated backend.

Current source constraints are grounded in the official Apps SDK documentation: the [MCP server guide](https://developers.openai.com/apps-sdk/build/mcp-server), [ChatGPT UI guide](https://developers.openai.com/apps-sdk/build/chatgpt-ui), [Apps SDK reference](https://developers.openai.com/apps-sdk/reference), [state guide](https://developers.openai.com/apps-sdk/build/state-management), [security guide](https://developers.openai.com/apps-sdk/guides/security-privacy), and [deployment guide](https://developers.openai.com/apps-sdk/deploy).

## 2. Overall architecture, system boundaries, and deployment

```text
ChatGPT model (the player's own session)
  |  chooses/calls schema-bound MCP tools
  v
Cloudflare Worker /mcp -------------------------------+
  | validates and persists                             |
  v                                                    |
D1: runs, concepts, artifact revisions, health, logs   |
                                                       |
ChatGPT widget iframe                                  |
  | window.openai.callTool / sendFollowUpMessage       |
  | fetches only Randomware status routes              |
  +--------------------> Cloudflare Worker             |
                              |                        |
                              +--> companion /c/:id    |
                              |      |                 |
                              |      v                 |
                              |   sandboxed /run/:id   |
                              |      | randomware.call |
                              |      v                 |
                              +--> operation broker ---+
                                     |
                                     v
                              fixed registry upstream
```

### 2.1 ChatGPT app

The MCP server has no authentication because the product has no accounts and every tool is bounded to Randomware data. It still validates all arguments and signed run contracts. The server provides initialization instructions, explicit tool descriptions, Zod input/output schemas, required MCP annotations, and one widget resource.

The widget is one persistent state machine mounted by `open_randomware`. Subsequent tool calls are data-only; they do not remount the widget. The widget uses `window.openai.callTool` for direct UI actions, `window.openai.sendFollowUpMessage` to ask the user's model to produce concept/code/repair tool calls, `window.openai.setWidgetState` after every meaningful transition, and `window.openai.openExternal` for the creation URL. It polls a signed same-origin status URL while the model composes because Apps SDK exposes no token-level generation progress.

The Apps SDK's MCP Apps bridge is used for baseline tool input/result messages. ChatGPT-specific behavior is isolated behind a small `openaiBridge.ts` adapter so it can be feature-detected and unit-tested.

### 2.2 Companion site

The companion site serves:

- `/` — recent creations that passed the automatic listing gate or were owner-approved.
- `/c/:creationId` — owner-controlled creation chrome, status, permanent AI notice and data warning, report/remove link, API list, source, raw request log, dataflow text, Mutate/Spin Again entry points, and the sandbox frame.
- `/run/:creationId` — the generated document wrapped by the trusted runtime harness. It is never the top-level public experience.
- `/api/...` — public read models, signed run bootstrap, status, broker, media/asset proxy, runtime events, report, and owner-only unpublish.
- `/mcp` — the stateless remote MCP endpoint.
- `/healthz` — deployment health without secrets or raw internal state.

Keeper exports are explicit download/view surfaces, never alternate execution surfaces. `/api/creations/:id/download` serves only the accepted revision with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`; raw artifact HTML is never rendered same-origin outside the sandboxed `/run/:id` iframe. `/api/creations/:id/spec` renders a safe human-readable concept contract, and `/api/creations/:id/spec/download` downloads the same text. Failed and accepted source revisions remain inspectable through the revision-qualified source route.

Persistence means a saved creation URL remains loadable through the competition and judging period. `RETENTION_UNTIL` is not assigned a guessed date; deletion is disabled until the owner explicitly records that judging has ended. The owner may unpublish any creation immediately.

### 2.3 Why Cloudflare, not the alternatives

Cloudflare is selected because one free deployment can provide low-latency HTTPS, web-standard Streamable HTTP, dynamic response headers, static assets, cron, cache, and D1. Cloudflare documents `createMcpHandler` as a stateless Streamable-HTTP handler and D1 Free as including 5 GB of storage. Dynamic Worker responses can set their own CSP headers. The executor must prove that validation of a 40 KB artifact stays reliable under the Workers Free CPU limit during milestone 0. If it does not, the executor stops and reports the measured failure; it does not silently enable Workers Paid.

Vercel Hobby plus a separate free database is the fallback design, not an automatic fallback, because it adds a vendor, credentials, failure surface, and setup time. ChatGPT Sites is not selected, so the Sites-specific hosting/meters spike is unnecessary. The external-site + owner-model-key architecture remains prohibited unless the owner explicitly signs off after milestone 0 proves tool-argument transport infeasible.

## 3. MCP tool surface and choreography

### 3.1 Tools

All tools declare all three impact hints. Tool results contain concise `structuredContent`; `_meta` never contains secrets and is treated as user-visible even when hidden from the model.

| Tool | Purpose | UI template | Annotations |
|---|---|---|---|
| `open_randomware` | Mount the persistent widget with current public configuration | yes, the only render tool | read-only, closed-world, non-destructive |
| `spin_apis` | Create a signed run and select 2 or occasionally 3 healthy APIs | no | write, closed-world, non-destructive |
| `mutate_creation` | Create a new run contract with the same APIs and prior concept summaries | no | write, closed-world, non-destructive |
| `submit_concept` | Accept and validate the model-created concept contract | no | write, open-world because it prepares public content, non-destructive |
| `submit_artifact` | Accept the complete HTML artifact, validate it, and publish a revision | no | write, open-world, non-destructive |
| `submit_repair` | Accept the sole full replacement artifact for an eligible failed revision | no | write, open-world, non-destructive; prior revision is preserved |
| `get_run` | Retrieve a concise run snapshot for recovery/debugging | no | read-only, closed-world, non-destructive |
| `record_choreography_failure` | Idempotently end a silent/noncompliant phase after its deadline | no | write, closed-world, non-destructive |

Every mutating tool accepts `requestId` and is idempotent. `spin_apis` and `mutate_creation` return a `runId`, a signed `runContract`, selected API contracts, a `statusUrl`, deadlines, and public-publication disclosure. The signed contract binds the run ID, selected API IDs, selected operation IDs, creation phase, and expiry. A model cannot substitute APIs or mutate the concept after signing.

### 3.2 Normal flow

1. The model calls `open_randomware`, or the user invokes the app and the model selects it. The widget renders the Slot surface.
2. Spin calls `spin_apis` directly from the widget. Reels reveal the returned APIs sequentially. This boundary is real; no concept exists yet.
3. The widget persists the run, phase, history, and timers, then sends the exact concept prompt as a follow-up message.
4. The user's model invents the concept and calls `submit_concept`. The server applies schema and heuristic checks and writes the accepted concept. The widget discovers that accepted event by polling `statusUrl` and renders Concept Reveal.
5. Reroll sends another concept prompt for the same run with concept history. Build first displays the explicit public-URL disclosure, records local `build_triggered_at`, and sends the code prompt.
6. The user's model sends the entire 10–40 KB page in the `html` argument of `submit_artifact`. The server records `artifact_received`, validates it, stores the immutable revision, and makes `/c/:id` available immediately. Here, “deployed” means stored and routable; no per-creation infrastructure deployment occurs.
7. The widget opens or embeds `/c/:id`. The trusted outer page loads `/run/:id` in the sandbox, waits for the runtime handshake, and posts `booted`. The widget shows only event-backed progress.
8. If artifact validation or initial boot fails after an artifact was received, the server enters `repair_requested`. The widget sends the repair prompt once. `submit_repair` is the only accepted next artifact tool. The attempt counter increments only when that complete artifact reaches the server.
9. A successful repair creates revision 2 and preserves revision 1. A failed repair creates the Failed Creation. A model that does not return the repair artifact is a choreography failure; its repair-attempt count remains zero because no artifact was received.

### 3.3 Choreography timeouts

The server owns a phase clock and exposes its `lastActivityAt`, inactivity deadline, absolute backstop, and `statusUrl` in every run snapshot. The widget polls `statusUrl` and treats persisted timestamps as recoverable display state only. Any received tool call for the current phase—including a validation-rejected `submit_concept` or artifact call—updates `lastActivityAt` and resets the inactivity countdown. A phase transition starts a fresh clock; a status GET does not count as activity. The absolute backstop is measured from phase start and cannot be extended by activity.

| Phase | Idle before re-steer | Action | Idle after re-steer | Absolute backstop | Terminal result |
|---|---:|---|---:|---:|---|
| concept | 180 s | send one concise re-steer | 300 s | 600 s | `choreography_timeout` |
| artifact | 300 s | send one concise re-steer | 600 s | 1200 s | `choreography_timeout` |
| repair | 300 s | send one concise re-steer | 600 s | 1200 s | `choreography_timeout` |

These values are a live-evidence correction: the 10 KB composition and repair took minutes, and a larger run crossed ten minutes while an active repair fragment was arriving. The concept window is extended beyond the former 120-second ceiling so one rejection cycle is not mistaken for abandonment; artifact and repair receive five minutes of silence before the first steer, ten minutes after it, and a twenty-minute hard stop. Activity can never create an unbounded rejection loop. A tool call outside its expected phase is rejected with `{code, expectedTool, currentPhase, retryable}`. An artifact printed in prose does not count. True silence never leaves a blank widget: it calls `record_choreography_failure` at the server-owned deadline and renders the death certificate locally even if that write fails.

## 4. Prompt and schema contracts

The server contains no model. “Prompt” means stable server-provided instructions/tool metadata plus the widget-authored follow-up message consumed by the player's own ChatGPT model. Prompt versions are stored on every run.

### 4.1 App/server instructions

Initialization instructions say, in this order:

1. Randomware is a staged tool workflow; never invent API selections or statuses.
2. Use only the next tool named by the current run contract.
3. Concept and code are separate; `submit_concept` must never contain code.
4. Artifact HTML must be complete inside the tool argument, never in assistant prose.
5. The concept and selected APIs are immutable during build and repair.
6. If a tool returns a structured retry, fix only the reported contract violation and call the named tool.
7. Never request owner keys, user API keys, personal data, passwords, or payment data.

Tool descriptions start with “Use this when…” and name their single predecessor and successor. They do not rely on conversational memory for IDs.

All model-visible tool fields, required paths, enums, literal values, string/array/numeric bounds, artifact literals, semantic cross-field rules, and runtime capability quotas are projections of one executable contract definition. The server validators, `tools/list` input schemas, initialize instructions, tool descriptions, concept-result guidance, widget build/repair prompts, artifact generator, and capability signer consume that definition; none may restate a contract number or enum independently.

### 4.2 Concept prompt

The concept prompt includes the selected API contracts (names, capability descriptions, allowed operations, response field summaries, attribution), prior concept summaries for this API set, and the creative rules from PRD §4 and §10. It requires sincere collision naming, one understandable player action, an essential role for every API, at least one causal dependency, one extreme visual direction, and an honest banned-shape assessment. It ends with: call `submit_concept` and emit no code.

The input schema is equivalent to:

```ts
type ConceptSubmission = {
  requestId: string;
  runId: string;
  runContract: string;
  promptVersion: string;
  appName: string;                 // 2–4 words, 4–48 chars
  premise: string;                 // 20–180 chars
  playerAction: string;            // 20–180 chars
  apiIds: string[];                // every selected API exactly once
  causalChain: Array<{
    order: number;                 // one-based; one item per selected API
    apiId: string;
    action: string;                // 8–120 chars
  }>;
  apiRoles: Array<{
    apiId: string;
    essentialRole: string;         // 15–180 chars
    operations: string[];          // one or more allowed selected operations
  }>;
  dependency: {
    fromApiId: string;
    to: "api_input" | "rules" | "interface_state";
    toApiId?: string;
    explanation: string;           // 1–240 chars
  };
  interaction: {
    controls: string[];             // 1–4 concrete controls
    outcome: string;               // 8–180 chars
  };
  visualDirection: {
    style: string;                  // extreme, not minimal SaaS
    palette: string;               // each visual field 4–100 chars
    typography: string;
    motion: string;
  };
  bannedShapeAssessment: {
    plainDashboard: false;
    plainSearch: false;
    plainQuiz: false;
    randomFactDisplay: false;
    thinClone: false;
    plausibleStartupPitch: false;
    explanation: string;           // 12–240 chars
  };
  noveltyDelta: string;            // 8–180 chars
};
```

The referee verifies exact API-ID coverage, valid operations, ordered chain coverage, a valid dependency, at least one control, all six literal `false` values, nonempty explanations, name/length rules, novelty against normalized prior names/premises, and a case-insensitive banned-shape phrase list. It cannot semantically judge eccentricity; the owner applies the acceptance sample.

### 4.3 Code prompt

The code prompt repeats the immutable accepted concept and gives a compact runtime contract:

- Return one UTF-8 HTML5 document, 10,000–40,000 bytes, with all CSS and JavaScript inline.
- Use only literal `window.randomware.call(apiId, operationId, params)` calls from the supplied operations. Never use a network primitive or external URL.
- Treat each call result as the fixed broker envelope `{ ok: true, apiId, operationId, data, bytes, sourceUrl, cached }`; on an HTTP failure the harness rejects with `Error("broker_failure")`. The app payload is exactly `result.data`, not a raw public-API top-level field.
- Read `result.data` only by the selected operation's supplied adapted `outputSchema` and bounded `responseExample`. Adapted values may be bounded/truncated; image fields are already same-origin signed URLs for verbatim `img.src` assignment, and audio is available only through a signed `/media` URL.
- Fetch selected operations with per-call failure isolation (`Promise.allSettled` or equivalent). Render all fulfilled sources plus an honest per-source failure line for each rejected source; one runtime outage must not blank the whole app. Every selected API remains conceptually essential even when runtime degradation is partial.
- Keep native audio controls fully visible and unobstructed by labels, overlays, or decorative layers so the browser play control remains usable.
- Call `window.randomware.ready()` after interactive controls are bound.
- Provide visible loading, error, interactive, and attribution regions using exact `data-randomware` markers.
- Render response text with safe DOM APIs; never use HTML string sinks.
- Make every selected API essential and make the declared dependency observable.
- Include a mobile viewport and work at 390 CSS pixels.
- Commit to the accepted extreme visual direction; do not create generic SaaS chrome.
- Do not ask for or infer personal, authentication, contact, payment, or secret information.
- Call `submit_artifact` with the complete page in `html`; do not print the page in prose.

```ts
type ArtifactSubmission = {
  requestId: string;
  runId: string;
  runContract: string;
  conceptId: string;
  promptVersion: string;
  html: string;                     // 10,000–40,000 UTF-8 bytes
  declaredApiUses: Array<{
    apiId: string;
    operations: string[];          // one or more; exact selected coverage
  }>;
};
```

The artifact result is a discriminated union with `accepted`, `repair_required`, or `failed`. It includes event timestamps, revision number, creation URL when available, stable diagnostic codes, and the exact next tool. It never returns the HTML to the model.

### 4.4 Repair prompt

Repair receives the immutable concept, selected operation contracts, prior artifact diagnostics, and source revision ID. It says to preserve behavior and concept, replace the entire page, fix only diagnosed problems plus necessary consequences, and call `submit_repair` exactly once. The schema is `ArtifactSubmission` plus `failedRevisionId` and `diagnosticCodes`. Server state, not model text, enforces one received repair artifact.

### 4.5 Output-data minimization

Registry examples are fixed, bounded `responseExample` summaries generated from committed owner-curated adapted goldens, not live or raw untrusted fixture bodies. Live API response content never enters a choreography prompt. Tool results expose only fields required for the current stage. Source HTML is stored and shown in a text viewer but not echoed into the ChatGPT transcript.

## 5. Generated-app containment and mediation

### 5.1 Exact execution mechanism

The public creation page is trusted owner code at `/c/:id`. It creates exactly one iframe:

```html
<iframe sandbox="allow-scripts" credentialless referrerpolicy="no-referrer" src="/run/:id?...">
```

No `allow-same-origin`, `allow-forms`, `allow-popups`, `allow-downloads`, `allow-modals`, `allow-top-navigation`, or presentation capability is present. Because `allow-same-origin` is absent, `/run/:id` executes with an opaque origin even though the URL is on the companion host. It cannot read parent DOM, `window.openai`, cookies, local/session storage, IndexedDB, service workers, or the companion site's origin data. DOM injection into the ChatGPT widget or companion shell is never used.

The Worker parses the accepted artifact again when serving `/run/:id`, injects a versioned trusted harness before generated scripts, and sets a response CSP. The harness exposes only a frozen `window.randomware` object:

```ts
randomware.call(apiId, operationId, params): Promise<BrokerResult>
randomware.ready(): void
```

It also reports boot, uncaught error, unhandled rejection, and policy events. It does not expose the D1 ID, signing secret, parent API, arbitrary fetch, or raw media URL. The outer page accepts messages only when `event.source === frame.contentWindow`, the channel/version matches, and the per-load nonce matches. These messages are telemetry, not authority; broker logs remain authoritative for API use.

### 5.2 CSP

The deployed draft-app retest uses these policies, substituting the exact HTTPS companion origin:

```text
/c/:id:
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none';
form-action 'none'; frame-ancestors https://chatgpt.com https://chat.openai.com
https://web-sandbox.oaiusercontent.com https://*.web-sandbox.oaiusercontent.com

/run/:id:
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data: blob: https://<companion-origin>;
media-src blob: https://<companion-origin>;
connect-src https://<companion-origin>;
font-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'; frame-ancestors https://<companion-origin> https://chatgpt.com https://chat.openai.com
https://web-sandbox.oaiusercontent.com https://*.web-sandbox.oaiusercontent.com
```

The response also sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, `Cross-Origin-Resource-Policy: same-site` where compatible, and no cookies.

The owner-authorized embedding retest declares the companion origin in `frameDomains` and uses the bounded allowlist above for both documents. Real ChatGPT evidence established that the connector-specific `https://<connector>.web-sandbox.oaiusercontent.com` iframe is an intermediate ancestor, so both the apex and the narrowly scoped `https://*.web-sandbox.oaiusercontent.com` source are required: `frame-ancestors` must match every ancestor. Link-out remains available throughout.

The production widget resource declares:

```ts
_meta.ui.csp = {
  connectDomains: [COMPANION_ORIGIN],
  resourceDomains: [COMPANION_ORIGIN],
  frameDomains: [COMPANION_ORIGIN],
};
_meta["openai/widgetCSP"].redirect_domains = [COMPANION_ORIGIN];
_meta.ui.domain = COMPANION_ORIGIN;
```

The diagnostic spike separately tests direct `connectDomains` entries for registry upstreams because the brief requires that evidence. The shipped widget does not retain those upstream entries: all production data access is mediated and least privilege is narrower.

### 5.3 Operation-level broker

Generated code sends a CORS POST from opaque origin (`Origin: null`) to `/api/runtime/call`. The request contains a short-lived signed capability, literal API ID, literal operation ID, and operation parameters. CORS returns `Access-Control-Allow-Origin: null` only on runtime routes; all requests require a valid capability. A new 10-minute capability is minted whenever a creation page loads and binds:

- creation and revision ID;
- exact selected API and operation IDs;
- issued/expiry time and random nonce;
- JSON, asset, and media quotas.

The Worker never accepts a URL. Each registry operation constructs method, host, path, and query from validated typed fields. All current operations are GET. The broker drops client headers, supplies a descriptive Randomware user agent where providers request it, enforces TLS except explicitly audited proxy-only sources, follows redirects manually for at most two hops, and validates every redirect host. It applies a timeout, raw byte cap, JSON/content-type check, response adapter, output schema check, and output byte cap. Errors use stable safe codes and never include internal stack traces.

Text returned by APIs is untrusted data. The generated-code validator rejects HTML string sinks. Registry adapters select only needed fields and preserve attribution/source URLs. Raw responses are not placed in prompts. Logs redact query values classified as user text and retain normalized operation metadata.

### 5.4 Assets and audio

JSON adapters never return arbitrary upstream asset URLs directly. For allowlisted asset hosts they return a signed, expiring `/api/runtime/asset/:token` URL. The asset endpoint validates the stored exact resolved URL, expected MIME family, size, and expiry before streaming.

Radio Browser is the one explicit variable-host exception. The broker resolves the station stream from a Radio Browser response, rejects credentials, IP literals, loopback/local hostnames, and non-audio schemes, stores the exact resolved URL, and returns a short-lived signed `/media` URL. The media route permits one logical active connection, five minutes, and 8 MiB per page load. Each connection receives a stream lease; a browser reconnect replaces the previous lease, and completion, cancellation, or abort accounts served bytes while only the current lease may clear the active slot. Worker cleanup is attached to the stream abort/cancel path and `ctx.waitUntil`; the compatibility pump also cleans up in `finally`. This last-connection-wins accounting lets standard browser open-abort-Range-reconnect behavior recover even if an earlier cleanup write is not delivered, while a late cleanup from the replaced connection cannot clear the replacement. Generated code cannot provide or alter the upstream URL. Community-edited stream destinations remain the accepted PRD residual risk.

iTunes preview playback is tested in milestone 0 because the brief requires it, but iTunes is not activated at launch: Apple's Search API terms restrict preview use to promotion rather than independent entertainment. No preview is cached or published.

### 5.5 Per-creation and global limits

| Limit | Value |
|---|---:|
| runtime capability | 10 minutes per page load |
| concurrent JSON calls | 2 |
| JSON calls per page load | 30 |
| calls per operation per minute | 6 |
| upstream timeout | registry value, 4 s default, 6 s maximum |
| raw JSON per call | 256 KiB |
| adapted JSON per call | 64 KiB |
| adapted JSON total | 1 MiB per page load |
| asset | 2 MiB each, 8 MiB total |
| audio | 1 stream, 5 minutes, 8 MiB |
| artifact | 10,000–40,000 UTF-8 bytes |
| revisions | initial plus one received repair |
| app proxy budget | 5,000 upstream calls per UTC day |
| per-API proxy budget | registry value, 250/day default |
| stored creations | 2,000 hard cap |

At 80% of a daily upstream budget, that API becomes degraded and is excluded from new spins. At 100%, calls return a styled `capacity_reached` result. At 80% of the global proxy budget, new builds are disabled but stored pages and inspection remain available. At 100%, proxy calls fail gracefully. The Cloudflare account is configured fail-closed; capacity errors must be translated by application paths whenever the Worker is still executing.

## 6. Validation and failure semantics

### 6.1 Static pipeline

Validation is deterministic and produces stable codes:

1. Validate tool schema, signature, phase, concept ID, byte length, UTF-8, and revision eligibility.
2. Parse HTML with `parse5`; require one doctype/html/head/body, a viewport meta, no parse errors, and at most 2,000 nodes.
3. Reject external scripts/styles/fonts, `base`, `iframe`, `frame`, `object`, `embed`, `applet`, `portal`, `meta refresh`, `srcdoc`, active SVG/MathML, event-handler URLs, non-data external resource attributes, and form actions.
4. Reject password/payment/contact/file input types and names, IDs, labels, placeholders, or autocomplete tokens that imply password, secret, email, phone, address, card, CVV, bank, SSN, login, or payment collection. Text controls for toy inputs remain allowed.
5. Parse every generated inline script with `acorn`. Reject syntax errors; dynamic import; `fetch`, XHR, WebSocket, EventSource, beacon, workers, service workers, eval, Function constructor, storage/cookie APIs, `window.openai`, parent/top/opener access, navigation/open calls, document writing, and HTML string sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`).
6. Require literal `window.randomware.call` expressions whose API/operation pairs are in the signed run, and require at least one literal call site for every selected API. Reject calls for unselected APIs and dynamic API IDs.
7. Require `window.randomware.ready()`, at least one interactive element, and visible `data-randomware="loading"`, `error`, `interactive`, and `attribution` regions.
8. Compare declared uses to the AST, rescan all URL-bearing CSS/HTML attributes, normalize the document, and store the validation report with validator version and SHA-256.

This validator is a guardrail, not a proof of program semantics. The opaque sandbox, CSP, and broker are authoritative.

### 6.2 Runtime pipeline

The harness posts `dom_loaded`, `ready`, and errors. The creation is `booted` only after `ready` arrives before 8 seconds and the page has an interactive marker. The broker writes request start/end rows independently. The Inspect surface distinguishes `not yet observed` from `unused`; after the 10-minute capability expires, any selected API with zero completed calls is permanently flagged unused for that run. During the initial build window, JavaScript failure, response-schema failure, or required-API nonuse can request the one repair. Later visitor/upstream failures cannot summon a model and therefore render an accurate runtime Failed Creation without pretending a repair occurred.

### 6.3 Failure taxonomy

The stable causes are:

- `invalid_concept`
- `artifact_missing`
- `artifact_schema`
- `html_parse`
- `javascript_parse`
- `policy_blocked`
- `runtime_javascript`
- `upstream_failure`
- `response_shape_mismatch`
- `runtime_timeout`
- `unused_api`
- `repair_failed`
- `choreography_timeout`
- `capacity_reached`

The death certificate is generated from deterministic copy templates, not a hidden model. It displays cause, plain technical detail, epitaph, inherited API traits, elapsed survival time, specimen ID, and both artifact revisions when present. Failed artifact and repair revisions retain their bounded source HTML, exact UTF-8 byte count, and SHA-256 so the failed code remains inspectable; the acceptance contract's both-revisions requirement therefore applies to rejected as well as accepted submissions. No failure path renders a raw error page.

## 7. Registry and API selection

### 7.1 Registry type

Registry definitions are versioned TypeScript data plus response-adapter functions. Runtime health is separate D1 data.

```ts
type RegistryEntry = {
  id: string;
  name: string;
  category: string;
  capability: string;
  semanticTags: string[];
  sensory: Array<"visual" | "audio" | "geo">;
  docsUrl: string;
  termsUrl: string;
  attribution: { text: string; url: string; license: string };
  upstreamHosts: string[];
  assetPolicy: {
    allowedHosts: string[];
    resolvedPaths: string[];
    variableMediaHost: boolean;
  };
  fixturePath: string;
  defaultWeight: number;
  dailyBudget: number;
  operations: Array<{
    id: string;
    description: string;
    method: "GET";
    pathTemplate: string;
    paramsSchema: ZodType;
    outputSchema: ZodType;
    responseExample: BoundedAdaptedExample;
    semanticFieldPaths: string[];
    shapeSignature: Record<string, JsonType>;
    timeoutMs: number;
    maxRawBytes: number;
    cacheTtlSeconds: number;
    adapt: AdapterName;
  }>;
};
```

D1 `api_health` holds `api_id`, `registry_version`, `status` (`healthy`, `degraded`, `disabled`), consecutive successes/failures, last HTTP/content/schema result, latency, checked time, and operator reason. Only `healthy` entries are selectable. A cron check runs the smallest representative operation. One failure or latency over the entry threshold marks degraded; three consecutive failures, terms uncertainty, unexpected content, or schema failure disables. Two consecutive successes restore degraded to healthy; disabled requires an explicit owner action.

`npm run registry:verify` validates source definitions and fixtures without network. Adapted goldens generate each operation's bounded `responseExample`, structural `outputSchema`, semantic leaf paths, and deterministic object/array/key signature. `npm run registry:verify:live` runs the production adapter against every fixed live operation, compares that adapted key/container structure with the committed golden, and records shape drift as unhealthy before writing a timestamped report. Scalar values, including provider-nullable fields, share one leaf signature so random content variation cannot create a false shape failure. `npm run registry:health:publish` updates D1 only after a successful report. Live recapture writes only the adapted-output goldens; it never overwrites the preparation/source evidence under `samples/`.

### 7.2 Launch set and recorded changes

The launch target is 18 APIs. Every entry remains disabled until its implementation-time live, terms, attribution, and asset-domain check passes.

| API | Source set | Decision and constraints |
|---|---|---|
| Deck of Cards | primary | keep; stateful IDs are treated as opaque bounded strings |
| PoetryDB | primary | keep; source attribution included; returned lines are untrusted text |
| Datamuse | primary | keep; credit Datamuse and cap far below its published daily limit |
| Art Institute of Chicago | primary | keep; public-domain images only, preserve credit line/license, 60 rpm ceiling |
| Dog CEO | primary | keep; proxy `images.dog.ceo` assets and credit source |
| Radio Browser | primary | keep; descriptive user agent, mirror resolution, signed variable-media exception |
| Open-Meteo | primary | keep; noncommercial competition use only, CC BY 4.0 attribution, under 10,000/day |
| Frankfurter | primary | keep; use v2 and expose provider attribution |
| RandomUser | primary | keep with `inc=name,gender,nat,picture`; never expose login, address, phone, email, DOB, or IDs |
| Wikipedia On This Day | primary | keep; preserve page/source links and applicable Wikimedia attribution/license |
| USGS Earthquakes | primary | keep; use small real-time/query result and credit USGS |
| Met Museum | backup | promote; only `isPublicDomain` objects/images, CC0 source |
| Nager.Date | backup | promote; small public-holiday response, MIT project attribution |
| TVMaze | backup | promote; public endpoints only, 20 calls/10 s ceiling, link attribution, CC BY-SA notice |
| [Rick and Morty API](https://rickandmortyapi.com/documentation) | round 3 | promote for the noncommercial competition demo under its [BSD/open-source notice](https://rickandmortyapi.com/about); use fixed REST character GETs, credit the API and Adult Swim, proxy only same-host avatars, and never persist or transform them |
| [Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) | round 3 | promote; use v3 product-by-code GETs with an explicit `fields` list, never the search endpoints, send a custom user agent, stay at or below 10 rpm, preserve ODbL/DbCL and image CC BY-SA attribution, and proxy only `images.openfoodfacts.org` assets |
| [LibriVox](https://librivox.org/api/info) | round 3 | promote; request bounded catalog/audiotrack fields, strip returned HTML, credit LibriVox and the reader, use a 10,000 ms operation/health latency limit for the observed cold path, and proxy one [public-domain](https://librivox.org/pages/public-domain/) section for at most 90 seconds through signed media restricted to `archive.org` and validated `*.us.archive.org` redirects; no audio caching |
| [TheMealDB](https://www.themealdb.com/terms_of_use.php) | primary, reconfirmed | promote for this noncommercial competition web demo under the free-key development terms; use [official v1 GET endpoints](https://www.themealdb.com/docs_api_guide.php) and key `1`, credit TheMealDB, proxy only `www.themealdb.com` images, and disable before app-store or post-demo production use without a supporter key |

The following verified candidates are not launched:

- Open Library: 3.4-second observed latency makes it a demo-path risk.
- PokéAPI: roughly 290 KB responses and unbounded `raw.githubusercontent.com` sprite paths add disproportionate mediation risk.
- Advice Slip: no clear API-specific terms were found during the design pass.
- REST Countries: terms updated on 2026-07-10 introduce account/key language and three-day retention constraints inconsistent with the key-free registry assumption.
- iTunes Search: preview terms restrict audio to promotion and prohibit independent entertainment value, which conflicts with Randomware. It is spike-only and never stored/cached.
- [Foodish](https://github.com/surhud004/Foodish): reject because a single random image is too thin and the MIT code license does not resolve the upstream dataset images' ownership and attribution.
- [Deezer](https://developers.deezer.com/termsofuse): reject because its developer terms limit listening to private family use, which is incompatible with public generated creations.
- [Gutendex](https://github.com/garethbjohnson/gutendex): reject because 6.3–13.8-second uncached responses are a core demo-path risk, and its official project recommends self-hosting rather than relying on the public test instance.

ISS APIs remain excluded from the launch set. `api.wheretheiss.at` measured 9–10 seconds; `api.open-notify.org` is HTTP-only. The design does not reintroduce either on the core path.

If any of the 18 launch entries fails its implementation-time terms or health check, it is disabled rather than replaced ad hoc. The launch may proceed with 12–18 enabled entries and must stop below 10.

The registry's policy fields start from these official sources, checked on 2026-07-18: [Deck of Cards](https://deckofcardsapi.com/), [PoetryDB](https://github.com/thundercomb/poetrydb), [Datamuse](https://www.datamuse.com/api/), [Art Institute of Chicago](https://api.artic.edu/docs/), [Dog API](https://dog.ceo/dog-api/about), [Radio Browser](https://docs.radio-browser.info/), [Open-Meteo terms](https://open-meteo.com/en/terms), [Frankfurter](https://frankfurter.dev/), [RandomUser](https://randomuser.me/documentation), [Wikimedia REST policy](https://www.mediawiki.org/wiki/API:REST_API/Policies), [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/), [Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access), [Nager.Date](https://github.com/nager/Nager.Date), and [TVMaze](https://www.tvmaze.com/api). The excluded-entry decisions use [REST Countries terms](https://restcountries.com/legal/terms-of-service), [iTunes Search API terms](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/), and the live-verification evidence in `api-candidates/`.

### 7.3 Selection algorithm

The server enumerates all valid 2- or 3-entry combinations from healthy APIs after removing exact matches from the last three canonicalized spin sets and all-one-category sets. Default/Wild uses two APIs and independently uses three when `hash(seed, "arity") / 2^256 < 0.15`.

For a combination `C`:

```text
pairDistance(a,b) = 1 - |tags(a) ∩ tags(b)| / |tags(a) ∪ tags(b)|
distance(C)       = mean pairDistance
sensory(C)        = 1 when any entry has visual/audio/geo, otherwise 0
categorySpread(C) = (distinct categories - 1) / (|C| - 1)
slowRisk(C)       = mean min(1, p95LatencyMs / 4000)
Wild weight       = clamp(0.25, 8,
                    1 + 3*distance + 1.5*sensory + 0.5*categorySpread - slowRisk)
```

A deterministic HMAC-derived unit value selects from cumulative weights; a cryptographically random seed is generated when none is supplied. The optional stored seed reproduces the selection, not model output. Tests over 100,000 seeds require 14–16% three-API spins and no healthy API's inclusion rate above 2.5 times another's.

Stable and Chaos are Should-level layers on the same engine: Stable substitutes `1 - distance`; Chaos forces three APIs and uses `1 + 5*distance` while retaining Must constraints. They are implemented only after all Must checks pass.

## 8. Persistence and data model

The core D1 tables are:

- `runs`: ID, request ID, phase, selection seed/mood, selected API IDs, signed-contract hash, prompt/registry versions, deadlines, re-steer flags, repair artifacts received, timestamps, failure code.
- `concepts`: immutable ID/run, normalized concept fields, novelty hash, accepted/rejected diagnostics, timestamp.
- `artifact_revisions`: immutable ID/run/revision, source HTML, byte count, SHA-256, validator version/report, boot state, timestamp.
- `creations`: public ID/run/current revision, status, title/premise, created time, `retention_until`, listing gate, unpublish/report state.
- `runtime_requests`: creation/revision, API/operation, redacted parameter digest, start/end, status/error, adapted byte count, cache hit, timestamp.
- `runtime_events`: creation/revision, event type, safe detail, elapsed time, timestamp.
- `api_health`: fields described above.
- `daily_budgets`: UTC date/scope/count/limit.
- `reports`: creation, reason enum, optional bounded note, timestamp, resolution.

No table stores ChatGPT prompt text, conversation content, IP address, real user identity, API response body, owner model credential, or arbitrary media URL beyond the short TTL needed for a signed media token. Public IDs use nonsequential 128-bit random values. Signed contracts/capabilities use HMAC-SHA-256 with a rotated Worker secret; only hashes/nonces are stored when possible.

Widget state contains the current run snapshot, the last three spin sets, normalized same-combination concept summaries, UI panel state, and the latest server-owned choreography snapshot for timer recovery. It is bounded to 32 KiB and is never authoritative for deadlines, repair limits, or publication; `statusUrl` polling refreshes the clock. Cross-session creations live in D1; no `localStorage` is core state.

## 9. Threat model

### 9.1 Assets, actors, and trust boundaries

Assets are the ChatGPT conversation and `window.openai` capabilities; companion-site integrity; public creation availability; registry providers and rate budgets; stored artifact/source/log data; Worker secrets; and the owner's grant/hosting cost. Threat actors are malicious generated code, adversarial public API content, a malicious visitor, a prompt-injected model, an abusive anonymous caller, and a compromised upstream response.

Trust boundaries are model→MCP arguments, widget→Worker, outer page→opaque sandbox, sandbox→broker, broker→upstream, public visitor→site, and Worker→D1. No model or widget hint is an identity or authorization source.

### 9.2 Threats and controls

| Threat | Primary controls | Detection/response | Residual risk |
|---|---|---|---|
| Generated code reads/manipulates ChatGPT or owner chrome | separate `/run` document, opaque origin, sandbox allow-scripts only, no DOM injection, no `window.openai` | CSP/console test; policy event; block artifact where detectable | browser sandbox bugs are out of scope |
| Generated code exfiltrates through arbitrary network | CSP `connect-src` companion only, no network APIs in AST, operation broker accepts no URL, signed selected-operation capability | Playwright network capture, broker denial log, Failed Creation | allowed text parameters can carry user-entered text; UI warns against personal data |
| SSRF through broker or media | fixed host/path construction, manual redirects, no IP/localhost, exact server-resolved signed media URL, time/byte caps | denial logs; disable API; rotate media signing key | community radio DNS/content remains an explicit residual risk |
| XSS from API content | response adapters, no raw content in prompts, reject HTML sinks, React/text rendering in owner surfaces | fixture/injection tests; unpublish | generated semantic misuse cannot be proven statically |
| Prompt injection from public API data | API bodies never enter model choreography; registry descriptions are authored data | golden malicious fixtures | source/code viewer can show hostile text as inert text |
| Public artifact asks for secrets/payment/PII | schema prompt prohibition, static field/label scan, owner warning outside sandbox, reporting, listing gate | report queue and immediate unpublish | heuristic language detection is incomplete |
| Capability theft/replay | 10-minute signed binding, nonce, per-load quotas, no broad authority | budget counter, expiry, rotate secret | visitors can inspect their own short-lived token and spend that creation's quota |
| Forged boot/usage telemetry | source-window + nonce checks; broker logs authoritative | discrepancy shown in Inspect | generated code shares its own harness realm and can spoof non-authoritative UI events |
| Repair-limit bypass/idempotency race | D1 transaction, phase machine, immutable revisions, request IDs, server count on received artifact | conflicting call returns expected phase | D1 availability failure becomes a graceful failure |
| Anonymous denial of wallet/provider quota | free hosting only, per-load/per-API/global caps, caching, 80% degradation, 100% cutoffs, storage cap | health/budget dashboard, disable builds/APIs | Cloudflare account-wide request cap can still return provider error pages |
| Stored/public harmful content | automatic machine gate, gallery flag gate, permanent warning, report/remove, owner unpublish | reports and audit fields | no human moderation SLA; short-lived experimental scope |
| Secret disclosure | no model/upstream keys, Worker secrets only, redacted logs, secret scan | CI secret scan and rotation | deployment-account compromise is outside app controls |
| Clickjacking/navigation/download | exact `frame-ancestors`, sandbox omits navigation/popups/downloads/forms, CSP form-action none | browser tests | embedding is disabled if exact ancestors cannot be proven |
| Supply-chain compromise | lockfile, minimal dependencies, npm audit, pinned deploy toolchain | CI audit and review | ecosystem compromise remains possible |

### 9.3 Publication and removal policy

Build displays: “Building publishes this experimental AI-generated app at a public URL. Do not enter real personal, payment, authentication, or secret data.” Acceptance is the Build action; there is no account or click-through policy.

Every `/c/:id` keeps the warning, API attribution, and report link outside the sandbox. Machine-passing creations enter `pending_listing`; the automatic flag gate lists only booted creations with no policy/runtime error, no blocked-field finding, and all required metadata. This satisfies “flag-gated, never automatic publication”: the URL is published, but gallery inclusion requires a separate gate. Reports immediately set `listing_visibility=hidden`; the owner can set `publication_status=unpublished`, after which all run/source/broker routes return the owner-controlled removal page.

## 10. Progress and observability

The status model is an append-only event list plus derived phase. User-visible stages are exactly:

- spin received;
- concept requested / concept received / concept accepted;
- build triggered;
- artifact received;
- validation passed or failed;
- creation routable (“deployed”);
- sandbox booted;
- repair requested / repair artifact received;
- completed or failed.

Each stage shows elapsed wall time since the prior observed event. While the model composes, copy says “Waiting for the artifact” with elapsed time; it never says tokens/files are being written. MCP transport streaming may keep `/mcp` healthy but is not presented as generation streaming.

Structured logs use request/run/creation correlation IDs, event code, elapsed time, sizes, and redacted diagnostics. They never log HTML, raw prompts, raw API bodies, capabilities, or user-entered query values. Local and deployed acceptance captures browser console/network evidence and the five-combination matrix in `BUILD_LOG.md`.

## 11. Test strategy, golden fixtures, and fallback demo mode

Tests are layered:

- Contract/unit: Zod schemas, phase transitions, idempotency, signature expiry/binding, selection constraints/distribution, response adapters, caps, failure copy.
- Golden fixtures: every enabled API's captured raw response and expected bounded adapted output; malicious strings; errors; shape drift; redirect and oversize cases.
- Validator corpus: known-good 10/25/40 KB artifacts and one fixture for every rejection code, including obfuscation variants.
- Integration: MCP list/call through the real handler; D1 migrations; full concept/artifact/repair transactions; broker with mocked upstreams; creation headers and unpublish.
- Browser: companion flow in Chromium at desktop/mobile widths, opaque-origin access probes, CSP/network denial, source/traffic inspection, no blank failure, audio when spike permits.
- Real ChatGPT: developer-mode golden prompts, tool choreography, 10–40 KB artifact transport, widget state recovery, link-out, optional frame, and five live API combinations.
- Deployed smoke: HTTPS `/mcp`, `/healthz`, index, creation, CSP headers, broker denial, and public reachability.

The offline demo mode uses five preverified combinations, accepted artifacts, and adapted fixture responses. It is visibly labeled “Recorded API replay”; it does not satisfy live API or model-generation acceptance. It exists only as Should-level demo resilience after the Must live flow passes.

## 12. Repository layout

```text
randomware/
├── apps/
│   ├── worker/src/
│   │   ├── index.ts                 # route dispatch and Worker exports
│   │   ├── mcp/
│   │   │   ├── server.ts            # MCP instructions/resource/tool registration
│   │   │   └── tools/               # one handler per tool
│   │   ├── http/                    # site/status/runtime/admin routes
│   │   ├── broker/                  # capabilities, quotas, fetch, assets/media
│   │   ├── persistence/             # D1 repositories and transactions
│   │   └── health/                  # cron and registry status
│   ├── widget/src/
│   │   ├── App.tsx                  # state-machine renderer only
│   │   ├── openaiBridge.ts          # feature-detected host adapter
│   │   ├── state.ts                 # persisted widget state/reducer
│   │   ├── choreography.ts           # prompts, polling, deadlines
│   │   └── views/                   # Slot, Concept, Progress, Result, Failure
│   └── site/src/
│       ├── main.tsx
│       ├── routes/                  # index and creation page
│       └── components/              # chrome, sandbox, source, traffic, dataflow
├── packages/
│   ├── contracts/src/               # shared Zod types and stable codes
│   ├── core/src/
│   │   ├── selection.ts
│   │   ├── run-machine.ts
│   │   ├── prompts.ts
│   │   └── failure-copy.ts
│   ├── registry/src/                # entries, operations, adapters
│   └── validator/src/               # HTML/JS/CSS validation and harness injection
├── migrations/                      # ordered D1 SQL
├── fixtures/
│   ├── api/raw/                     # copied preparation evidence
│   ├── api/adapted/
│   ├── artifacts/good/
│   ├── artifacts/rejected/
│   └── demo/
├── scripts/                         # registry verify/publish and owner unpublish
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── wrangler.jsonc
```

Files remain responsibility-focused. The implementation session must not collapse tools, broker, registry, validation, persistence, widget, and site into a single Worker file.

## 13. Feasibility gates and fallbacks

Milestone 0 is evidence, not product scaffolding. It must prove:

1. Full single-file tool arguments at 10, 25, and 40 KB survive model→tool→server byte-for-byte.
2. A diagnostic widget can fetch representative registry upstreams when listed in `connectDomains`; production still uses only the broker.
3. Radio Browser stream and iTunes preview audio work either in the widget or nested companion frame. iTunes is discarded after the test for terms reasons.
4. The companion origin embeds via `frameDomains` with exact ancestor CSP, or embedding is disabled and link-out is recorded as the chosen Must path.
5. The chosen Cloudflare Free handler validates/persists a 40 KB artifact without repeatable CPU-limit failures.

If (1) fails, stop for owner decision; chunking or an owner key changes the product contract. If (2) fails, record it and continue because the production broker is primary. If (3) fails in both surfaces, Radio Browser remains selectable only for metadata-driven concepts and audio playback is disabled. If (4) fails, link-out is final. If (5) fails, present measured Vercel Hobby + free database fallback and obtain owner approval before changing hosting.
