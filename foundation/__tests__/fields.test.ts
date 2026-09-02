// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Sprint F-2 Tests
// Field type registry + field CRUD + choice options.
// No Electron, no UI — pure Node.js + Vitest + better-sqlite3.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { FieldTypeRegistry } from '../fields/FieldTypeRegistry'
import { FieldRepository, ChoiceOptionRepository } from '../fields/FieldRepository'
import { CabinetEngine } from '../cabinet/CabinetEngine'
import type { IFieldTypeRegistry } from '../contracts/IFieldTypeRegistry'
import type { IFieldRepository, IChoiceOptionRepository } from '../contracts/IFieldRepository'

// ── Test helpers ──────────────────────────────────────────────────────────────

let testDir: string
let engine: CabinetEngine
let db: Database.Database
let registry: FieldTypeRegistry
let fieldRepo: IFieldRepository
let choiceRepo: IChoiceOptionRepository
let collectionId: string

beforeEach(async () => {
  testDir = join(tmpdir(), `sedrify-f2-${Date.now()}`)
  mkdirSync(testDir, { recursive: true })
  engine = new CabinetEngine()
  await engine.create({ path: join(testDir, 'test.cabinet'), name: 'Test' })
  db = engine.getDb()
  registry = new FieldTypeRegistry()
  fieldRepo = new FieldRepository(db, registry)
  choiceRepo = new ChoiceOptionRepository(db)

  // Get the default collection ID
  const col = db.prepare('SELECT id FROM collections LIMIT 1').get() as { id: string }
  collectionId = col.id
})

afterEach(async () => {
  await engine.close()
  rmSync(testDir, { recursive: true, force: true })
})

// ── AC-1: FieldTypeRegistry has exactly 10 foundation types ──────────────────

describe('FieldTypeRegistry', () => {
  it('AC-1a: registers exactly 22 field types (10 foundation + 12 extended)', () => {
    expect(registry.all()).toHaveLength(22)
  })

  it('AC-1b: all 10 types are registered by ID', () => {
    const expectedIds = [
      'text', 'multiline', 'integer', 'decimal',
      'date', 'datetime', 'yesno', 'choice',
      'linked-file', 'embedded-file',
    ]
    for (const id of expectedIds) {
      expect(registry.has(id)).toBe(true)
    }
  })

  it('AC-1c: each type has required properties', () => {
    for (const def of registry.all()) {
      expect(def.typeId).toBeTruthy()
      expect(def.label).toBeTruthy()
      expect(['TEXT', 'INTEGER', 'REAL', 'BLOB']).toContain(def.affinity)
      expect(['fulltext', 'exact', 'filename', 'none']).toContain(def.searchHint)
      expect(typeof def.validate).toBe('function')
      expect(typeof def.displayHint).toBe('function')
      expect(Array.isArray(def.safeConversionTargets)).toBe(true)
    }
  })

  it('AC-1d: SQLite affinities are correct per type', () => {
    expect(registry.get('text')?.affinity).toBe('TEXT')
    expect(registry.get('integer')?.affinity).toBe('INTEGER')
    expect(registry.get('decimal')?.affinity).toBe('REAL')
    expect(registry.get('yesno')?.affinity).toBe('INTEGER')
    expect(registry.get('embedded-file')?.affinity).toBe('BLOB')
    expect(registry.get('choice')?.affinity).toBe('TEXT')
    expect(registry.get('date')?.affinity).toBe('TEXT')
    expect(registry.get('linked-file')?.affinity).toBe('TEXT')
  })

  it('AC-1e: validate() returns null for valid values', () => {
    expect(registry.get('integer')?.validate(42)).toBeNull()
    expect(registry.get('decimal')?.validate(3.14)).toBeNull()
    expect(registry.get('date')?.validate('2026-08-31')).toBeNull()
    expect(registry.get('yesno')?.validate(1)).toBeNull()
    expect(registry.get('text')?.validate('hello')).toBeNull()
  })

  it('AC-1f: validate() returns error string for invalid values', () => {
    expect(registry.get('integer')?.validate('not-a-number')).toBeTruthy()
    expect(registry.get('decimal')?.validate('abc')).toBeTruthy()
    expect(registry.get('date')?.validate('31/08/2026')).toBeTruthy()
    expect(registry.get('yesno')?.validate('maybe')).toBeTruthy()
  })

  it('AC-1g: displayHint() returns readable strings', () => {
    expect(registry.get('yesno')?.displayHint(1)).toBe('Yes')
    expect(registry.get('yesno')?.displayHint(0)).toBe('No')
    expect(registry.get('embedded-file')?.displayHint(null)).toBe('[embedded file]')
    expect(registry.get('text')?.displayHint('hello')).toBe('hello')
    expect(registry.get('integer')?.displayHint(null)).toBe('')
  })

  // AC-2: IFieldTypeRegistry is mockable (NFR-011)
  it('AC-2: IFieldTypeRegistry interface is mockable', () => {
    const mock: IFieldTypeRegistry = {
      get: (id) => id === 'text' ? { typeId: 'text', label: 'Text', affinity: 'TEXT', searchHint: 'fulltext', displayHint: () => '', validate: () => null, safeConversionTargets: [] } : undefined,
      all: () => [],
      has: (id) => id === 'text',
      isConversionSafe: () => false,
    }
    expect(mock.has('text')).toBe(true)
    expect(mock.has('integer')).toBe(false)
    expect(mock.get('text')?.label).toBe('Text')
  })

  it('AC-1h: isConversionSafe() reflects Appendix B rules', () => {
    expect(registry.isConversionSafe('integer', 'decimal')).toBe(true)
    expect(registry.isConversionSafe('decimal', 'integer')).toBe(false)
    expect(registry.isConversionSafe('text', 'multiline')).toBe(true)
    expect(registry.isConversionSafe('multiline', 'text')).toBe(false)
    expect(registry.isConversionSafe('date', 'datetime')).toBe(true)
    expect(registry.isConversionSafe('datetime', 'date')).toBe(false)
    expect(registry.isConversionSafe('yesno', 'integer')).toBe(true)
    expect(registry.isConversionSafe('text', 'text')).toBe(true) // same type
  })
})

// ── AC-3: FieldRepository.create() ───────────────────────────────────────────

describe('FieldRepository.create()', () => {
  it('AC-3a: creates a field with all required properties', async () => {
    const field = await fieldRepo.create({
      collectionId, name: 'Title', fieldType: 'text',
      description: 'Film title', required: true, isPrimary: true,
    })
    expect(field.id).toBeTruthy()
    expect(field.name).toBe('Title')
    expect(field.fieldType).toBe('text')
    expect(field.description).toBe('Film title')
    expect(field.required).toBe(true)
    expect(field.isPrimary).toBe(true)
    expect(field.recycled).toBe(false)
    expect(field.collectionId).toBe(collectionId)
    expect(field.createdAt).toBeTruthy()
  })

  it('AC-3b: display order increments for each new field', async () => {
    const f1 = await fieldRepo.create({ collectionId, name: 'A', fieldType: 'text' })
    const f2 = await fieldRepo.create({ collectionId, name: 'B', fieldType: 'integer' })
    const f3 = await fieldRepo.create({ collectionId, name: 'C', fieldType: 'decimal' })
    expect(f1.displayOrder).toBe(0)
    expect(f2.displayOrder).toBe(1)
    expect(f3.displayOrder).toBe(2)
  })

  // AC-4: rejects duplicate names (FR-FLD-002)
  it('AC-4a: rejects duplicate field name within a collection', async () => {
    await fieldRepo.create({ collectionId, name: 'Title', fieldType: 'text' })
    await expect(
      fieldRepo.create({ collectionId, name: 'Title', fieldType: 'multiline' })
    ).rejects.toThrow(/already exists/)
  })

  it('AC-4b: duplicate name check is case-insensitive', async () => {
    await fieldRepo.create({ collectionId, name: 'title', fieldType: 'text' })
    await expect(
      fieldRepo.create({ collectionId, name: 'TITLE', fieldType: 'text' })
    ).rejects.toThrow(/already exists/)
  })

  // AC-5: rejects unknown field types
  it('AC-5: rejects unknown field type', async () => {
    await expect(
      fieldRepo.create({ collectionId, name: 'Bad', fieldType: 'not-a-type' })
    ).rejects.toThrow(/Unknown field type/)
  })
})

// ── AC-6: FieldRepository.list() ─────────────────────────────────────────────

describe('FieldRepository.list()', () => {
  it('AC-6a: returns active fields in display order', async () => {
    await fieldRepo.create({ collectionId, name: 'A', fieldType: 'text' })
    await fieldRepo.create({ collectionId, name: 'B', fieldType: 'integer' })
    await fieldRepo.create({ collectionId, name: 'C', fieldType: 'decimal' })

    const fields = await fieldRepo.list(collectionId)
    expect(fields).toHaveLength(3)
    expect(fields[0].name).toBe('A')
    expect(fields[1].name).toBe('B')
    expect(fields[2].name).toBe('C')
  })

  it('AC-6b: does not return recycled fields', async () => {
    const f1 = await fieldRepo.create({ collectionId, name: 'Active', fieldType: 'text' })
    const f2 = await fieldRepo.create({ collectionId, name: 'Recycled', fieldType: 'text' })
    await fieldRepo.recycle(f2.id)

    const fields = await fieldRepo.list(collectionId)
    expect(fields).toHaveLength(1)
    expect(fields[0].id).toBe(f1.id)
  })

  it('AC-6c: listRecycled() returns only recycled fields', async () => {
    const f1 = await fieldRepo.create({ collectionId, name: 'Active', fieldType: 'text' })
    const f2 = await fieldRepo.create({ collectionId, name: 'Recycled', fieldType: 'text' })
    await fieldRepo.recycle(f2.id)

    const recycled = await fieldRepo.listRecycled(collectionId)
    expect(recycled).toHaveLength(1)
    expect(recycled[0].id).toBe(f2.id)
  })
})

// ── AC-7: FieldRepository.update() ───────────────────────────────────────────

describe('FieldRepository.update()', () => {
  it('AC-7a: updates field name and description', async () => {
    const field = await fieldRepo.create({ collectionId, name: 'Old', fieldType: 'text' })
    const updated = await fieldRepo.update(field.id, { name: 'New', description: 'Updated' })
    expect(updated.name).toBe('New')
    expect(updated.description).toBe('Updated')
  })

  it('AC-7b: blocks unsafe type change on field with existing record values (FR-FLD-009)', async () => {
    const field = await fieldRepo.create({ collectionId, name: 'Score', fieldType: 'decimal' })

    // Create a record and insert a value for this field
    const now = new Date().toISOString()
    const recId = crypto.randomUUID()
    db.prepare('INSERT INTO records (id, collection_id, sequence, recycled, created_at, updated_at) VALUES (?,?,?,0,?,?)').run(recId, collectionId, 1, now, now)
    db.prepare('INSERT INTO record_values (record_id, field_id, value_real) VALUES (?,?,?)').run(recId, field.id, 8.5)

    await expect(
      fieldRepo.update(field.id, { fieldType: 'integer' })
    ).rejects.toThrow(/unsafe/)
  })

  it('AC-7c: allows safe type change on populated field (integer → decimal)', async () => {
    const field = await fieldRepo.create({ collectionId, name: 'Count', fieldType: 'integer' })
    const now = new Date().toISOString()
    const recId = crypto.randomUUID()
    db.prepare('INSERT INTO records (id, collection_id, sequence, recycled, created_at, updated_at) VALUES (?,?,?,0,?,?)').run(recId, collectionId, 1, now, now)
    db.prepare('INSERT INTO record_values (record_id, field_id, value_int) VALUES (?,?,?)').run(recId, field.id, 5)

    const updated = await fieldRepo.update(field.id, { fieldType: 'decimal' })
    expect(updated.fieldType).toBe('decimal')
  })

  it('AC-7d: rejects duplicate name on update', async () => {
    await fieldRepo.create({ collectionId, name: 'Existing', fieldType: 'text' })
    const f2 = await fieldRepo.create({ collectionId, name: 'Other', fieldType: 'text' })
    await expect(
      fieldRepo.update(f2.id, { name: 'Existing' })
    ).rejects.toThrow(/already exists/)
  })
})

// ── AC-8: FieldRepository.reorder() ──────────────────────────────────────────

describe('FieldRepository.reorder()', () => {
  it('AC-8: reorders fields by providing ordered ID array', async () => {
    const f1 = await fieldRepo.create({ collectionId, name: 'A', fieldType: 'text' })
    const f2 = await fieldRepo.create({ collectionId, name: 'B', fieldType: 'text' })
    const f3 = await fieldRepo.create({ collectionId, name: 'C', fieldType: 'text' })

    await fieldRepo.reorder(collectionId, [f3.id, f1.id, f2.id])

    const fields = await fieldRepo.list(collectionId)
    expect(fields[0].name).toBe('C')
    expect(fields[1].name).toBe('A')
    expect(fields[2].name).toBe('B')
  })
})

// ── AC-9: FieldRepository.recycle() / restore() ──────────────────────────────

describe('FieldRepository.recycle() and restore()', () => {
  it('AC-9a: recycle() marks field as recycled (FR-FLD-007)', async () => {
    const field = await fieldRepo.create({ collectionId, name: 'ToRecycle', fieldType: 'text' })
    await fieldRepo.recycle(field.id)

    const recycled = await fieldRepo.listRecycled(collectionId)
    expect(recycled.some(f => f.id === field.id)).toBe(true)
    expect(recycled.find(f => f.id === field.id)?.recycled).toBe(true)
  })

  it('AC-9b: restore() appends to end of active order (FR-FLD-008)', async () => {
    const f1 = await fieldRepo.create({ collectionId, name: 'A', fieldType: 'text' })
    const f2 = await fieldRepo.create({ collectionId, name: 'B', fieldType: 'text' })
    const f3 = await fieldRepo.create({ collectionId, name: 'C', fieldType: 'text' })
    await fieldRepo.recycle(f2.id)

    // Active order is now: A(0), C(1)
    const restored = await fieldRepo.restore(f2.id)

    const fields = await fieldRepo.list(collectionId)
    expect(fields[fields.length - 1].id).toBe(restored.id)
    expect(restored.recycled).toBe(false)
    expect(restored.recycledAt).toBeNull()
  })
})

// ── AC-11: ChoiceOptionRepository ────────────────────────────────────────────

describe('ChoiceOptionRepository', () => {
  let choiceFieldId: string

  beforeEach(async () => {
    const field = await fieldRepo.create({ collectionId, name: 'Genre', fieldType: 'choice' })
    choiceFieldId = field.id
  })

  it('AC-11a: add() creates a choice option', async () => {
    const opt = await choiceRepo.add(choiceFieldId, 'Drama')
    expect(opt.id).toBeTruthy()
    expect(opt.label).toBe('Drama')
    expect(opt.fieldId).toBe(choiceFieldId)
  })

  it('AC-11b: list() returns options in display order', async () => {
    await choiceRepo.add(choiceFieldId, 'Drama')
    await choiceRepo.add(choiceFieldId, 'Comedy')
    await choiceRepo.add(choiceFieldId, 'Sci-Fi')

    const opts = await choiceRepo.list(choiceFieldId)
    expect(opts).toHaveLength(3)
    expect(opts[0].label).toBe('Drama')
    expect(opts[1].label).toBe('Comedy')
    expect(opts[2].label).toBe('Sci-Fi')
  })

  it('AC-11c: updateLabel() changes the label', async () => {
    const opt = await choiceRepo.add(choiceFieldId, 'Old')
    const updated = await choiceRepo.updateLabel(opt.id, 'New')
    expect(updated.label).toBe('New')
  })

  it('AC-11d: remove() deletes the option', async () => {
    const opt = await choiceRepo.add(choiceFieldId, 'ToRemove')
    await choiceRepo.remove(opt.id)
    const opts = await choiceRepo.list(choiceFieldId)
    expect(opts.some(o => o.id === opt.id)).toBe(false)
  })

  it('AC-11e: reorder() changes display order', async () => {
    const o1 = await choiceRepo.add(choiceFieldId, 'A')
    const o2 = await choiceRepo.add(choiceFieldId, 'B')
    const o3 = await choiceRepo.add(choiceFieldId, 'C')

    await choiceRepo.reorder(choiceFieldId, [o3.id, o1.id, o2.id])

    const opts = await choiceRepo.list(choiceFieldId)
    expect(opts[0].label).toBe('C')
    expect(opts[1].label).toBe('A')
    expect(opts[2].label).toBe('B')
  })
})

// ── AC-12: IFieldRepository mockability (NFR-011) ────────────────────────────

describe('IFieldRepository mockability (NFR-011)', () => {
  it('AC-12: a mock implementation satisfies the IFieldRepository interface', async () => {
    const mockField = {
      id: 'mock-field-id', collectionId: 'col-1', name: 'Title',
      fieldType: 'text', description: '', required: false, isPrimary: true,
      defaultValue: null, displayOrder: 0, recycled: false, recycledAt: null,
      config: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const mock: IFieldRepository = {
      create: async () => mockField,
      list: async () => [mockField],
      listRecycled: async () => [],
      get: async () => mockField,
      update: async () => mockField,
      reorder: async () => {},
      recycle: async () => {},
      restore: async () => mockField,
    }

    const fields = await mock.list('col-1')
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('Title')

    const created = await mock.create({ collectionId: 'col-1', name: 'Title', fieldType: 'text' })
    expect(created.id).toBe('mock-field-id')
  })
})
