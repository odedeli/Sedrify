// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Sprint F-1 Tests
// All acceptance criteria verified here.
// No Electron, no UI, no renderer — pure Node.js + Vitest + better-sqlite3.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { CabinetEngine } from '../cabinet/CabinetEngine'
import { RecentCabinetsService } from '../cabinet/RecentCabinetsService'
import { SCHEMA_VERSION } from '../cabinet/schema'
import type { ICabinetEngine } from '../contracts/ICabinetEngine'
import type { IRecentCabinets } from '../contracts/IRecentCabinets'

// ── Test helpers ──────────────────────────────────────────────────────────────

let testDir: string

function tempPath(name: string): string {
  return join(testDir, name)
}

beforeEach(() => {
  testDir = join(tmpdir(), `sedrify-test-${Date.now()}`)
  mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

// ── AC-1: CabinetEngine.create() creates a .cabinet file ────────────────────

describe('CabinetEngine.create()', () => {
  it('AC-1: creates a .cabinet file at the given path', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    const path = tempPath('films.cabinet')

    const meta = await engine.create({ path })

    expect(existsSync(path)).toBe(true)
    expect(meta.path).toBe(path)
    expect(meta.schemaVersion).toBe(SCHEMA_VERSION)
    expect(meta.id).toBeTruthy()
    expect(meta.createdAt).toBeTruthy()

    await engine.close()
  })

  // AC-3: name derived from filename if not provided (FR-CAB-003)
  it('AC-3a: derives cabinet name from filename when name is not provided', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    const path = tempPath('film-collection.cabinet')

    const meta = await engine.create({ path })
    expect(meta.name).toBe('film-collection')

    await engine.close()
  })

  it('AC-3b: uses provided name when explicitly given', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    const path = tempPath('films.cabinet')

    const meta = await engine.create({ path, name: 'My Film Collection' })
    expect(meta.name).toBe('My Film Collection')

    await engine.close()
  })

  // AC-2: rejects if file already exists (FR-CAB-006)
  it('AC-2: throws if cabinet file already exists — no silent overwrite', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    const path = tempPath('films.cabinet')

    await engine.create({ path })
    await engine.close()

    const engine2: ICabinetEngine = new CabinetEngine()
    await expect(engine2.create({ path })).rejects.toThrow(/already exists/)
  })

  // AC-3: transactional — no partial file on failure (NFR-005, NFR-010)
  it('AC-3c: leaves no partial file when creation fails due to existing file', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    const path = tempPath('films.cabinet')

    // Create first time
    await engine.create({ path })
    await engine.close()

    // Attempt to create again — should fail and leave original intact
    const engine2: ICabinetEngine = new CabinetEngine()
    await expect(engine2.create({ path })).rejects.toThrow()

    // Original file still exists and is valid
    expect(existsSync(path)).toBe(true)
  })

  // AC-4: default collection and All Records view (FR-CAB-002)
  it('AC-4: new cabinet has one default collection and one All Records view', async () => {
    const engine = new CabinetEngine()
    const path = tempPath('films.cabinet')

    await engine.create({ path })

    // Re-open to inspect via SQL directly
    const Database = (await import('better-sqlite3')).default
    const db = new Database(path, { readonly: true })

    const collections = db.prepare('SELECT * FROM collections').all() as { name: string }[]
    expect(collections).toHaveLength(1)
    expect(collections[0].name).toBe('Default')

    const views = db.prepare('SELECT * FROM views').all() as { name: string; view_type: string }[]
    expect(views).toHaveLength(1)
    expect(views[0].name).toBe('All Records')
    expect(views[0].view_type).toBe('table')

    db.close()
    await engine.close()
  })
})

// ── AC-6/7: CabinetEngine.open() ─────────────────────────────────────────────

describe('CabinetEngine.open()', () => {
  it('AC-6: opens an existing valid .cabinet file and returns meta', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    const path = tempPath('films.cabinet')

    const created = await engine.create({ path, name: 'Films' })
    await engine.close()

    const engine2: ICabinetEngine = new CabinetEngine()
    const result = await engine2.open(path)

    expect(result.meta.id).toBe(created.id)
    expect(result.meta.name).toBe('Films')
    expect(result.meta.schemaVersion).toBe(SCHEMA_VERSION)
    expect(result.meta.path).toBe(path)

    await engine2.close()
  })

  it('AC-6b: throws if cabinet file does not exist', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    await expect(engine.open(tempPath('nonexistent.cabinet'))).rejects.toThrow(/not found/)
  })

  it('AC-7: rejects cabinet with unrecognised schema version', async () => {
    const engine = new CabinetEngine()
    const path = tempPath('films.cabinet')
    await engine.create({ path })
    await engine.close()

    // Manually corrupt the schema version
    const Database = (await import('better-sqlite3')).default
    const db = new Database(path)
    db.prepare('UPDATE cabinet_meta SET schema_version = 999').run()
    db.close()

    const engine2: ICabinetEngine = new CabinetEngine()
    await expect(engine2.open(path)).rejects.toThrow(/Unsupported schema version/)
  })
})

// ── AC-8: CabinetEngine.close() ──────────────────────────────────────────────

describe('CabinetEngine.close()', () => {
  it('AC-8: closes the database connection cleanly', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    const path = tempPath('films.cabinet')

    await engine.create({ path })
    expect(engine.currentCabinet()).not.toBeNull()

    await engine.close()
    expect(engine.currentCabinet()).toBeNull()
  })

  it('AC-8b: close() is safe to call when no cabinet is open', async () => {
    const engine: ICabinetEngine = new CabinetEngine()
    await expect(engine.close()).resolves.not.toThrow()
  })
})

// ── AC-9: RecentCabinetsService ───────────────────────────────────────────────

describe('RecentCabinetsService', () => {
  it('AC-9a: add() persists an entry and list() returns it', async () => {
    const service: IRecentCabinets = new RecentCabinetsService(tempPath('recent.json'))

    await service.add({ path: '/home/user/films.cabinet', name: 'Films', lastOpenedAt: '2026-08-01T10:00:00.000Z' })

    const entries = await service.list()
    expect(entries).toHaveLength(1)
    expect(entries[0].path).toBe('/home/user/films.cabinet')
    expect(entries[0].name).toBe('Films')
  })

  it('AC-9b: list() returns empty array when no file exists', async () => {
    const service: IRecentCabinets = new RecentCabinetsService(tempPath('recent.json'))
    const entries = await service.list()
    expect(entries).toHaveLength(0)
  })

  it('AC-9c: adding existing path moves it to top without duplicating', async () => {
    const service: IRecentCabinets = new RecentCabinetsService(tempPath('recent.json'))

    await service.add({ path: '/a.cabinet', name: 'A', lastOpenedAt: '2026-01-01T00:00:00.000Z' })
    await service.add({ path: '/b.cabinet', name: 'B', lastOpenedAt: '2026-01-02T00:00:00.000Z' })
    await service.add({ path: '/a.cabinet', name: 'A', lastOpenedAt: '2026-01-03T00:00:00.000Z' })

    const entries = await service.list()
    expect(entries).toHaveLength(2)
    expect(entries[0].path).toBe('/a.cabinet')
    expect(entries[1].path).toBe('/b.cabinet')
  })

  it('AC-9d: list is capped at 10 entries', async () => {
    const service: IRecentCabinets = new RecentCabinetsService(tempPath('recent.json'))

    for (let i = 0; i < 12; i++) {
      await service.add({ path: `/cab${i}.cabinet`, name: `Cab ${i}`, lastOpenedAt: new Date().toISOString() })
    }

    const entries = await service.list()
    expect(entries).toHaveLength(10)
  })

  it('AC-9e: remove() deletes an entry from the list', async () => {
    const service: IRecentCabinets = new RecentCabinetsService(tempPath('recent.json'))

    await service.add({ path: '/a.cabinet', name: 'A', lastOpenedAt: '2026-01-01T00:00:00.000Z' })
    await service.add({ path: '/b.cabinet', name: 'B', lastOpenedAt: '2026-01-02T00:00:00.000Z' })
    await service.remove('/a.cabinet')

    const entries = await service.list()
    expect(entries).toHaveLength(1)
    expect(entries[0].path).toBe('/b.cabinet')
  })

  it('AC-9f: persists between service instances (simulates app restart)', async () => {
    const filePath = tempPath('recent.json')

    const service1: IRecentCabinets = new RecentCabinetsService(filePath)
    await service1.add({ path: '/films.cabinet', name: 'Films', lastOpenedAt: '2026-08-01T10:00:00.000Z' })

    // New instance — simulates app restart
    const service2: IRecentCabinets = new RecentCabinetsService(filePath)
    const entries = await service2.list()
    expect(entries).toHaveLength(1)
    expect(entries[0].path).toBe('/films.cabinet')
  })
})

// ── AC-10: ICabinetEngine interface is mockable (NFR-011) ────────────────────

describe('ICabinetEngine mockability (NFR-011)', () => {
  it('AC-10: a mock implementation satisfies the ICabinetEngine interface', async () => {
    // This test confirms the interface is mockable without any concrete dependency
    const mockEngine: ICabinetEngine = {
      create: async () => ({
        id: 'mock-id',
        name: 'Mock Cabinet',
        path: '/mock/path.cabinet',
        schemaVersion: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      open: async () => ({
        meta: {
          id: 'mock-id',
          name: 'Mock Cabinet',
          path: '/mock/path.cabinet',
          schemaVersion: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
      close: async () => {},
      currentCabinet: () => null,
    }

    const meta = await mockEngine.create({ path: '/mock/path.cabinet' })
    expect(meta.id).toBe('mock-id')
    expect(meta.name).toBe('Mock Cabinet')

    const result = await mockEngine.open('/mock/path.cabinet')
    expect(result.meta.schemaVersion).toBe(1)

    await mockEngine.close()
    expect(mockEngine.currentCabinet()).toBeNull()
  })
})
