// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Cabinet Engine (concrete implementation)
// Updated in F-2 to apply field_choice_options schema on creation.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'fs'
import { basename, extname } from 'path'
import type { ICabinetEngine, CabinetMeta, CreateCabinetOptions, OpenCabinetResult } from '../contracts/ICabinetEngine'
import { SCHEMA_VERSION, SCHEMA_V1_DDL } from './schema'
import { FIELD_CHOICE_OPTIONS_DDL } from '../fields/choiceOptionsSchema'

function uuid(): string {
  return crypto.randomUUID()
}

function nowUtc(): string {
  return new Date().toISOString()
}

function nameFromPath(filePath: string): string {
  const base = basename(filePath)
  const ext = extname(base)
  return ext ? base.slice(0, -ext.length) : base
}

function applyDDL(db: Database.Database, ddl: string): void {
  const statements = ddl.split(';').map(s => s.trim()).filter(s => s.length > 0)
  const tx = db.transaction(() => {
    for (const stmt of statements) {
      db.prepare(stmt).run()
    }
  })
  tx()
}

export class CabinetEngine implements ICabinetEngine {
  private db: Database.Database | null = null
  private meta: CabinetMeta | null = null

  async create(options: CreateCabinetOptions): Promise<CabinetMeta> {
    const { path } = options

    if (existsSync(path)) {
      throw new Error(`Cabinet already exists at path: ${path}`)
    }

    const name = options.name?.trim() || nameFromPath(path)
    if (!name) throw new Error('Cabinet name could not be derived from path')

    const id = uuid()
    const now = nowUtc()
    let db: Database.Database | null = null

    try {
      db = new Database(path)
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')

      // Apply all schema DDL
      applyDDL(db, SCHEMA_V1_DDL)
      applyDDL(db, FIELD_CHOICE_OPTIONS_DDL)

      const collectionId = uuid()
      const viewId = uuid()

      const seed = db.transaction(() => {
        db!.prepare(`
          INSERT INTO cabinet_meta (id, name, schema_version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, name, SCHEMA_VERSION, now, now)

        db!.prepare(`
          INSERT INTO collections (id, name, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(collectionId, 'Default', 0, now, now)

        db!.prepare(`
          INSERT INTO views (id, collection_id, name, view_type, display_order, config, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(viewId, collectionId, 'All Records', 'table', 0, '{}', now, now)

        db!.prepare(`
          INSERT INTO sequence_counters (collection_id, next_sequence)
          VALUES (?, ?)
        `).run(collectionId, 1)
      })
      seed()

      const meta: CabinetMeta = { id, name, path, schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now }
      this.db = db
      this.meta = meta
      return meta

    } catch (err) {
      if (db) { try { db.close() } catch { /* ignore */ } }
      if (existsSync(path)) { try { unlinkSync(path) } catch { /* ignore */ } }
      throw err
    }
  }

  async open(path: string): Promise<OpenCabinetResult> {
    if (!existsSync(path)) throw new Error(`Cabinet file not found: ${path}`)
    await this.close()

    let db: Database.Database | null = null
    try {
      db = new Database(path, { readonly: false })
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')

      const row = db.prepare(`
        SELECT id, name, schema_version, created_at, updated_at FROM cabinet_meta LIMIT 1
      `).get() as { id: string; name: string; schema_version: number; created_at: string; updated_at: string } | undefined

      if (!row) throw new Error('Invalid cabinet file: cabinet_meta table is empty')
      if (row.schema_version !== SCHEMA_VERSION) {
        throw new Error(`Unsupported schema version: ${row.schema_version}. Expected: ${SCHEMA_VERSION}`)
      }

      const meta: CabinetMeta = {
        id: row.id, name: row.name, path,
        schemaVersion: row.schema_version,
        createdAt: row.created_at, updatedAt: row.updated_at,
      }
      this.db = db
      this.meta = meta
      return { meta }

    } catch (err) {
      if (db) { try { db.close() } catch { /* ignore */ } }
      this.db = null
      this.meta = null
      throw err
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try { this.db.close() } finally { this.db = null; this.meta = null }
    }
  }

  currentCabinet(): CabinetMeta | null {
    return this.meta
  }

  /** Expose the raw DB connection for use by repositories in tests and main process. */
  getDb(): Database.Database {
    if (!this.db) throw new Error('No cabinet is open')
    return this.db
  }
}
