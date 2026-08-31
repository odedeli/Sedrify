// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Field Repository (concrete SQLite implementation)
// Uses better-sqlite3 directly — accessed only through IFieldRepository.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3'
import type {
  IFieldRepository, IChoiceOptionRepository,
  FieldEntity, ChoiceOptionEntity,
  CreateFieldOptions, UpdateFieldOptions,
} from '../contracts/IFieldRepository'
import type { IFieldTypeRegistry } from '../contracts/IFieldTypeRegistry'

// ── Utilities ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID()
}

function nowUtc(): string {
  return new Date().toISOString()
}

function rowToField(row: Record<string, unknown>): FieldEntity {
  return {
    id: row.id as string,
    collectionId: row.collection_id as string,
    name: row.name as string,
    fieldType: row.field_type as string,
    description: (row.description as string) ?? '',
    required: row.required === 1,
    isPrimary: row.is_primary === 1,
    defaultValue: row.default_value as string | null,
    displayOrder: row.display_order as number,
    recycled: row.recycled === 1,
    recycledAt: row.recycled_at as string | null,
    config: row.config ? JSON.parse(row.config as string) : {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ── FieldRepository ──────────────────────────────────────────────────────────

export class FieldRepository implements IFieldRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly registry: IFieldTypeRegistry,
  ) {}

  // ── create ──────────────────────────────────────────────────────────────────

  async create(options: CreateFieldOptions): Promise<FieldEntity> {
    const { collectionId, name, fieldType } = options

    // Validate field type is registered
    if (!this.registry.has(fieldType)) {
      throw new Error(`Unknown field type: ${fieldType}`)
    }

    // FR-FLD-002: reject duplicate names (case-insensitive)
    const existing = this.db.prepare(`
      SELECT id FROM fields
      WHERE collection_id = ? AND LOWER(name) = LOWER(?) AND recycled = 0
    `).get(collectionId, name)
    if (existing) {
      throw new Error(`A field named "${name}" already exists in this collection`)
    }

    // Determine next display order
    const maxOrder = this.db.prepare(`
      SELECT COALESCE(MAX(display_order), -1) AS max_order
      FROM fields WHERE collection_id = ? AND recycled = 0
    `).get(collectionId) as { max_order: number }

    const id = uuid()
    const now = nowUtc()
    const displayOrder = maxOrder.max_order + 1

    this.db.prepare(`
      INSERT INTO fields (
        id, collection_id, name, field_type, description,
        required, is_primary, default_value, display_order,
        recycled, recycled_at, config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
    `).run(
      id, collectionId, name, fieldType,
      options.description ?? '',
      options.required ? 1 : 0,
      options.isPrimary ? 1 : 0,
      options.defaultValue ?? null,
      displayOrder,
      JSON.stringify(options.config ?? {}),
      now, now,
    )

    return rowToField(this.db.prepare('SELECT * FROM fields WHERE id = ?').get(id) as Record<string, unknown>)
  }

  // ── list ────────────────────────────────────────────────────────────────────

  async list(collectionId: string): Promise<FieldEntity[]> {
    const rows = this.db.prepare(`
      SELECT * FROM fields
      WHERE collection_id = ? AND recycled = 0
      ORDER BY display_order ASC
    `).all(collectionId) as Record<string, unknown>[]
    return rows.map(rowToField)
  }

  async listRecycled(collectionId: string): Promise<FieldEntity[]> {
    const rows = this.db.prepare(`
      SELECT * FROM fields
      WHERE collection_id = ? AND recycled = 1
      ORDER BY recycled_at DESC
    `).all(collectionId) as Record<string, unknown>[]
    return rows.map(rowToField)
  }

  async get(fieldId: string): Promise<FieldEntity | null> {
    const row = this.db.prepare('SELECT * FROM fields WHERE id = ?').get(fieldId)
    return row ? rowToField(row as Record<string, unknown>) : null
  }

  // ── update ──────────────────────────────────────────────────────────────────

  async update(fieldId: string, options: UpdateFieldOptions): Promise<FieldEntity> {
    const field = await this.get(fieldId)
    if (!field) throw new Error(`Field not found: ${fieldId}`)

    // FR-FLD-009: block unsafe type changes on fields with existing record values
    if (options.fieldType && options.fieldType !== field.fieldType) {
      if (!this.registry.isConversionSafe(field.fieldType, options.fieldType)) {
        // Check if any record values exist for this field
        const hasValues = this.db.prepare(`
          SELECT 1 FROM record_values WHERE field_id = ? LIMIT 1
        `).get(fieldId)
        if (hasValues) {
          throw new Error(
            `Cannot change field type from "${field.fieldType}" to "${options.fieldType}": ` +
            `conversion is unsafe and the field has existing record values`
          )
        }
      }
      if (!this.registry.has(options.fieldType)) {
        throw new Error(`Unknown field type: ${options.fieldType}`)
      }
    }

    // FR-FLD-002: reject duplicate name if name changes
    if (options.name && options.name.toLowerCase() !== field.name.toLowerCase()) {
      const existing = this.db.prepare(`
        SELECT id FROM fields
        WHERE collection_id = ? AND LOWER(name) = LOWER(?) AND recycled = 0 AND id != ?
      `).get(field.collectionId, options.name, fieldId)
      if (existing) {
        throw new Error(`A field named "${options.name}" already exists in this collection`)
      }
    }

    const now = nowUtc()
    this.db.prepare(`
      UPDATE fields SET
        name          = COALESCE(?, name),
        field_type    = COALESCE(?, field_type),
        description   = COALESCE(?, description),
        required      = COALESCE(?, required),
        is_primary    = COALESCE(?, is_primary),
        default_value = ?,
        config        = COALESCE(?, config),
        updated_at    = ?
      WHERE id = ?
    `).run(
      options.name ?? null,
      options.fieldType ?? null,
      options.description ?? null,
      options.required !== undefined ? (options.required ? 1 : 0) : null,
      options.isPrimary !== undefined ? (options.isPrimary ? 1 : 0) : null,
      options.defaultValue !== undefined ? options.defaultValue : field.defaultValue,
      options.config !== undefined ? JSON.stringify(options.config) : null,
      now,
      fieldId,
    )

    return rowToField(this.db.prepare('SELECT * FROM fields WHERE id = ?').get(fieldId) as Record<string, unknown>)
  }

  // ── reorder ─────────────────────────────────────────────────────────────────

  async reorder(collectionId: string, orderedFieldIds: string[]): Promise<void> {
    const tx = this.db.transaction(() => {
      for (let i = 0; i < orderedFieldIds.length; i++) {
        this.db.prepare(`
          UPDATE fields SET display_order = ?, updated_at = ?
          WHERE id = ? AND collection_id = ?
        `).run(i, nowUtc(), orderedFieldIds[i], collectionId)
      }
    })
    tx()
  }

  // ── recycle ─────────────────────────────────────────────────────────────────

  async recycle(fieldId: string): Promise<void> {
    const field = await this.get(fieldId)
    if (!field) throw new Error(`Field not found: ${fieldId}`)
    const now = nowUtc()
    this.db.prepare(`
      UPDATE fields SET recycled = 1, recycled_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, fieldId)
  }

  // ── restore ─────────────────────────────────────────────────────────────────

  async restore(fieldId: string): Promise<FieldEntity> {
    const row = this.db.prepare('SELECT * FROM fields WHERE id = ?').get(fieldId) as Record<string, unknown> | undefined
    if (!row) throw new Error(`Field not found: ${fieldId}`)
    if (!row.recycled) throw new Error(`Field is not recycled: ${fieldId}`)

    // FR-FLD-008: append to end of active display order
    const maxOrder = this.db.prepare(`
      SELECT COALESCE(MAX(display_order), -1) AS max_order
      FROM fields WHERE collection_id = ? AND recycled = 0
    `).get(row.collection_id as string) as { max_order: number }

    const now = nowUtc()
    this.db.prepare(`
      UPDATE fields
      SET recycled = 0, recycled_at = NULL, display_order = ?, updated_at = ?
      WHERE id = ?
    `).run(maxOrder.max_order + 1, now, fieldId)

    return rowToField(this.db.prepare('SELECT * FROM fields WHERE id = ?').get(fieldId) as Record<string, unknown>)
  }
}

// ── ChoiceOptionRepository ────────────────────────────────────────────────────

export class ChoiceOptionRepository implements IChoiceOptionRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToOption(row: Record<string, unknown>): ChoiceOptionEntity {
    return {
      id: row.id as string,
      fieldId: row.field_id as string,
      label: row.label as string,
      displayOrder: row.display_order as number,
      createdAt: row.created_at as string,
    }
  }

  async list(fieldId: string): Promise<ChoiceOptionEntity[]> {
    const rows = this.db.prepare(`
      SELECT * FROM field_choice_options WHERE field_id = ? ORDER BY display_order ASC
    `).all(fieldId) as Record<string, unknown>[]
    return rows.map(r => this.rowToOption(r))
  }

  async add(fieldId: string, label: string): Promise<ChoiceOptionEntity> {
    const maxOrder = this.db.prepare(`
      SELECT COALESCE(MAX(display_order), -1) AS max_order
      FROM field_choice_options WHERE field_id = ?
    `).get(fieldId) as { max_order: number }

    const id = uuid()
    const now = nowUtc()
    this.db.prepare(`
      INSERT INTO field_choice_options (id, field_id, label, display_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, fieldId, label, maxOrder.max_order + 1, now)

    return this.rowToOption(
      this.db.prepare('SELECT * FROM field_choice_options WHERE id = ?').get(id) as Record<string, unknown>
    )
  }

  async updateLabel(optionId: string, label: string): Promise<ChoiceOptionEntity> {
    this.db.prepare('UPDATE field_choice_options SET label = ? WHERE id = ?').run(label, optionId)
    const row = this.db.prepare('SELECT * FROM field_choice_options WHERE id = ?').get(optionId)
    if (!row) throw new Error(`Choice option not found: ${optionId}`)
    return this.rowToOption(row as Record<string, unknown>)
  }

  async remove(optionId: string): Promise<void> {
    this.db.prepare('DELETE FROM field_choice_options WHERE id = ?').run(optionId)
  }

  async reorder(fieldId: string, orderedOptionIds: string[]): Promise<void> {
    const tx = this.db.transaction(() => {
      for (let i = 0; i < orderedOptionIds.length; i++) {
        this.db.prepare(`
          UPDATE field_choice_options SET display_order = ? WHERE id = ? AND field_id = ?
        `).run(i, orderedOptionIds[i], fieldId)
      }
    })
    tx()
  }
}
