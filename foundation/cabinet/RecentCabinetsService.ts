// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Recent Cabinets Service
// FR-CAB-005: Persists recent cabinet paths between application runs.
// Stores a JSON file at a configurable path (default: ~/.sedrify/recent.json).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { IRecentCabinets, RecentCabinetEntry } from '../contracts/IRecentCabinets'

const MAX_ENTRIES = 10

export class RecentCabinetsService implements IRecentCabinets {
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  // ── add ─────────────────────────────────────────────────────────────────────

  async add(entry: RecentCabinetEntry): Promise<void> {
    const entries = await this.list()

    // Remove existing entry for this path if present (move to top)
    const filtered = entries.filter(e => e.path !== entry.path)

    // Prepend new entry and cap at MAX_ENTRIES
    const updated = [entry, ...filtered].slice(0, MAX_ENTRIES)

    this.write(updated)
  }

  // ── list ────────────────────────────────────────────────────────────────────

  async list(): Promise<RecentCabinetEntry[]> {
    if (!existsSync(this.filePath)) {
      return []
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)

      if (!Array.isArray(parsed)) return []

      // Validate shape of each entry
      return parsed.filter(
        (e): e is RecentCabinetEntry =>
          typeof e === 'object' &&
          typeof e.path === 'string' &&
          typeof e.name === 'string' &&
          typeof e.lastOpenedAt === 'string'
      )
    } catch {
      // Corrupt file — return empty rather than crashing
      return []
    }
  }

  // ── remove ──────────────────────────────────────────────────────────────────

  async remove(path: string): Promise<void> {
    const entries = await this.list()
    const updated = entries.filter(e => e.path !== path)
    this.write(updated)
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private write(entries: RecentCabinetEntry[]): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(this.filePath, JSON.stringify(entries, null, 2), 'utf-8')
  }
}
