// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Record Repository (concrete SQLite implementation)
// Uses better-sqlite3 directly — accessed only through IRecordRepository.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3'
import type {
  IRecordRepository,
  RecordEntity, RecordDraft, RecordValue,
  SaveRecordOptions, UpdateRecordOptions,
} from '../contracts/IRecordRepository'
import type { IFieldRepository } from '../contracts/IFieldRepository'

// ── Utilities ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID()
}

function nowUtc(): string {
  return new Date().toISOString()
}

// ── Value serialisation ───────────────────────────────────────────────────────

interface RawValueRow {
  field_id: string
  value_text: string | null
  value_int: number | null
  value_real: number | null
  value_blob: Uint8Array | null
}

function rowToValue(row: RawValueRow): RecordValue {
  if (row.value_blob !== null) return row.value_blob
  if (row.value_int !== null) return row.value_int
  if (row.value_real !== null) return row.value_real
  return row.value_text
}

interface FieldDef {
  id: string
  field_type: string
  required: number
  default_value: string | null
}

function valueColumns(fieldType: string, value: RecordValue): {
  value_text: string | null
  value_int: number | null
  value_real: number | null
  value_blob: Uint8Array | null
} {
  if (value === null || value === undefined) {
    return { value_text: null, value_int: null, value_real: null, value_blob: null }
  }
  if (value instanceof Uint8Array) {
    return { value_text: null, value_int: null, value_real: null, value_blob: value }
  }

  const TEXT_TYPES = new Set(['text', 'multiline', 'date', 'datetime', 'choice', 'linked-file'])
  const INT_TYPES  = new Set(['integer', 'yesno'])
  const REAL_TYPES = new Set(['decimal'])

  if (INT_TYPES.has(fieldType)) {
    return { value_text: null, value_int: Number(value), value_real: null, value_blob: null }
  }
  if (REAL_TYPES.has(fieldType)) {
    return { value_text: null, value_int: null, value_real: Number(value), value_blob: null }
  }
  // Default: TEXT affinity
  return { value_text: String(value), value_int: null, value_real: null, value_blob: null }
}

// ── Row → RecordEntity ────────────────────────────────────────────────────────

function rowToRecord(
  row: Record<string, unknown>,
  valueRows: RawValueRow[],
): RecordEntity {
  const values: Record<string, RecordValue> = {}
  for (const vr of valueRows) {
    values[vr.field_id] = rowToValue(vr)
  }
  return {
    id: row.id as string,
    collectionId: row.collection_id as string,
    sequence: row.sequence as number,
    recycled: row.recycled === 1,
    recycledAt: row.recycled_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    values,
  }
}

// ── RecordRepository ──────────────────────────────────────────────────────────

export class RecordRepository implements IRecordRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly fieldRepo: IFieldRepository,
  ) {}

  // ── draft ───────────────────────────────────────────────────────────────────

  async draft(collectionId: string): Promise<RecordDraft> {
    const fields = await this.fieldRepo.list(collectionId)
    const values: Record<string, RecordValue> = {}

    for (const field of fields) {
      // FR-REC-003: populate defaults
      if (field.defaultValue !== null && field.defaultValue !== '') {
        values[field.id] = field.defaultValue
      } else {
        values[field.id] = null
      }
    }

    return { collectionId, values }
  }

  // ── save ────────────────────────────────────────────────────────────────────

  async save(options: SaveRecordOptions): Promise<RecordEntity> {
    const { collectionId, values } = options
    const fields = await this.fieldRepo.list(collectionId)

    // FR-REC-004: validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = values[field.id]
        if (val === null || val === undefined || val === '') {
          throw new Error(`Required field "${field.name}" has no value`)
        }
      }
    }

    const id = uuid()
    const now = nowUtc()

    // FR-REC-005 + NFR-005: allocate sequence and save record atomically
    const tx = this.db.transaction(() => {
      // Allocate sequence number
      const counter = this.db.prepare(`
        SELECT next_sequence FROM sequence_counters WHERE collection_id = ?
      `).get(collectionId) as { next_sequence: number } | undefined

      if (!counter) {
        throw new Error(`No sequence counter found for collection: ${collectionId}`)
      }

      const sequence = counter.next_sequence

      // Increment counter
      this.db.prepare(`
        UPDATE sequence_counters SET next_sequence = next_sequence + 1
        WHERE collection_id = ?
      `).run(collectionId)

      // Insert record
      this.db.prepare(`
        INSERT INTO records (id, collection_id, sequence, recycled, recycled_at, created_at, updated_at)
        VALUES (?, ?, ?, 0, NULL, ?, ?)
      `).run(id, collectionId, sequence, now, now)

      // Insert field values
      const fieldMap = new Map(fields.map(f => [f.id, f]))
      for (const [fieldId, value] of Object.entries(values)) {
        const field = fieldMap.get(fieldId)
        if (!field) continue // skip unknown fields
        const cols = valueColumns(field.fieldType, value)
        this.db.prepare(`
          INSERT INTO record_values (record_id, field_id, value_text, value_int, value_real, value_blob)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, fieldId, cols.value_text, cols.value_int, cols.value_real, cols.value_blob)
      }
    })

    tx()
    return this._load(id)
  }

  // ── get ─────────────────────────────────────────────────────────────────────

  async get(recordId: string): Promise<RecordEntity | null> {
    const row = this.db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
    if (!row) return null
    return this._load(recordId)
  }

  // ── list ────────────────────────────────────────────────────────────────────

  async list(collectionId: string): Promise<RecordEntity[]> {
    const rows = this.db.prepare(`
      SELECT * FROM records WHERE collection_id = ? AND recycled = 0 ORDER BY sequence ASC
    `).all(collectionId) as Record<string, unknown>[]

    return Promise.all(rows.map(r => this._load(r.id as string)))
  }

  async listRecycled(collectionId: string): Promise<RecordEntity[]> {
    const rows = this.db.prepare(`
      SELECT * FROM records WHERE collection_id = ? AND recycled = 1 ORDER BY recycled_at DESC
    `).all(collectionId) as Record<string, unknown>[]

    return Promise.all(rows.map(r => this._load(r.id as string)))
  }

  // ── update ──────────────────────────────────────────────────────────────────

  async update(recordId: string, options: UpdateRecordOptions): Promise<RecordEntity> {
    const record = await this.get(recordId)
    if (!record) throw new Error(`Record not found: ${recordId}`)

    const fields = await this.fieldRepo.list(record.collectionId)
    const fieldMap = new Map(fields.map(f => [f.id, f]))
    const now = nowUtc()

    const tx = this.db.transaction(() => {
      for (const [fieldId, value] of Object.entries(options.values)) {
        const field = fieldMap.get(fieldId)
        if (!field) continue

        const cols = valueColumns(field.fieldType, value)

        // Upsert: insert or replace value
        this.db.prepare(`
          INSERT INTO record_values (record_id, field_id, value_text, value_int, value_real, value_blob)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(record_id, field_id) DO UPDATE SET
            value_text = excluded.value_text,
            value_int  = excluded.value_int,
            value_real = excluded.value_real,
            value_blob = excluded.value_blob
        `).run(recordId, fieldId, cols.value_text, cols.value_int, cols.value_real, cols.value_blob)
      }

      this.db.prepare('UPDATE records SET updated_at = ? WHERE id = ?').run(now, recordId)
    })

    tx()
    return this._load(recordId)
  }

  // ── recycle ─────────────────────────────────────────────────────────────────

  async recycle(recordId: string): Promise<void> {
    const record = await this.get(recordId)
    if (!record) throw new Error(`Record not found: ${recordId}`)
    const now = nowUtc()
    this.db.prepare(`
      UPDATE records SET recycled = 1, recycled_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, recordId)
  }

  // ── restore ─────────────────────────────────────────────────────────────────

  async restore(recordId: string): Promise<RecordEntity> {
    const row = this.db.prepare('SELECT * FROM records WHERE id = ?').get(recordId) as Record<string, unknown> | undefined
    if (!row) throw new Error(`Record not found: ${recordId}`)
    if (!row.recycled) throw new Error(`Record is not recycled: ${recordId}`)

    const now = nowUtc()
    this.db.prepare(`
      UPDATE records SET recycled = 0, recycled_at = NULL, updated_at = ? WHERE id = ?
    `).run(now, recordId)

    return this._load(recordId)
  }

  // ── private loader ───────────────────────────────────────────────────────────

  private _load(recordId: string): RecordEntity {
    const row = this.db.prepare('SELECT * FROM records WHERE id = ?').get(recordId) as Record<string, unknown>
    const valueRows = this.db.prepare(`
      SELECT field_id, value_text, value_int, value_real, value_blob
      FROM record_values WHERE record_id = ?
    `).all(recordId) as RawValueRow[]
    return rowToRecord(row, valueRows)
  }
}
