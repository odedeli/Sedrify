// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Recent Cabinets Contract
// FR-CAB-005: Recent cabinets persist between application runs.
// NFR-011: Mockable interface.
// ─────────────────────────────────────────────────────────────────────────────

export interface RecentCabinetEntry {
  /** Absolute path to the .cabinet file. */
  path: string
  /** Cabinet name at time of last open. */
  name: string
  /** ISO 8601 UTC timestamp of last open. */
  lastOpenedAt: string
}

export interface IRecentCabinets {
  /**
   * Record a cabinet as recently opened.
   * If the path already exists in the list, it is moved to the top.
   * List is capped at 10 entries.
   */
  add(entry: RecentCabinetEntry): Promise<void>

  /**
   * Return the list of recent cabinets, most recently opened first.
   */
  list(): Promise<RecentCabinetEntry[]>

  /**
   * Remove a cabinet from the recent list (e.g. file no longer exists).
   */
  remove(path: string): Promise<void>
}
