// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Extended Field Type Tests (P-2 sprint)
// Tests the 12 extended types added to FieldTypeRegistry in v1.2.0.
// Run: pnpm test (add this file to foundation/__tests__/)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest'
import { FieldTypeRegistry } from '../fields/FieldTypeRegistry'

let registry: FieldTypeRegistry

beforeAll(() => {
  registry = new FieldTypeRegistry()
})

describe('Extended FieldTypeRegistry — 22 types total', () => {

  // AC-E1: total count is now 22
  it('AC-E1a: registers exactly 22 field types', () => {
    expect(registry.all()).toHaveLength(22)
  })

  it('AC-E1b: all 12 extended types are registered by ID', () => {
    const extendedIds = [
      'url', 'email', 'phone', 'currency', 'rating',
      'percentage', 'time', 'duration', 'tags', 'multichoice',
      'lookup', 'formula',
    ]
    for (const id of extendedIds) {
      expect(registry.has(id), `Expected type "${id}" to be registered`).toBe(true)
    }
  })

  it('AC-E1c: all 10 foundation types still registered', () => {
    const foundationIds = [
      'text', 'multiline', 'integer', 'decimal',
      'date', 'datetime', 'yesno', 'choice',
      'linked-file', 'embedded-file',
    ]
    for (const id of foundationIds) {
      expect(registry.has(id), `Foundation type "${id}" should still be registered`).toBe(true)
    }
  })

  it('AC-E1d: all extended types have required properties', () => {
    const extendedIds = [
      'url', 'email', 'phone', 'currency', 'rating',
      'percentage', 'time', 'duration', 'tags', 'multichoice',
      'lookup', 'formula',
    ]
    for (const id of extendedIds) {
      const def = registry.get(id)
      expect(def, `Type "${id}" should exist`).toBeDefined()
      expect(def!.typeId).toBe(id)
      expect(def!.label).toBeTruthy()
      expect(['TEXT', 'INTEGER', 'REAL', 'BLOB']).toContain(def!.affinity)
      expect(['fulltext', 'exact', 'filename', 'none']).toContain(def!.searchHint)
      expect(typeof def!.validate).toBe('function')
      expect(typeof def!.displayHint).toBe('function')
      expect(Array.isArray(def!.safeConversionTargets)).toBe(true)
    }
  })

  // AC-E2: SQLite affinities for extended types
  it('AC-E2: SQLite affinities are correct for extended types', () => {
    expect(registry.get('url')?.affinity).toBe('TEXT')
    expect(registry.get('email')?.affinity).toBe('TEXT')
    expect(registry.get('phone')?.affinity).toBe('TEXT')
    expect(registry.get('currency')?.affinity).toBe('REAL')
    expect(registry.get('rating')?.affinity).toBe('REAL')
    expect(registry.get('percentage')?.affinity).toBe('REAL')
    expect(registry.get('time')?.affinity).toBe('TEXT')
    expect(registry.get('duration')?.affinity).toBe('INTEGER')
    expect(registry.get('tags')?.affinity).toBe('TEXT')
    expect(registry.get('multichoice')?.affinity).toBe('TEXT')
    expect(registry.get('lookup')?.affinity).toBe('TEXT')
    expect(registry.get('formula')?.affinity).toBe('TEXT')
  })

  // AC-E3: validate() — valid values
  it('AC-E3a: validate() returns null for valid URL values', () => {
    expect(registry.get('url')?.validate('https://example.com')).toBeNull()
    expect(registry.get('url')?.validate('http://localhost:3000')).toBeNull()
    expect(registry.get('url')?.validate(null)).toBeNull()
    expect(registry.get('url')?.validate('')).toBeNull()
  })

  it('AC-E3b: validate() returns null for valid email values', () => {
    expect(registry.get('email')?.validate('user@example.com')).toBeNull()
    expect(registry.get('email')?.validate('a+b@c.org')).toBeNull()
    expect(registry.get('email')?.validate(null)).toBeNull()
  })

  it('AC-E3c: validate() returns null for valid phone values', () => {
    expect(registry.get('phone')?.validate('0521234567')).toBeNull()
    expect(registry.get('phone')?.validate('+972 52-123-4567')).toBeNull()
    expect(registry.get('phone')?.validate(null)).toBeNull()
  })

  it('AC-E3d: validate() returns null for valid rating values', () => {
    expect(registry.get('rating')?.validate(0)).toBeNull()
    expect(registry.get('rating')?.validate(7.5)).toBeNull()
    expect(registry.get('rating')?.validate(10)).toBeNull()
    expect(registry.get('rating')?.validate(null)).toBeNull()
  })

  it('AC-E3e: validate() returns null for valid percentage values', () => {
    expect(registry.get('percentage')?.validate(0)).toBeNull()
    expect(registry.get('percentage')?.validate(50.5)).toBeNull()
    expect(registry.get('percentage')?.validate(100)).toBeNull()
    expect(registry.get('percentage')?.validate(null)).toBeNull()
  })

  it('AC-E3f: validate() returns null for valid time values', () => {
    expect(registry.get('time')?.validate('09:30')).toBeNull()
    expect(registry.get('time')?.validate('23:59:59')).toBeNull()
    expect(registry.get('time')?.validate(null)).toBeNull()
  })

  it('AC-E3g: validate() returns null for valid duration values', () => {
    expect(registry.get('duration')?.validate(0)).toBeNull()
    expect(registry.get('duration')?.validate(3600)).toBeNull()
    expect(registry.get('duration')?.validate(null)).toBeNull()
  })

  it('AC-E3h: validate() returns null for valid tags JSON array', () => {
    expect(registry.get('tags')?.validate('["sci-fi","drama"]')).toBeNull()
    expect(registry.get('tags')?.validate('[]')).toBeNull()
    expect(registry.get('tags')?.validate(null)).toBeNull()
  })

  it('AC-E3i: validate() returns null for valid multichoice JSON array', () => {
    expect(registry.get('multichoice')?.validate('["a","b"]')).toBeNull()
    expect(registry.get('multichoice')?.validate(null)).toBeNull()
  })

  // AC-E4: validate() — invalid values
  it('AC-E4a: validate() returns error for invalid URL', () => {
    expect(registry.get('url')?.validate('not-a-url')).toBeTruthy()
    expect(registry.get('url')?.validate('ftp://')).toBeTruthy()
  })

  it('AC-E4b: validate() returns error for invalid email', () => {
    expect(registry.get('email')?.validate('not-an-email')).toBeTruthy()
    expect(registry.get('email')?.validate('@example.com')).toBeTruthy()
  })

  it('AC-E4c: validate() returns error for invalid rating', () => {
    expect(registry.get('rating')?.validate(11)).toBeTruthy()
    expect(registry.get('rating')?.validate(-1)).toBeTruthy()
  })

  it('AC-E4d: validate() returns error for invalid percentage', () => {
    expect(registry.get('percentage')?.validate(101)).toBeTruthy()
    expect(registry.get('percentage')?.validate(-0.1)).toBeTruthy()
  })

  it('AC-E4e: validate() returns error for invalid time', () => {
    expect(registry.get('time')?.validate('25:00')).toBeTruthy()
    expect(registry.get('time')?.validate('9:30')).toBeTruthy() // missing leading zero
    expect(registry.get('time')?.validate('not-time')).toBeTruthy()
  })

  it('AC-E4f: validate() returns error for invalid tags (not JSON array)', () => {
    expect(registry.get('tags')?.validate('"just-a-string"')).toBeTruthy()
    expect(registry.get('tags')?.validate('{}')).toBeTruthy()
    expect(registry.get('tags')?.validate('not-json')).toBeTruthy()
  })

  // AC-E5: displayHint() for extended types
  it('AC-E5a: displayHint() formats rating correctly', () => {
    expect(registry.get('rating')?.displayHint(8.5)).toBe('8.5/10')
    expect(registry.get('rating')?.displayHint(null)).toBe('')
  })

  it('AC-E5b: displayHint() formats percentage correctly', () => {
    expect(registry.get('percentage')?.displayHint(75)).toBe('75%')
    expect(registry.get('percentage')?.displayHint(null)).toBe('')
  })

  it('AC-E5c: displayHint() formats duration as human-readable', () => {
    expect(registry.get('duration')?.displayHint(3661)).toBe('1h 1m')
    expect(registry.get('duration')?.displayHint(90)).toBe('1m 30s')
    expect(registry.get('duration')?.displayHint(45)).toBe('45s')
    expect(registry.get('duration')?.displayHint(null)).toBe('')
  })

  it('AC-E5d: displayHint() formats tags as comma-separated', () => {
    expect(registry.get('tags')?.displayHint('["sci-fi","drama"]')).toBe('sci-fi, drama')
    expect(registry.get('tags')?.displayHint(null)).toBe('')
  })

  it('AC-E5e: formula displayHint returns [formula] for null', () => {
    expect(registry.get('formula')?.displayHint(null)).toBe('[formula]')
  })

  // AC-E6: safe conversion targets for extended types
  it('AC-E6: isConversionSafe() works for extended types', () => {
    // URL → text/multiline/linked-file
    expect(registry.isConversionSafe('url', 'text')).toBe(true)
    expect(registry.isConversionSafe('url', 'linked-file')).toBe(true)
    expect(registry.isConversionSafe('url', 'integer')).toBe(false)

    // currency → decimal
    expect(registry.isConversionSafe('currency', 'decimal')).toBe(true)
    expect(registry.isConversionSafe('currency', 'integer')).toBe(false)

    // rating → decimal/integer
    expect(registry.isConversionSafe('rating', 'decimal')).toBe(true)
    expect(registry.isConversionSafe('rating', 'integer')).toBe(true)

    // tags → multichoice
    expect(registry.isConversionSafe('tags', 'multichoice')).toBe(true)
    expect(registry.isConversionSafe('multichoice', 'tags')).toBe(true)

    // choice → multichoice
    expect(registry.isConversionSafe('choice', 'multichoice')).toBe(true)

    // formula is not safely convertible to anything
    expect(registry.isConversionSafe('formula', 'text')).toBe(true)
    expect(registry.isConversionSafe('formula', 'integer')).toBe(false)

    // Same-type always safe
    expect(registry.isConversionSafe('url', 'url')).toBe(true)
    expect(registry.isConversionSafe('rating', 'rating')).toBe(true)
  })
})
