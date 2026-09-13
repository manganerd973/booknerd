CREATE TABLE IF NOT EXISTS app_schema (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_schema (id, version, updated_at)
VALUES ('booknerd', 53, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  version = CASE WHEN app_schema.version < 53 THEN 53 ELSE app_schema.version END,
  updated_at = CASE WHEN app_schema.version < 53 THEN CURRENT_TIMESTAMP ELSE app_schema.updated_at END;
