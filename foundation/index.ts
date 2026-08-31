// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Public API
// Feature modules import from here — never from internal foundation files.
// ─────────────────────────────────────────────────────────────────────────────

// Contracts (interfaces) — import these in feature modules and tests
export type { ICabinetEngine, CabinetMeta, CreateCabinetOptions, OpenCabinetResult } from './contracts/ICabinetEngine'
export type { IRecentCabinets, RecentCabinetEntry } from './contracts/IRecentCabinets'

// Concrete implementations — import these only in the main process / DI root
export { CabinetEngine } from './cabinet/CabinetEngine'
export { RecentCabinetsService } from './cabinet/RecentCabinetsService'

// Schema
export { SCHEMA_VERSION } from './cabinet/schema'

export const FOUNDATION_VERSION = '0.1.0'
