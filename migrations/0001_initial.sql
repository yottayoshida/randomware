CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL,
  selected_apis_json TEXT NOT NULL,
  history_json TEXT NOT NULL,
  concept_json TEXT,
  created_at INTEGER NOT NULL,
  creation_id TEXT UNIQUE,
  failure_code TEXT,
  repair_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS artifact_revisions (
  run_id TEXT NOT NULL REFERENCES runs(id),
  revision INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  html TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (run_id, revision)
);

CREATE TABLE IF NOT EXISTS runtime_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id),
  api_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  status TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_health (
  api_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  checked_at INTEGER,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS daily_budgets (
  scope TEXT NOT NULL,
  utc_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL,
  PRIMARY KEY (scope, utc_date)
);
