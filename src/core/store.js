const crypto = require('node:crypto');
const { startChoreography, noteChoreographyActivity, advanceChoreography } = require('./choreography');
const { applyListingPolicy } = require('./presentation');

const phases = Object.freeze({ SPINNED: 'spinned', CONCEPT_ACCEPTED: 'concept_accepted', BUILDING: 'building', REPAIR_REQUESTED: 'repair_requested', COMPLETED: 'completed', FAILED: 'failed' });

const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

class RunStore {
  constructor() {
    this.runs = new Map();
    this.requestIndex = new Map();
    this.runtimeRequests = [];
    this.mediaTokens = new Map();
    this.assetTokens = new Map();
    this.assetPages = new Map();
  }

  listCreations() {
    return [...this.runs.values()].filter((run) => run.creationId).sort((left, right) => right.createdAt - left.createdAt);
  }

  createRun({ requestId, selectedApis, history = [] }) {
    if (this.requestIndex.has(requestId)) return this.runs.get(this.requestIndex.get(requestId));
    const now = Date.now();
    const run = {
      id: id('run'), requestId, phase: phases.SPINNED, selectedApis: structuredClone(selectedApis), history: structuredClone(history),
      concept: null, conceptHistory: [], revisions: [], repairCount: 0, failure: null, events: [{ type: 'spin_received', at: now }], createdAt: now,
      choreography: startChoreography(phases.SPINNED, now),
      creationId: null, runtimeRequests: [], listed: false
    };
    this.runs.set(run.id, run); this.requestIndex.set(requestId, run.id); return run;
  }

  getRun(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('run_not_found');
    return run;
  }

  noteActivity(runId, now = Date.now(), expectedPhases = null) {
    const run = this.getRun(runId);
    if (run.phase !== phases.COMPLETED && run.phase !== phases.FAILED && (!expectedPhases || expectedPhases.includes(run.phase))) noteChoreographyActivity(run, now);
    return run;
  }

  findByCreation(creationId) {
    for (const run of this.runs.values()) if (run.creationId === creationId) return run;
    throw new Error('creation_not_found');
  }

  acceptConcept(runId, concept) {
    const run = this.getRun(runId);
    if (run.concept && run.concept.requestId === concept.requestId) return run;
    if (run.phase !== phases.SPINNED || run.concept) throw new Error('phase_or_idempotency');
    const selectedIds = run.selectedApis.map((api) => api.apiId).sort();
    if (JSON.stringify(selectedIds) !== JSON.stringify([...concept.apiIds].sort())) throw new Error('immutable_api_set');
    run.concept = structuredClone(concept); run.phase = phases.CONCEPT_ACCEPTED;
    run.events.push({ type: 'concept_accepted', at: Date.now() }); advanceChoreography(run); return run;
  }

  rerollConcept(runId, { requestId, appName = '', premise = '' } = {}) {
    const run = this.getRun(runId);
    if (run.phase !== phases.SPINNED || run.concept) throw new Error('phase_or_idempotency');
    run.conceptHistory.push({ requestId, appName: String(appName).slice(0, 48), premise: String(premise).slice(0, 180), at: Date.now() });
    run.events.push({ type: 'concept_rerolled', at: Date.now() });
    return run;
  }

  acceptArtifact(runId, { requestId, html, sha256, bytes }) {
    const run = this.getRun(runId);
    if (run.revisions.some((revision) => revision.requestId === requestId)) return run;
    if (run.phase !== phases.CONCEPT_ACCEPTED && run.phase !== phases.BUILDING) throw new Error('phase_or_idempotency');
    run.phase = phases.COMPLETED; run.creationId = run.creationId || id('creation');
    run.revisions.push({ revision: 1, requestId, html, sha256, bytes, status: 'accepted', at: Date.now() });
    run.events.push({ type: 'artifact_received', at: Date.now() }, { type: 'deployed', at: Date.now() }); advanceChoreography(run); applyListingPolicy(run); return run;
  }

  recordArtifactFailure(runId, { requestId, code, html, bytes = Buffer.byteLength(String(html || ''), 'utf8'), sha256 = html == null ? null : crypto.createHash('sha256').update(String(html)).digest('hex') }) {
    const run = this.getRun(runId);
    if (run.phase !== phases.CONCEPT_ACCEPTED && run.phase !== phases.BUILDING) throw new Error('phase_or_idempotency');
    run.phase = phases.REPAIR_REQUESTED; run.creationId = run.creationId || id('creation'); run.failure = { code, requestId, html }; run.revisions.push({ revision: 1, requestId, html, bytes, sha256, status: 'failed', at: Date.now() });
    run.events.push({ type: 'artifact_received', at: Date.now() }, { type: 'repair_requested', at: Date.now() }); advanceChoreography(run); run.listed = false; return run;
  }

  acceptRepair(runId, { requestId, html, sha256, bytes }) {
    const run = this.getRun(runId);
    if (run.revisions.some((revision) => revision.requestId === requestId)) return run;
    if (run.phase !== phases.REPAIR_REQUESTED || run.repairCount >= 1) throw new Error('repair_limit');
    run.repairCount += 1; run.phase = phases.COMPLETED; run.revisions.push({ revision: 2, requestId, html, sha256, bytes, status: 'accepted', at: Date.now() });
    run.events.push({ type: 'repair_artifact_received', at: Date.now() }, { type: 'deployed', at: Date.now() }); advanceChoreography(run); applyListingPolicy(run); return run;
  }

  recordRepairFailure(runId, { requestId, code, html, bytes = Buffer.byteLength(String(html || ''), 'utf8'), sha256 = html == null ? null : crypto.createHash('sha256').update(String(html)).digest('hex') }) {
    const run = this.getRun(runId);
    if (run.phase !== phases.REPAIR_REQUESTED || run.repairCount >= 1) throw new Error('repair_limit');
    run.repairCount += 1; run.phase = phases.FAILED; run.creationId = run.creationId || id('creation'); run.failure = { code: code || 'repair_failed', requestId, html };
    run.revisions.push({ revision: 2, requestId, html, bytes, sha256, status: 'failed', at: Date.now() });
    run.events.push({ type: 'repair_artifact_received', at: Date.now() }, { type: 'failed', code: 'repair_failed', at: Date.now() }); advanceChoreography(run); applyListingPolicy(run); return run;
  }

  fail(runId, code, detail = '') {
    const run = this.getRun(runId); run.phase = phases.FAILED; run.failure = { code, detail }; run.events.push({ type: 'failed', code, at: Date.now() }); return run;
  }

  setCapabilityExpiry(runId, expiresAt) {
    const run = this.getRun(runId); run.lastCapabilityExpiresAt = Number(expiresAt); return run;
  }

  logRuntime(runId, request) {
    const run = this.getRun(runId); const row = { ...request, runId, startedAt: request.startedAt || Date.now(), endedAt: Date.now() };
    run.runtimeRequests.push(row); this.runtimeRequests.push(row); return row;
  }

  dataflow(runId) {
    const run = this.getRun(runId); const calls = new Set(run.runtimeRequests.filter((row) => row.status === 'ok').map((row) => row.apiId));
    const expired = run.lastCapabilityExpiresAt && Date.now() >= run.lastCapabilityExpiresAt;
    return run.selectedApis.map((entry, index) => ({ apiId: entry.apiId, operationIds: entry.operationIds, status: calls.has(entry.apiId) ? 'observed' : (expired ? 'unused' : (run.phase === phases.COMPLETED ? 'not_yet_observed' : 'pending')), order: index + 1 }));
  }

  assertRuntimeQuota(runId, quotas = {}) {
    const run = this.getRun(runId);
    const completed = run.runtimeRequests.filter((row) => row.status === 'ok').length;
    const bytes = run.runtimeRequests.reduce((sum, row) => sum + (row.bytes || 0), 0);
    if (completed >= (quotas.jsonCalls || 30) || bytes >= (quotas.adaptedBytes || 1024 * 1024)) throw new Error('capacity_reached');
    return { completed, bytes };
  }

  createMediaToken(runId, record) {
    this.getRun(runId);
    this.mediaTokens.set(record.tokenId, { ...record, runId, active: false, streamLease: null, bytesServed: 0 });
    return record;
  }

  getMediaToken(tokenId) {
    const record = this.mediaTokens.get(tokenId);
    if (!record) throw new Error('media_token_not_found');
    return record;
  }

  startMediaStream(tokenId) {
    const record = this.getMediaToken(tokenId);
    if (Date.now() >= record.expiresAt) throw new Error('media_capability_invalid');
    if (record.bytesServed >= record.maxBytes) throw new Error('media_bytes_cap');
    record.active = true;
    record.streamLease = crypto.randomUUID();
    return { ...record };
  }

  finishMediaStream(tokenId, bytes, streamLease) {
    const record = this.getMediaToken(tokenId);
    record.bytesServed = Math.min(record.maxBytes, record.bytesServed + Math.max(0, Number(bytes) || 0));
    if (record.streamLease === streamLease) { record.active = false; record.streamLease = null; }
    return { ...record };
  }

  createAssetToken(runId, record) {
    this.getRun(runId);
    this.assetTokens.set(record.tokenId, { ...record, runId, reservedBytes: 0, bytesServed: 0, used: false });
    if (!this.assetPages.has(record.pageId)) this.assetPages.set(record.pageId, { pageId: record.pageId, maxBytes: record.pageMaxBytes, reservedBytes: 0, bytesServed: 0 });
    return record;
  }

  getAssetToken(tokenId) {
    const record = this.assetTokens.get(tokenId);
    if (!record) throw new Error('asset_token_not_found');
    return record;
  }

  reserveAsset(tokenId, requestedBytes) {
    const record = this.getAssetToken(tokenId); const page = this.assetPages.get(record.pageId); const reservation = Math.min(record.maxBytes, Math.max(1, Number(requestedBytes) || record.maxBytes));
    if (Date.now() >= record.expiresAt) throw new Error('asset_capability_invalid');
    if (record.used || record.reservedBytes) throw new Error('asset_token_used');
    if (page.bytesServed + page.reservedBytes + reservation > page.maxBytes) throw new Error('asset_page_bytes_cap');
    record.reservedBytes = reservation; page.reservedBytes += reservation; return { ...record };
  }

  finishAsset(tokenId, bytes) {
    const record = this.getAssetToken(tokenId); const page = this.assetPages.get(record.pageId); const served = Math.min(record.reservedBytes || record.maxBytes, Math.max(0, Number(bytes) || 0));
    page.reservedBytes = Math.max(0, page.reservedBytes - record.reservedBytes); page.bytesServed += served; record.reservedBytes = 0; record.bytesServed = served; record.used = true; return { ...record };
  }

  reportCreation(creationId, reason = 'unspecified') {
    const run = this.findByCreation(creationId); run.reported = true; run.listed = false; run.events.push({ type: 'reported', reason: String(reason).slice(0, 120), at: Date.now() }); return run;
  }

  unpublishCreation(creationId) {
    const run = this.findByCreation(creationId); run.unpublished = true; run.listed = false; run.events.push({ type: 'unpublished', at: Date.now() }); return run;
  }
}

module.exports = { RunStore, phases };
