// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Field Repository Contract
// NFR-011: All layer boundaries must be mockable.
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldEntity {
  id: string
  collectionId: string
  name: string
  fieldType: string
  description: string
  required: boolean
  isPrimary: boolean
  defaultValue: string | null
  displayOrder: number
  recycled: boolean
  recycledAt: string | null
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateFieldOptions {
  collectionId: string
  name: string
  fieldType: string
  description?: string
  required?: boolean
  isPrimary?: boolean
  defaultValue?: string | null
  config?: Record<string, unknown>
}

export interface UpdateFieldOptions {
  name?: string
  fieldType?: string
  description?: string
  required?: boolean
  isPrimary?: boolean
  defaultValue?: string | null
  config?: Record<string, unknown>
}

export interface IFieldRepository {
  /**
   * Create a new field in a collection.
   * - Rejects duplicate names within a collection, case-insensitive (FR-FLD-002).
   * - Rejects unknown field types.
   * - Appends to end of active display order.
   */
  create(options: CreateFieldOptions): Promise<FieldEntity>

  /** Return all active (non-recycled) fields for a collection, in display order. */
  list(collectionId: string): Promise<FieldEntity[]>

  /** Return all recycled fields for a collection. */
  listRecycled(collectionId: string): Promise<FieldEntity[]>

  /** Return a single field by ID, or null if not found. */
  get(fieldId: string): Promise<FieldEntity | null>

  /**
   * Update field properties.
   * - Rejects unsafe type changes on fields with existing record values (FR-FLD-009).
   * - Rejects duplicate name if name changes collide with existing field.
   */
  update(fieldId: string, options: UpdateFieldOptions): Promise<FieldEntity>

  /**
   * Update display order for a list of field IDs.
   * The array position determines the new displayOrder (0-indexed).
   */
  reorder(collectionId: string, orderedFieldIds: string[]): Promise<void>

  /**
   * Mark a field as recycled.
   * Preserves all configuration and record values (FR-FLD-007).
   */
  recycle(fieldId: string): Promise<void>

  /**
   * Restore a recycled field.
   * Appends to end of active display order (FR-FLD-008).
   */
  restore(fieldId: string): Promise<FieldEntity>
}

// ── Choice options (for single-choice field type) ─────────────────────────────

export interface ChoiceOptionEntity {
  id: string
  fieldId: string
  label: string
  displayOrder: number
  createdAt: string
}

export interface IChoiceOptionRepository {
  /** Return all choice options for a field in display order. */
  list(fieldId: string): Promise<ChoiceOptionEntity[]>

  /** Add a new choice option to a field. */
  add(fieldId: string, label: string): Promise<ChoiceOptionEntity>

  /** Update the label of a choice option. */
  updateLabel(optionId: string, label: string): Promise<ChoiceOptionEntity>

  /** Remove a choice option. */
  remove(optionId: string): Promise<void>

  /** Reorder choice options for a field. */
  reorder(fieldId: string, orderedOptionIds: string[]): Promise<void>
}
