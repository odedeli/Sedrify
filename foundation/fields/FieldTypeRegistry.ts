// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Field Type Registry (concrete implementation)
// Registers the 10 Foundation field types mapped to SQLite native affinities.
// Feature modules must not import this class directly — use IFieldTypeRegistry.
// ─────────────────────────────────────────────────────────────────────────────

import type { IFieldTypeRegistry, FieldTypeDefinition } from '../contracts/IFieldTypeRegistry'

// ── Helper validators ─────────────────────────────────────────────────────────

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

function validateInteger(v: unknown): string | null {
  if (isBlank(v)) return null
  const n = Number(v)
  if (!Number.isInteger(n)) return 'Value must be a whole number'
  return null
}

function validateDecimal(v: unknown): string | null {
  if (isBlank(v)) return null
  const n = Number(v)
  if (isNaN(n)) return 'Value must be a number'
  return null
}

function validateDate(v: unknown): string | null {
  if (isBlank(v)) return null
  const s = String(v)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Value must be in ISO 8601 format (YYYY-MM-DD)'
  const d = new Date(s)
  if (isNaN(d.getTime())) return 'Value is not a valid date'
  return null
}

function validateDateTime(v: unknown): string | null {
  if (isBlank(v)) return null
  const s = String(v)
  const d = new Date(s)
  if (isNaN(d.getTime())) return 'Value must be a valid ISO 8601 date-time string'
  return null
}

function validateYesNo(v: unknown): string | null {
  if (isBlank(v)) return null
  if (v === 0 || v === 1 || v === '0' || v === '1' || v === true || v === false) return null
  return 'Value must be 0 or 1'
}

// ── Foundation field type definitions ─────────────────────────────────────────

const FOUNDATION_TYPES: FieldTypeDefinition[] = [
  {
    typeId: 'text',
    label: 'Single-line text',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: ['multiline'],
  },
  {
    typeId: 'multiline',
    label: 'Multi-line text',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: [],
  },
  {
    typeId: 'integer',
    label: 'Integer',
    affinity: 'INTEGER',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateInteger,
    safeConversionTargets: ['decimal', 'text', 'multiline'],
  },
  {
    typeId: 'decimal',
    label: 'Decimal',
    affinity: 'REAL',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateDecimal,
    safeConversionTargets: ['text', 'multiline'],
  },
  {
    typeId: 'date',
    label: 'Date',
    affinity: 'TEXT',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateDate,
    safeConversionTargets: ['datetime', 'text', 'multiline'],
  },
  {
    typeId: 'datetime',
    label: 'Date/Time',
    affinity: 'TEXT',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateDateTime,
    safeConversionTargets: ['text', 'multiline'],
  },
  {
    typeId: 'yesno',
    label: 'Yes/No',
    affinity: 'INTEGER',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : (v === 1 || v === '1' ? 'Yes' : 'No'),
    validate: validateYesNo,
    safeConversionTargets: ['integer'],
  },
  {
    typeId: 'choice',
    label: 'Single choice',
    affinity: 'TEXT',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: [],
  },
  {
    typeId: 'linked-file',
    label: 'Linked file',
    affinity: 'TEXT',
    searchHint: 'filename',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: ['text'],
  },
  {
    typeId: 'embedded-file',
    label: 'Embedded file',
    affinity: 'BLOB',
    searchHint: 'none',
    displayHint: () => '[embedded file]',
    validate: () => null,
    safeConversionTargets: [],
  },
]

// ── FieldTypeRegistry ─────────────────────────────────────────────────────────

export class FieldTypeRegistry implements IFieldTypeRegistry {
  private readonly registry: Map<string, FieldTypeDefinition>

  constructor() {
    this.registry = new Map(FOUNDATION_TYPES.map(t => [t.typeId, t]))
  }

  get(typeId: string): FieldTypeDefinition | undefined {
    return this.registry.get(typeId)
  }

  all(): FieldTypeDefinition[] {
    return Array.from(this.registry.values())
  }

  has(typeId: string): boolean {
    return this.registry.has(typeId)
  }

  isConversionSafe(fromTypeId: string, toTypeId: string): boolean {
    if (fromTypeId === toTypeId) return true
    const from = this.registry.get(fromTypeId)
    if (!from) return false
    return from.safeConversionTargets.includes(toTypeId)
  }
}
