// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Public API
// Feature modules import from here — never from internal foundation files.
// ─────────────────────────────────────────────────────────────────────────────

// ── Contracts (interfaces) ────────────────────────────────────────────────────
export type { ICabinetEngine, CabinetMeta, CreateCabinetOptions, OpenCabinetResult } from './contracts/ICabinetEngine'
export type { IRecentCabinets, RecentCabinetEntry } from './contracts/IRecentCabinets'
export type { IFieldTypeRegistry, FieldTypeDefinition, SqliteAffinity, SearchHint } from './contracts/IFieldTypeRegistry'
export type {
  IFieldRepository, IChoiceOptionRepository,
  FieldEntity, ChoiceOptionEntity,
  CreateFieldOptions, UpdateFieldOptions,
} from './contracts/IFieldRepository'

// ── Concrete implementations ──────────────────────────────────────────────────
export { CabinetEngine } from './cabinet/CabinetEngine'
export { RecentCabinetsService } from './cabinet/RecentCabinetsService'
export { FieldTypeRegistry } from './fields/FieldTypeRegistry'
export { FieldRepository, ChoiceOptionRepository } from './fields/FieldRepository'

// ── Schema ────────────────────────────────────────────────────────────────────
export { SCHEMA_VERSION } from './cabinet/schema'
export { FIELD_CHOICE_OPTIONS_DDL } from './fields/choiceOptionsSchema'

export const FOUNDATION_VERSION = '0.2.0'
