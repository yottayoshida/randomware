const test = require('node:test');
const assert = require('node:assert/strict');
const { RUNTIME_CONTRACT_CUTOFF_MS, applyListingPolicy, isEarlySpecimen, showcasePage, creationPage, requestsPage, dataflowPage, reportPage } = require('../../src/core/presentation');
const { RunStore } = require('../../src/core/store');

function specimen(overrides = {}) {
  return {
    id: 'run_demo', requestId: 'owner-demo', createdAt: RUNTIME_CONTRACT_CUTOFF_MS + 1, creationId: 'creation_demo', phase: 'completed', listed: true, unpublished: false, styleId: 'paper-certificate',
    concept: { styleId: 'paper-certificate', appName: 'Sensible Nonsense', premise: 'A dog settles the weather as paperwork.' },
    selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }, { apiId: 'open-meteo', operationIds: ['forecast'] }],
    revisions: [{ revision: 1, status: 'accepted', bytes: 12000 }], runtimeRequests: [{ apiId: 'dog-ceo', operationId: 'random', status: 'ok', cacheHit: false, startedAt: RUNTIME_CONTRACT_CUTOFF_MS + 10, endedAt: RUNTIME_CONTRACT_CUTOFF_MS + 45 }], failure: null,
    ...overrides
  };
}

test('showcase is server-rendered and excludes unlisted machine specimens', () => {
  const machine = specimen({ creationId: 'creation_machine', requestId: 'synthetic-gate', concept: { appName: 'Synthetic Gate', premise: 'test' } });
  applyListingPolicy(machine);
  assert.equal(machine.listed, false);
  const html = showcasePage([machine, specimen()]);
  assert.match(html, /For judges/);
  assert.match(html, /Demo video/);
  assert.match(html, /github\.com\/yottayoshida\/randomware#chatgpt-prerequisites-and-connect/);
  assert.match(html, /Real APIs go in\. Random apps come out\./);
  assert.match(html, /Sensible Nonsense/);
  assert.match(html, /LIVE SPECIMEN — Sensible Nonsense/);
  assert.match(html, /<iframe[^>]+src="\/run\/creation_demo"/);
  assert.match(html, /class="hero-machine"/);
  assert.match(html, /🐕/);
  assert.doesNotMatch(html, /Synthetic Gate|Loading/);
});

test('creation and autopsy pages render symbols, receipts, navigation, raw links, and early honesty', () => {
  const early = specimen({ createdAt: RUNTIME_CONTRACT_CUTOFF_MS - 1 });
  const creation = creationPage(early, early.revisions[0]);
  assert.match(creation, /built before the runtime contract/);
  assert.match(creation, /This pre-contract specimen is not executed/);
  assert.doesNotMatch(creation, /<iframe/);
  assert.match(creation, /🐕/);
  assert.match(creation, /Dog CEO<\/a> — get a dog image/);
  assert.match(creation, /RANDOMWARE SPECIMEN RECORD/);
  assert.match(creation, /Accepted · Rev 1/);
  assert.match(creation, /STYLE CARTRIDGE/);
  assert.match(creation, /Paper Certificate/);
  assert.match(creation, /category: visual/);
  assert.match(creation, /Randomware showcase/);
  assert.match(creation, /See other specimens/);
  assert.match(creation, /Spin your own/);
  const requests = requestsPage(early);
  assert.match(requests, /Request receipts/);
  assert.match(requests, /35 ms/);
  assert.match(requests, /\?format=raw/);
  const store = new RunStore();
  const flowRun = store.createRun({ requestId: 'presentation-flow', selectedApis: [{ apiId: 'dog-ceo', operationIds: ['random'] }] });
  store.logRuntime(flowRun.id, { apiId: 'dog-ceo', operationId: 'random', status: 'ok', bytes: 1 });
  const flow = dataflowPage({ ...early, runtimeRequests: flowRun.runtimeRequests }, store.dataflow(flowRun.id));
  assert.match(flow, /Dataflow, in order/);
  assert.match(flow, /<code>random<\/code>/);
  assert.match(flow, /UTC/);
  assert.match(flow, /\?format=raw/);
  assert.match(reportPage(early), /method="post"/);
  assert.match(reportPage(early), /A report hides this specimen/);
});

test('early-specimen classification uses accepted revision time across the deployment boundary', () => {
  const spanning = specimen({ createdAt: RUNTIME_CONTRACT_CUTOFF_MS - 5000, revisions: [{ revision: 1, status: 'accepted', at: RUNTIME_CONTRACT_CUTOFF_MS + 1, bytes: 12000 }] });
  assert.equal(isEarlySpecimen(spanning), false);
  spanning.revisions[0].at = RUNTIME_CONTRACT_CUTOFF_MS - 1;
  assert.equal(isEarlySpecimen(spanning), true);
});
