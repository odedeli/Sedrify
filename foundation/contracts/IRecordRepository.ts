// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Record Repository Contract
// NFR-011: All layer boundaries must be mockable.
// ─────────────────────────────────────────────────────────────────────────────

/** Raw value stored in a record — maps to SQLite affinity types. */
export type RecordValue = string | number | Uint8Array | null

/** A single field value entry within a record. */
export interface RecordFieldValue {
  fieldId: string
  value: RecordValue
}

/** A fully loaded record with all its field values. */
export interface RecordEntity {
  id: string
  collectionId: string
  /** Permanent sequence number — never reused (FR-REC-007). */
  sequence: number
  recycled: boolean
  recycledAt: string | null
  createdAt: string
  updatedAt: string
  /** All field values for this record, keyed by fieldId. */
  values: Record<string, RecordValue>
}

/** A draft record — not yet saved, no sequence number allocated. */
export interface RecordDraft {
  collectionId: string
  /** Pre-populated from field default values (FR-REC-003). */
  values: Record<string, RecordValue>
}

export interface SaveRecordOptions {
  collectionId: string
  /** Values to save — keyed by fieldId. */
  values: Record<string, RecordValue>
}

export interface UpdateRecordOptions {
  /** Partial field values to update — only provided keys are changed. */
  values: Record<string, RecordValue>
}

export interface IRecordRepository {
  /**
   * Build a new record draft with default values from active fields.
   * Does NOT allocate a sequence number — drafts are in-memory only (FR-REC-006).
   */
  draft(collectionId: string): Promise<RecordDraft>

  /**
   * Save a record draft as a permanent record.
   * - Allocates a sequence number (FR-REC-005).
   * - Validates required fields (FR-REC-004).
   * - Transactional — sequence and record saved atomically (NFR-005).
   * - Throws if a required field has no value.
   */
  save(options: SaveRecordOptions): Promise<RecordEntity>

  /** Return a single record with all field values, or null if not found. */
  get(recordId: string): Promise<RecordEntity | null>

  /**
   * Return all active (non-recycled) records for a collection with their values.
   * Ordered by sequence ascending.
   */
  list(collectionId: string): Promise<RecordEntity[]>

  /**
   * Return all recycled records for a collection.
   * Ordered by recycled_at descending.
   */
  listRecycled(collectionId: string): Promise<RecordEntity[]>

  /**
   * Update field values on a saved record.
   * Only provided keys are changed — other values are preserved.
   */
  update(recordId: string, options: UpdateRecordOptions): Promise<RecordEntity>

  /**
   * Mark a record as recycled.
   * All field values are preserved (FR-REC-010, FR-REC-011).
   */
  recycle(recordId: string): Promise<void>

  /**
   * Restore a recycled record to the active collection.
   */
  restore(recordId: string): Promise<RecordEntity>
}
