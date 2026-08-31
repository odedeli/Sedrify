// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Cabinet Schema v1
// All SQL DDL for the .cabinet SQLite file.
// Metadata-driven storage: user field values live in record_values, not columns.
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1

/**
 * Schema v1 DDL — executed as a single transaction on cabinet creation.
 * Each statement is separated by a semicolon and run individually.
 */
export const SCHEMA_V1_DDL = `
  -- Cabinet metadata table (single row)
  CREATE TABLE IF NOT EXISTS cabinet_meta (
    id           TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  -- Collections (one default collection created on init — FR-CAB-002)
  CREATE TABLE IF NOT EXISTS collections (
    id           TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  -- Views (one default All Records view created on init — FR-CAB-002)
  CREATE TABLE IF NOT EXISTS views (
    id            TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    view_type     TEXT NOT NULL DEFAULT 'table',
    display_order INTEGER NOT NULL DEFAULT 0,
    config        TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  -- Fields (metadata-driven — no physical columns for user data)
  CREATE TABLE IF NOT EXISTS fields (
    id               TEXT PRIMARY KEY NOT NULL,
    collection_id    TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    field_type       TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    required         INTEGER NOT NULL DEFAULT 0,
    is_primary       INTEGER NOT NULL DEFAULT 0,
    default_value    TEXT,
    display_order    INTEGER NOT NULL DEFAULT 0,
    recycled         INTEGER NOT NULL DEFAULT 0,
    recycled_at      TEXT,
    config           TEXT NOT NULL DEFAULT '{}',
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );

  -- Records
  CREATE TABLE IF NOT EXISTS records (
    id            TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    sequence      INTEGER NOT NULL,
    recycled      INTEGER NOT NULL DEFAULT 0,
    recycled_at   TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    UNIQUE(collection_id, sequence)
  );

  -- Record values (metadata-driven storage — one row per field per record)
  CREATE TABLE IF NOT EXISTS record_values (
    record_id  TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id   TEXT NOT NULL REFERENCES fields(id),
    value_text TEXT,
    value_int  INTEGER,
    value_real REAL,
    value_blob BLOB,
    PRIMARY KEY (record_id, field_id)
  );

  -- Sequence tracker (ensures sequence numbers are never reused — FR-REC-007)
  CREATE TABLE IF NOT EXISTS sequence_counters (
    collection_id TEXT PRIMARY KEY NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    next_sequence INTEGER NOT NULL DEFAULT 1
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_fields_collection ON fields(collection_id);
  CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection_id);
  CREATE INDEX IF NOT EXISTS idx_record_values_record ON record_values(record_id);
  CREATE INDEX IF NOT EXISTS idx_record_values_field ON record_values(field_id);
`
