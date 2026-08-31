// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Field Type Registry Contract
// NFR-011: All layer boundaries must be mockable.
// ─────────────────────────────────────────────────────────────────────────────

/** SQLite native storage affinities. */
export type SqliteAffinity = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB'

/** How a field participates in search. */
export type SearchHint = 'fulltext' | 'exact' | 'filename' | 'none'

/** A registered field type definition. */
export interface FieldTypeDefinition {
  /** Unique type identifier — e.g. 'text', 'integer', 'yesno'. */
  typeId: string
  /** Human-readable label — e.g. 'Single-line text'. */
  label: string
  /** SQLite storage affinity for this type. */
  affinity: SqliteAffinity
  /** How this field participates in search. */
  searchHint: SearchHint
  /**
   * Returns a plain-text representation of a stored value.
   * Used before feature modules are loaded (Foundation-level display).
   */
  displayHint(rawValue: string | number | null): string
  /**
   * Validates a raw input value for this type.
   * Returns null if valid, or an error message string if invalid.
   */
  validate(rawValue: unknown): string | null
  /**
   * Type identifiers this type may be safely converted to.
   * Conversion is safe when no data loss occurs (FR-FLD-009, Appendix B).
   */
  safeConversionTargets: string[]
}

export interface IFieldTypeRegistry {
  /** Return the definition for a type ID, or undefined if not registered. */
  get(typeId: string): FieldTypeDefinition | undefined

  /** Return all registered field type definitions. */
  all(): FieldTypeDefinition[]

  /** Return true if the type ID is registered. */
  has(typeId: string): boolean

  /**
   * Return true if converting from one type to another is safe.
   * Safe means no data loss as defined in Appendix B.
   */
  isConversionSafe(fromTypeId: string, toTypeId: string): boolean
}
