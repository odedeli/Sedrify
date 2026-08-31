// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Cabinet Engine Contract
// NFR-011: All layer boundaries must be mockable.
// Feature modules import this interface — never the concrete implementation.
// ─────────────────────────────────────────────────────────────────────────────

export interface CabinetMeta {
  /** Stable UUID for this cabinet, set at creation and never changed. */
  id: string
  /** Human-readable name, derived from filename on creation (FR-CAB-003). */
  name: string
  /** Absolute path to the .cabinet file. */
  path: string
  /** Schema version — used for migration validation. */
  schemaVersion: number
  /** ISO 8601 UTC timestamp of cabinet creation. */
  createdAt: string
  /** ISO 8601 UTC timestamp of last modification. */
  updatedAt: string
}

export interface CreateCabinetOptions {
  /** Absolute path where the .cabinet file will be created. */
  path: string
  /**
   * Human-readable name for the cabinet.
   * If omitted, derived from the filename (FR-CAB-003).
   */
  name?: string
}

export interface OpenCabinetResult {
  meta: CabinetMeta
}

export interface ICabinetEngine {
  /**
   * Create a new .cabinet file.
   * - Fails if a file already exists at path (FR-CAB-006).
   * - Initialises schema v1 with one default collection and one All Records view (FR-CAB-002).
   * - Transactional: no partial file left on failure (NFR-005, NFR-010).
   */
  create(options: CreateCabinetOptions): Promise<CabinetMeta>

  /**
   * Open an existing .cabinet file and validate its schema version (FR-CAB-004).
   * Rejects files with an unrecognised schema version.
   */
  open(path: string): Promise<OpenCabinetResult>

  /**
   * Close the current database connection cleanly.
   * Safe to call even if no cabinet is open.
   */
  close(): Promise<void>

  /**
   * Return the meta of the currently open cabinet, or null if none is open.
   */
  currentCabinet(): CabinetMeta | null
}
