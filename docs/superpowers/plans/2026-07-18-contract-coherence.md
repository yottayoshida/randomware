# Contract-coherence implementation plan

**Goal:** Eliminate schema/validator/prompt drift by making the deployed MCP contract the generated public projection of one executable definition, then prove a model can complete the production choreography using only that projection.

## 1. Establish failing contract tests

- Assert the dependency target enum, every concept string/array bound, literal-false assessment field, artifact byte/content contract, and capability limits are present in generated schemas and prompt text.
- Assert argument validation rejects enum, bound, and const violations with field-named structured codes.
- Assert prompt surfaces and generated schemas are derived from the same exported constraint catalog.

## 2. Centralize and consume the contract

- Extend `src/core/artifact-contract.js` into the single definition for tool fields, semantic rules, artifact literals/policy, and capability limits.
- Generate all eight tool input schemas and the model-facing contract prompt from that definition.
- Refactor concept, artifact, capability, and MCP validation/generation to read the shared values rather than repeat literals.

## 3. Upgrade the deployed synthetic-model gate

- Remove source contract/schema/artifact imports from the driver.
- Build valid inputs from deployed `tools/list`, initialize instructions, selected API output, and widget/tool prompt text only.
- Walk the deployed schema for required/type/enum/const/range completeness and fuzz every required path plus every enum.
- Run a full exact three-API choreography for Radio Browser, Nager.Date, and LibriVox, then exercise a signed same-origin audio response.

## 4. Record and verify

- Add the field-by-field drift audit, Sol escalation reason, M3 deferred batch, and connector cache caveat to `BUILD_LOG.md`/README.
- Add the model switch to the `BUDGET.md` checkpoint table without inventing a meter reading.
- Run local acceptance, commit and push `main`, deploy, then run the upgraded production gate and deployed e2e before requesting the owner's one final confirmation.
