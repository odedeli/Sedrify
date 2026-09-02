// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Field Type Registry (v1.2.1 — fixes multiline conversion + time validation)
// ─────────────────────────────────────────────────────────────────────────────

import type { IFieldTypeRegistry, FieldTypeDefinition } from '../contracts/IFieldTypeRegistry'

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

function validateUrl(v: unknown): string | null {
  if (isBlank(v)) return null
  try { new URL(String(v)); return null }
  catch { return 'Value must be a valid URL (e.g. https://example.com)' }
}

function validateEmail(v: unknown): string | null {
  if (isBlank(v)) return null
  const s = String(v)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Value must be a valid email address'
  return null
}

function validatePhone(v: unknown): string | null {
  if (isBlank(v)) return null
  const s = String(v).replace(/[\s\-().+]/g, '')
  if (!/^\d{6,15}$/.test(s)) return 'Value must be a valid phone number'
  return null
}

function validateRating(v: unknown): string | null {
  if (isBlank(v)) return null
  const n = Number(v)
  if (isNaN(n) || n < 0 || n > 10) return 'Value must be a number between 0 and 10'
  return null
}

function validatePercentage(v: unknown): string | null {
  if (isBlank(v)) return null
  const n = Number(v)
  if (isNaN(n) || n < 0 || n > 100) return 'Value must be a number between 0 and 100'
  return null
}

function validateTime(v: unknown): string | null {
  if (isBlank(v)) return null
  const s = String(v)
  // Must be HH:MM or HH:MM:SS with valid hour (00-23) and minute/second (00-59)
  const m = s.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return 'Value must be in HH:MM or HH:MM:SS format'
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const sec = m[3] !== undefined ? parseInt(m[3], 10) : 0
  if (h > 23) return 'Hour must be between 00 and 23'
  if (min > 59) return 'Minute must be between 00 and 59'
  if (sec > 59) return 'Second must be between 00 and 59'
  return null
}

function validateDuration(v: unknown): string | null {
  if (isBlank(v)) return null
  const n = Number(v)
  if (isNaN(n) || n < 0) return 'Value must be a non-negative number (seconds)'
  return null
}

function validateJsonArray(v: unknown): string | null {
  if (isBlank(v)) return null
  const s = String(v)
  try {
    const parsed = JSON.parse(s)
    if (!Array.isArray(parsed)) return 'Value must be a JSON array'
    return null
  } catch {
    return 'Value must be a valid JSON array'
  }
}

const ALL_TYPES: FieldTypeDefinition[] = [

  // ── Foundation types (10) ────────────────────────────────────────────────

  {
    typeId: 'text',
    label: 'Single-line text',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: ['multiline', 'url', 'email', 'phone'],
  },
  {
    typeId: 'multiline',
    label: 'Multi-line text',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: [],  // multiline → text was false per AC-1h
  },
  {
    typeId: 'integer',
    label: 'Integer',
    affinity: 'INTEGER',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateInteger,
    safeConversionTargets: ['decimal', 'text', 'multiline', 'currency', 'rating', 'percentage'],
  },
  {
    typeId: 'decimal',
    label: 'Decimal',
    affinity: 'REAL',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateDecimal,
    safeConversionTargets: ['text', 'multiline', 'currency'],
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
    safeConversionTargets: ['text', 'multichoice'],
  },
  {
    typeId: 'linked-file',
    label: 'Linked file',
    affinity: 'TEXT',
    searchHint: 'filename',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: ['text', 'url'],
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

  // ── Extended types (12) ───────────────────────────────────────────────────

  {
    typeId: 'url',
    label: 'URL',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateUrl,
    safeConversionTargets: ['text', 'multiline', 'linked-file'],
  },
  {
    typeId: 'email',
    label: 'Email address',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateEmail,
    safeConversionTargets: ['text', 'multiline'],
  },
  {
    typeId: 'phone',
    label: 'Phone number',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validatePhone,
    safeConversionTargets: ['text', 'multiline'],
  },
  {
    typeId: 'currency',
    label: 'Currency',
    affinity: 'REAL',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateDecimal,
    safeConversionTargets: ['decimal', 'text', 'multiline'],
  },
  {
    typeId: 'rating',
    label: 'Rating (0–10)',
    affinity: 'REAL',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : `${v}/10`,
    validate: validateRating,
    safeConversionTargets: ['decimal', 'integer', 'text'],
  },
  {
    typeId: 'percentage',
    label: 'Percentage (0–100)',
    affinity: 'REAL',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : `${v}%`,
    validate: validatePercentage,
    safeConversionTargets: ['decimal', 'text'],
  },
  {
    typeId: 'time',
    label: 'Time (HH:MM)',
    affinity: 'TEXT',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: validateTime,
    safeConversionTargets: ['text'],
  },
  {
    typeId: 'duration',
    label: 'Duration (seconds)',
    affinity: 'INTEGER',
    searchHint: 'exact',
    displayHint: (v) => {
      if (v === null) return ''
      const secs = Number(v)
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      if (h > 0) return `${h}h ${m}m`
      if (m > 0) return `${m}m ${s}s`
      return `${s}s`
    },
    validate: validateDuration,
    safeConversionTargets: ['integer', 'text'],
  },
  {
    typeId: 'tags',
    label: 'Tags (JSON array)',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => {
      if (v === null) return ''
      try {
        const arr = JSON.parse(String(v))
        if (Array.isArray(arr)) return arr.join(', ')
      } catch { /* fall through */ }
      return String(v)
    },
    validate: validateJsonArray,
    safeConversionTargets: ['text', 'multiline', 'multichoice'],
  },
  {
    typeId: 'multichoice',
    label: 'Multiple choice (JSON array)',
    affinity: 'TEXT',
    searchHint: 'fulltext',
    displayHint: (v) => {
      if (v === null) return ''
      try {
        const arr = JSON.parse(String(v))
        if (Array.isArray(arr)) return arr.join(', ')
      } catch { /* fall through */ }
      return String(v)
    },
    validate: validateJsonArray,
    safeConversionTargets: ['text', 'tags'],
  },
  {
    typeId: 'lookup',
    label: 'Lookup (record reference)',
    affinity: 'TEXT',
    searchHint: 'exact',
    displayHint: (v) => v === null ? '' : String(v),
    validate: () => null,
    safeConversionTargets: ['text'],
  },
  {
    typeId: 'formula',
    label: 'Formula (computed)',
    affinity: 'TEXT',
    searchHint: 'none',
    displayHint: (v) => v === null ? '[formula]' : String(v),
    validate: () => null,
    safeConversionTargets: ['text'],
  },
]

export class FieldTypeRegistry implements IFieldTypeRegistry {
  private readonly registry: Map<string, FieldTypeDefinition>

  constructor() {
    this.registry = new Map(ALL_TYPES.map(t => [t.typeId, t]))
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
