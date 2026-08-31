// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Schema v1 Field Choice Options DDL
// Applied on cabinet creation as part of schema v1 initialisation.
// This extends the base schema in schema.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const FIELD_CHOICE_OPTIONS_DDL = `
  CREATE TABLE IF NOT EXISTS field_choice_options (
    id            TEXT PRIMARY KEY NOT NULL,
    field_id      TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_choice_options_field ON field_choice_options(field_id);
`
