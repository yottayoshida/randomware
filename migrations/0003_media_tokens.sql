CREATE TABLE IF NOT EXISTS media_tokens (
  token_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  creation_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  api_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  resolved_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  max_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  bytes_served INTEGER NOT NULL DEFAULT 0,
  active_stream INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS media_tokens_expires_idx ON media_tokens (expires_at);
