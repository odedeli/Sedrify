// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Cabinet Engine (concrete implementation)
// Implements ICabinetEngine using better-sqlite3.
// Feature modules must not import this class directly — use ICabinetEngine.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'fs'
import { basename, extname } from 'path'
import type { ICabinetEngine, CabinetMeta, CreateCabinetOptions, OpenCabinetResult } from '../contracts/ICabinetEngine'
import { SCHEMA_VERSION, SCHEMA_V1_DDL } from './schema'

// ── Utilities ─────────────────────────────────────────────────────────────────

function uuid(): string {
  // RFC 4122 v4 UUID — crypto.randomUUID() is available in Node 16+
  return crypto.randomUUID()
}

function nowUtc(): string {
  return new Date().toISOString()
}

/**
 * Derive a cabinet name from a file path.
 * e.g. "/home/user/films.cabinet" → "films"
 */
function nameFromPath(filePath: string): string {
  const base = basename(filePath)
  const ext = extname(base)
  return ext ? base.slice(0, -ext.length) : base
}

/**
 * Execute the schema DDL statements as a single transaction.
 * Splits on semicolons and runs each non-empty statement.
 */
function applySchema(db: Database.Database, ddl: string): void {
  const statements = ddl
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const tx = db.transaction(() => {
    for (const stmt of statements) {
      db.prepare(stmt).run()
    }
  })
  tx()
}

// ── CabinetEngine ─────────────────────────────────────────────────────────────

export class CabinetEngine implements ICabinetEngine {
  private db: Database.Database | null = null
  private meta: CabinetMeta | null = null

  // ── create ──────────────────────────────────────────────────────────────────

  async create(options: CreateCabinetOptions): Promise<CabinetMeta> {
    const { path } = options

    // FR-CAB-006: reject if file already exists
    if (existsSync(path)) {
      throw new Error(`Cabinet already exists at path: ${path}`)
    }

    // FR-CAB-003: derive name from filename if not provided
    const name = options.name?.trim() || nameFromPath(path)
    if (!name) {
      throw new Error('Cabinet name could not be derived from path')
    }

    const id = uuid()
    const now = nowUtc()

    let db: Database.Database | null = null

    try {
      db = new Database(path)

      // Enable WAL mode for better concurrency safety
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')

      // Apply schema DDL as a transaction (NFR-005)
      applySchema(db, SCHEMA_V1_DDL)

      // Seed cabinet_meta, default collection, default view, sequence counter
      // All within a single transaction (NFR-005)
      const collectionId = uuid()
      const viewId = uuid()

      const seed = db.transaction(() => {
        db!.prepare(`
          INSERT INTO cabinet_meta (id, name, schema_version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, name, SCHEMA_VERSION, now, now)

        // FR-CAB-002: one default collection
        db!.prepare(`
          INSERT INTO collections (id, name, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(collectionId, 'Default', 0, now, now)

        // FR-CAB-002: one default All Records view
        db!.prepare(`
          INSERT INTO views (id, collection_id, name, view_type, display_order, config, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(viewId, collectionId, 'All Records', 'table', 0, '{}', now, now)

        // Sequence counter for the default collection
        db!.prepare(`
          INSERT INTO sequence_counters (collection_id, next_sequence)
          VALUES (?, ?)
        `).run(collectionId, 1)
      })

      seed()

      const meta: CabinetMeta = {
        id,
        name,
        path,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      }

      this.db = db
      this.meta = meta

      return meta

    } catch (err) {
      // NFR-010: close and remove partial file on failure
      if (db) {
        try { db.close() } catch { /* ignore */ }
      }
      if (existsSync(path)) {
        try { unlinkSync(path) } catch { /* ignore */ }
      }
      throw err
    }
  }

  // ── open ────────────────────────────────────────────────────────────────────

  async open(path: string): Promise<OpenCabinetResult> {
    if (!existsSync(path)) {
      throw new Error(`Cabinet file not found: ${path}`)
    }

    // Close any currently open cabinet first
    await this.close()

    let db: Database.Database | null = null

    try {
      db = new Database(path, { readonly: false })
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')

      // FR-CAB-004: validate schema version
      const row = db.prepare(`
        SELECT id, name, schema_version, created_at, updated_at
        FROM cabinet_meta
        LIMIT 1
      `).get() as { id: string; name: string; schema_version: number; created_at: string; updated_at: string } | undefined

      if (!row) {
        throw new Error('Invalid cabinet file: cabinet_meta table is empty')
      }

      if (row.schema_version !== SCHEMA_VERSION) {
        throw new Error(
          `Unsupported schema version: ${row.schema_version}. Expected: ${SCHEMA_VERSION}`
        )
      }

      const meta: CabinetMeta = {
        id: row.id,
        name: row.name,
        path,
        schemaVersion: row.schema_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }

      this.db = db
      this.meta = meta

      return { meta }

    } catch (err) {
      if (db) {
        try { db.close() } catch { /* ignore */ }
      }
      this.db = null
      this.meta = null
      throw err
    }
  }

  // ── close ───────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close()
      } finally {
        this.db = null
        this.meta = null
      }
    }
  }

  // ── currentCabinet ──────────────────────────────────────────────────────────

  currentCabinet(): CabinetMeta | null {
    return this.meta
  }
}
