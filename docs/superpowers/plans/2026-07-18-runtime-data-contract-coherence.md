# Runtime Data Contract Coherence Implementation Plan

> **Execution note:** Implement in this primary session on `main`, as explicitly directed by the owner. Keep accepted artifacts immutable; fix only future generation/runtime contracts.

**Goal:** Make model-generated artifacts reliably consume the broker envelope and every registry operation's adapted data shape, while detecting fixture/live drift and preserving bounded runtime resilience.

**Architecture:** Treat each adapted golden as the owner-curated source for a generated operation response contract: bounded `responseExample`, structural `outputSchema`, shape signature, and semantic leaf paths. Registry results and all artifact prompts consume that projection. The broker keeps its fixed public envelope, retries one idempotent GET timeout, and reports the retry through the existing runtime-request audit stream. Local browser and deployed synthetic gates consume semantic fields selected only from model-visible operation contracts.

**Tech stack:** CommonJS Node.js, Cloudflare Worker/D1, built-in Node test runner, Playwright browser acceptance, Wrangler deployment.

---

### Task 1: Lock the contract with failing tests

**Files:** `tests/unit/registry-contract.test.js`, `tests/unit/mcp.test.js`, `tests/unit/broker.test.js`, `tests/integration/worker.test.js`

1. Assert all 18 operations expose non-vacuous `outputSchema`, bounded `responseExample`, and usable `semanticFieldPaths` generated from their adapted golden.
2. Assert the runtime envelope/unwrapping, adapted-data, signed-image, and signed-media rules appear in the contract manifest and every artifact-facing prompt.
3. Assert selected response examples appear in spin state and concept-accepted/repair/widget prompts.
4. Assert a first GET timeout is retried once, a second timeout is terminal, and the retry callback is emitted exactly once.
5. Run focused tests and confirm they fail for the missing behavior.

### Task 2: Generate and project operation response contracts

**Files:** `scripts/generate-response-contracts.js`, `src/core/response-contracts.generated.js`, `src/core/registry.js`, `src/core/artifact-contract.js`, `src/core/mcp.js`, `src/server.js`, `src/web.js`

1. Generate bounded examples, JSON schemas, deterministic key/type shape signatures, and semantic scalar paths from `docs/api-candidates/adapted/*.json`.
2. Attach the generated response contract to each registry operation and fail registry verification if any operation lacks a matching projection.
3. Add the broker envelope and adapted-data/media semantics to `RANDOMWARE_CONTRACT_JSON` and the compact code contract.
4. Append only the selected operations' curated examples to concept-result, repair, and widget build/repair prompts.
5. Ensure all tool/status projections retain these operation fields without exposing live upstream bodies.

### Task 3: Add bounded timeout retry and audit logging

**Files:** `src/core/broker.js`, `src/server.js`, `src/web.js`, `tests/unit/broker.test.js`, `tests/integration/worker.test.js`

1. Retry an idempotent registry GET once only when the first fetch raises `runtime_timeout`.
2. Invoke an audit callback before retry; handlers write a `runtime_timeout_retry` runtime-request row with zero bytes, then write the normal final row.
3. Keep quota accounting restricted to successful rows and do not change the public broker envelope.

### Task 4: Recapture and verify adapted goldens

**Files:** `scripts/recapture-adapted-live.js`, `scripts/registry-live.js`, `docs/api-candidates/adapted/*.json`, `src/core/response-contracts.generated.js`, tests for shape comparison

1. Re-fetch every registry operation from its fixed URL and pass it through the production adapter using deterministic placeholder asset/media signers.
2. Write all 18 adapted goldens, including Frankfurter's flat v2 `{date, base, quote, rate}` data.
3. Regenerate operation response contracts.
4. During `registry:verify:live`, adapt each successful live result and compare its deterministic key/type structure with the golden; publish shape drift as unhealthy/disabled evidence.

### Task 5: Close semantic-consumption gate gap

**Files:** `scripts/test-synthetic-deployed.js`, `scripts/test-deployed.js`, `scripts/browser-acceptance.py`, associated tests

1. Build the synthetic artifact solely from deployed tool schemas/prompts and selected operations' visible `semanticFieldPaths`.
2. In artifact JavaScript, call every selected operation, unwrap `result.data`, read at least one declared semantic path, and render it into a per-operation status node.
3. Against production, call every selected operation live and assert the same semantic path is present and non-default.
4. In browser acceptance, execute a fixture-backed accepted artifact and assert each rendered semantic value is non-default.

### Task 6: Verify, record, deploy, and publish

**Files:** `docs/BUILD_LOG.md`

1. Record that pre-fix accepted specimens, including Bark Exchange, are frozen and predate the runtime-data contract; do not mutate their stored HTML.
2. Run focused tests, registry verification, format/lint/type checks, `acceptance:machine`, and local browser acceptance.
3. Commit and push `main`, deploy with Wrangler, then run `registry:verify:live`, publish registry health, `test:e2e:deployed`, and the upgraded synthetic gate against production.
4. Record exact production results and Worker version, commit/push the evidence, and report that the owner must refresh or recreate the connector before new real-ChatGPT spins.
