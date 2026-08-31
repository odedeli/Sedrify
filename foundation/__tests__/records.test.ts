// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Sprint F-3 Tests
// Record engine: draft, save, get, list, update, recycle, restore, sequence.
// No Electron, no UI — pure Node.js + Vitest + better-sqlite3.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { CabinetEngine } from '../cabinet/CabinetEngine'
import { FieldTypeRegistry } from '../fields/FieldTypeRegistry'
import { FieldRepository } from '../fields/FieldRepository'
import { RecordRepository } from '../records/RecordRepository'
import type { IRecordRepository } from '../contracts/IRecordRepository'
import type { IFieldRepository } from '../contracts/IFieldRepository'
import type Database from 'better-sqlite3'

// ── Test helpers ──────────────────────────────────────────────────────────────

let testDir: string
let engine: CabinetEngine
let db: Database.Database
let fieldRepo: IFieldRepository
let recordRepo: IRecordRepository
let collectionId: string
let titleFieldId: string
let yearFieldId: string
let watchedFieldId: string
let requiredFieldId: string

beforeEach(async () => {
  testDir = join(tmpdir(), `sedrify-f3-${Date.now()}`)
  mkdirSync(testDir, { recursive: true })

  engine = new CabinetEngine()
  await engine.create({ path: join(testDir, 'test.cabinet'), name: 'Test' })
  db = engine.getDb()

  const registry = new FieldTypeRegistry()
  fieldRepo = new FieldRepository(db, registry)
  recordRepo = new RecordRepository(db, fieldRepo)

  const col = db.prepare('SELECT id FROM collections LIMIT 1').get() as { id: string }
  collectionId = col.id

  // Seed fields
  const titleField = await fieldRepo.create({
    collectionId, name: 'Title', fieldType: 'text',
    isPrimary: true, defaultValue: null,
  })
  titleFieldId = titleField.id

  const yearField = await fieldRepo.create({
    collectionId, name: 'Year', fieldType: 'integer',
    defaultValue: '2026',
  })
  yearFieldId = yearField.id

  const watchedField = await fieldRepo.create({
    collectionId, name: 'Watched', fieldType: 'yesno',
    defaultValue: '0',
  })
  watchedFieldId = watchedField.id

  const requiredField = await fieldRepo.create({
    collectionId, name: 'Required Field', fieldType: 'text',
    required: true, defaultValue: null,
  })
  requiredFieldId = requiredField.id
})

afterEach(async () => {
  await engine.close()
  rmSync(testDir, { recursive: true, force: true })
})

// ── AC-1: draft() ─────────────────────────────────────────────────────────────

describe('RecordRepository.draft()', () => {
  it('AC-1a: returns a draft with default values from active fields (FR-REC-003)', async () => {
    const draft = await recordRepo.draft(collectionId)
    expect(draft.collectionId).toBe(collectionId)
    // Year field has default '2026'
    expect(draft.values[yearFieldId]).toBe('2026')
    // Watched field has default '0'
    expect(draft.values[watchedFieldId]).toBe('0')
    // Title has no default — null
    expect(draft.values[titleFieldId]).toBeNull()
  })

  it('AC-1b: draft does not consume a sequence number (FR-REC-006)', async () => {
    const before = (db.prepare('SELECT next_sequence FROM sequence_counters WHERE collection_id = ?').get(collectionId) as { next_sequence: number }).next_sequence

    await recordRepo.draft(collectionId)
    await recordRepo.draft(collectionId)
    await recordRepo.draft(collectionId)

    const after = (db.prepare('SELECT next_sequence FROM sequence_counters WHERE collection_id = ?').get(collectionId) as { next_sequence: number }).next_sequence
    expect(after).toBe(before) // unchanged
  })
})

// ── AC-2: save() ──────────────────────────────────────────────────────────────

describe('RecordRepository.save()', () => {
  it('AC-2a: saves a record and returns it with a sequence number (FR-REC-005)', async () => {
    const record = await recordRepo.save({
      collectionId,
      values: {
        [titleFieldId]: 'The Godfather',
        [yearFieldId]: 1972,
        [watchedFieldId]: 1,
        [requiredFieldId]: 'required value',
      },
    })

    expect(record.id).toBeTruthy()
    expect(record.sequence).toBe(1)
    expect(record.collectionId).toBe(collectionId)
    expect(record.recycled).toBe(false)
    expect(record.values[titleFieldId]).toBe('The Godfather')
  })

  it('AC-2b: sequence numbers increment — never reused (FR-REC-007)', async () => {
    const r1 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'A', [requiredFieldId]: 'x' } })
    const r2 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'B', [requiredFieldId]: 'y' } })
    const r3 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'C', [requiredFieldId]: 'z' } })

    expect(r1.sequence).toBe(1)
    expect(r2.sequence).toBe(2)
    expect(r3.sequence).toBe(3)
  })

  it('AC-2c: recycled records do not get their sequence reused (FR-REC-007)', async () => {
    const r1 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'A', [requiredFieldId]: 'x' } })
    await recordRepo.recycle(r1.id)
    const r2 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'B', [requiredFieldId]: 'y' } })
    expect(r2.sequence).toBe(2) // not 1
  })

  it('AC-4: save() is transactional — fails atomically on required validation (NFR-005)', async () => {
    const beforeCount = (db.prepare('SELECT COUNT(*) AS c FROM records').get() as { c: number }).c
    const beforeSeq = (db.prepare('SELECT next_sequence FROM sequence_counters WHERE collection_id = ?').get(collectionId) as { next_sequence: number }).next_sequence

    await expect(
      recordRepo.save({
        collectionId,
        values: { [titleFieldId]: 'Good value', [requiredFieldId]: '' }, // required field empty
      })
    ).rejects.toThrow(/Required field/)

    const afterCount = (db.prepare('SELECT COUNT(*) AS c FROM records').get() as { c: number }).c
    const afterSeq = (db.prepare('SELECT next_sequence FROM sequence_counters WHERE collection_id = ?').get(collectionId) as { next_sequence: number }).next_sequence

    // No record inserted, sequence not incremented
    expect(afterCount).toBe(beforeCount)
    expect(afterSeq).toBe(beforeSeq)
  })

  it('AC-3: required field validation blocks save (FR-REC-004)', async () => {
    await expect(
      recordRepo.save({
        collectionId,
        values: { [titleFieldId]: 'Film', [requiredFieldId]: null },
      })
    ).rejects.toThrow(/Required field/)
  })
})

// ── AC-5: get() ───────────────────────────────────────────────────────────────

describe('RecordRepository.get()', () => {
  it('AC-5a: returns a record with all field values', async () => {
    const saved = await recordRepo.save({
      collectionId,
      values: {
        [titleFieldId]: 'Blade Runner 2049',
        [yearFieldId]: 2017,
        [requiredFieldId]: 'present',
      },
    })

    const loaded = await recordRepo.get(saved.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(saved.id)
    expect(loaded!.sequence).toBe(saved.sequence)
    expect(loaded!.values[titleFieldId]).toBe('Blade Runner 2049')
    expect(loaded!.values[yearFieldId]).toBe(2017)
  })

  it('AC-5b: returns null for unknown record ID', async () => {
    const result = await recordRepo.get('non-existent-id')
    expect(result).toBeNull()
  })
})

// ── AC-6: list() ──────────────────────────────────────────────────────────────

describe('RecordRepository.list()', () => {
  it('AC-6a: returns active records in sequence order', async () => {
    await recordRepo.save({ collectionId, values: { [titleFieldId]: 'A', [requiredFieldId]: 'x' } })
    await recordRepo.save({ collectionId, values: { [titleFieldId]: 'B', [requiredFieldId]: 'y' } })
    await recordRepo.save({ collectionId, values: { [titleFieldId]: 'C', [requiredFieldId]: 'z' } })

    const records = await recordRepo.list(collectionId)
    expect(records).toHaveLength(3)
    expect(records[0].values[titleFieldId]).toBe('A')
    expect(records[1].values[titleFieldId]).toBe('B')
    expect(records[2].values[titleFieldId]).toBe('C')
  })

  it('AC-6b: does not return recycled records', async () => {
    const r1 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'Active', [requiredFieldId]: 'x' } })
    const r2 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'Recycled', [requiredFieldId]: 'y' } })
    await recordRepo.recycle(r2.id)

    const records = await recordRepo.list(collectionId)
    expect(records).toHaveLength(1)
    expect(records[0].id).toBe(r1.id)
  })

  it('AC-6c: listRecycled() returns only recycled records', async () => {
    const r1 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'Active', [requiredFieldId]: 'x' } })
    const r2 = await recordRepo.save({ collectionId, values: { [titleFieldId]: 'Recycled', [requiredFieldId]: 'y' } })
    await recordRepo.recycle(r2.id)

    const recycled = await recordRepo.listRecycled(collectionId)
    expect(recycled).toHaveLength(1)
    expect(recycled[0].id).toBe(r2.id)
  })
})

// ── AC-7: update() ────────────────────────────────────────────────────────────

describe('RecordRepository.update()', () => {
  it('AC-7a: updates specified field values only', async () => {
    const record = await recordRepo.save({
      collectionId,
      values: {
        [titleFieldId]: 'Original',
        [yearFieldId]: 2000,
        [requiredFieldId]: 'x',
      },
    })

    const updated = await recordRepo.update(record.id, {
      values: { [titleFieldId]: 'Updated' },
    })

    expect(updated.values[titleFieldId]).toBe('Updated')
    expect(updated.values[yearFieldId]).toBe(2000) // unchanged
  })

  it('AC-7b: can set a value to null', async () => {
    const record = await recordRepo.save({
      collectionId,
      values: { [titleFieldId]: 'Film', [yearFieldId]: 2020, [requiredFieldId]: 'x' },
    })

    const updated = await recordRepo.update(record.id, {
      values: { [yearFieldId]: null },
    })
    expect(updated.values[yearFieldId]).toBeNull()
  })
})

// ── AC-8: recycle() ───────────────────────────────────────────────────────────

describe('RecordRepository.recycle()', () => {
  it('AC-8a: marks record as recycled, preserves all values (FR-REC-010, FR-REC-011)', async () => {
    const record = await recordRepo.save({
      collectionId,
      values: { [titleFieldId]: 'To Recycle', [requiredFieldId]: 'x' },
    })

    await recordRepo.recycle(record.id)

    const recycled = await recordRepo.listRecycled(collectionId)
    const found = recycled.find(r => r.id === record.id)
    expect(found).toBeDefined()
    expect(found!.recycled).toBe(true)
    expect(found!.recycledAt).toBeTruthy()
    // Values are preserved
    expect(found!.values[titleFieldId]).toBe('To Recycle')
  })
})

// ── AC-9: restore() ───────────────────────────────────────────────────────────

describe('RecordRepository.restore()', () => {
  it('AC-9: restores recycled record to active collection', async () => {
    const record = await recordRepo.save({
      collectionId,
      values: { [titleFieldId]: 'To Restore', [requiredFieldId]: 'x' },
    })
    await recordRepo.recycle(record.id)

    const restored = await recordRepo.restore(record.id)
    expect(restored.recycled).toBe(false)
    expect(restored.recycledAt).toBeNull()

    const active = await recordRepo.list(collectionId)
    expect(active.some(r => r.id === record.id)).toBe(true)
  })
})

// ── AC-10: recycled field values preserved (FR-REC-010) ──────────────────────

describe('Recycled field values preserved (FR-REC-010)', () => {
  it('AC-10: recycling a field does not delete its stored record values', async () => {
    const record = await recordRepo.save({
      collectionId,
      values: {
        [titleFieldId]: 'Parasite',
        [yearFieldId]: 2019,
        [requiredFieldId]: 'present',
      },
    })

    // Recycle the year field
    await fieldRepo.recycle(yearFieldId)

    // Reload the record — year value should still be present
    const loaded = await recordRepo.get(record.id)
    expect(loaded!.values[yearFieldId]).toBe(2019)

    // But year field should not appear in active field list
    const activeFields = await fieldRepo.list(collectionId)
    expect(activeFields.some(f => f.id === yearFieldId)).toBe(false)
  })
})

// ── AC-11: IRecordRepository mockability (NFR-011) ───────────────────────────

describe('IRecordRepository mockability (NFR-011)', () => {
  it('AC-11: a mock implementation satisfies the IRecordRepository interface', async () => {
    const mockRecord = {
      id: 'mock-record-id',
      collectionId: 'col-1',
      sequence: 1,
      recycled: false,
      recycledAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { 'field-1': 'Mock Title' },
    }

    const mock: IRecordRepository = {
      draft: async () => ({ collectionId: 'col-1', values: {} }),
      save: async () => mockRecord,
      get: async () => mockRecord,
      list: async () => [mockRecord],
      listRecycled: async () => [],
      update: async () => mockRecord,
      recycle: async () => {},
      restore: async () => mockRecord,
    }

    const records = await mock.list('col-1')
    expect(records).toHaveLength(1)
    expect(records[0].sequence).toBe(1)

    const draft = await mock.draft('col-1')
    expect(draft.collectionId).toBe('col-1')

    const saved = await mock.save({ collectionId: 'col-1', values: {} })
    expect(saved.id).toBe('mock-record-id')
  })
})
