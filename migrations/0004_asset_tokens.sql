CREATE TABLE IF NOT EXISTS asset_pages (
  page_id TEXT PRIMARY KEY,
  max_bytes INTEGER NOT NULL,
  reserved_bytes INTEGER NOT NULL DEFAULT 0,
  bytes_served INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_tokens (
  token_id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES asset_pages(page_id),
  run_id TEXT NOT NULL REFERENCES runs(id),
  creation_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  api_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  resolved_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  max_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  reserved_bytes INTEGER NOT NULL DEFAULT 0,
  bytes_served INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS asset_tokens_expires_idx ON asset_tokens (expires_at);
