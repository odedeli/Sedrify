// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Sprint F-4 Tests
// Plugin contracts: ModuleRegistry, ICabModule, five essential module stubs.
// No Electron, no UI, no SQLite — pure TypeScript + Vitest.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { ModuleRegistry } from '../plugin/ModuleRegistry'
import { CabExplorerModule } from '../../modules/cab-explorer'
import { CabDesignerModule } from '../../modules/cab-designer'
import { CabFeederModule } from '../../modules/cab-feeder'
import { CabFinderModule } from '../../modules/cab-finder'
import { CabAnalyzerModule } from '../../modules/cab-analyzer'
import type { ICabModule, IModuleRegistry } from '../contracts/IPluginContract'

// ── AC-1 + AC-2: ModuleRegistry ───────────────────────────────────────────────

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry

  beforeEach(() => {
    registry = new ModuleRegistry()
  })

  it('AC-2a: starts empty', () => {
    expect(registry.all()).toHaveLength(0)
    expect(registry.has('cab-explorer')).toBe(false)
  })

  it('AC-2b: registers a module and retrieves it by id', () => {
    const mod = new CabExplorerModule()
    mod.register(registry)

    expect(registry.has('cab-explorer')).toBe(true)
    expect(registry.get('cab-explorer')).toBe(mod)
  })

  it('AC-2c: all() returns modules in registration order', () => {
    new CabExplorerModule().register(registry)
    new CabDesignerModule().register(registry)
    new CabFeederModule().register(registry)

    const all = registry.all()
    expect(all).toHaveLength(3)
    expect(all[0].id).toBe('cab-explorer')
    expect(all[1].id).toBe('cab-designer')
    expect(all[2].id).toBe('cab-feeder')
  })

  // AC-6: no duplicate registrations
  it('AC-6: throws on duplicate module id', () => {
    new CabExplorerModule().register(registry)
    expect(() => new CabExplorerModule().register(registry)).toThrow(/already registered/)
  })

  // AC-5: extension must declare registered parent
  it('AC-5a: extension module registers successfully when parent exists', () => {
    new CabFeederModule().register(registry)

    const schedulerExtension: ICabModule = {
      id: 'cab-feeder.scheduler',
      displayName: 'Scheduler',
      parentModuleId: 'cab-feeder',
      dependencies: ['IRecordRepository'],
      register(reg) { reg.register(this) },
    }
    expect(() => schedulerExtension.register(registry)).not.toThrow()
    expect(registry.has('cab-feeder.scheduler')).toBe(true)
  })

  it('AC-5b: extension module throws when parent is not registered', () => {
    const orphanExtension: ICabModule = {
      id: 'cab-feeder.scheduler',
      displayName: 'Scheduler',
      parentModuleId: 'cab-feeder', // not registered yet
      dependencies: [],
      register(reg) { reg.register(this) },
    }
    expect(() => orphanExtension.register(registry)).toThrow(/parent module/)
  })

  it('AC-5c: extensionsOf() returns only extensions of a given parent', () => {
    new CabFeederModule().register(registry)
    new CabDesignerModule().register(registry)

    const ext1: ICabModule = {
      id: 'cab-feeder.scheduler',
      displayName: 'Scheduler',
      parentModuleId: 'cab-feeder',
      dependencies: [],
      register(reg) { reg.register(this) },
    }
    const ext2: ICabModule = {
      id: 'cab-feeder.kanban',
      displayName: 'Kanban',
      parentModuleId: 'cab-feeder',
      dependencies: [],
      register(reg) { reg.register(this) },
    }
    ext1.register(registry)
    ext2.register(registry)

    const feederExtensions = registry.extensionsOf('cab-feeder')
    expect(feederExtensions).toHaveLength(2)
    expect(feederExtensions.map(e => e.id)).toContain('cab-feeder.scheduler')
    expect(feederExtensions.map(e => e.id)).toContain('cab-feeder.kanban')

    expect(registry.extensionsOf('cab-designer')).toHaveLength(0)
  })
})

// ── AC-3: Five essential modules register correctly ───────────────────────────

describe('Essential module stubs', () => {
  let registry: ModuleRegistry

  beforeEach(() => {
    registry = new ModuleRegistry()
    new CabExplorerModule().register(registry)
    new CabDesignerModule().register(registry)
    new CabFeederModule().register(registry)
    new CabFinderModule().register(registry)
    new CabAnalyzerModule().register(registry)
  })

  it('AC-3a: all five essential modules are registered', () => {
    expect(registry.all()).toHaveLength(5)
    expect(registry.has('cab-explorer')).toBe(true)
    expect(registry.has('cab-designer')).toBe(true)
    expect(registry.has('cab-feeder')).toBe(true)
    expect(registry.has('cab-finder')).toBe(true)
    expect(registry.has('cab-analyzer')).toBe(true)
  })

  it('AC-3b: all essential modules have null parentModuleId', () => {
    for (const mod of registry.all()) {
      expect(mod.parentModuleId).toBeNull()
    }
  })

  it('AC-3c: all essential modules have non-empty displayName', () => {
    for (const mod of registry.all()) {
      expect(mod.displayName.length).toBeGreaterThan(0)
    }
  })

  // AC-4: each module declares its Foundation dependencies
  it('AC-4a: CabExplorer declares cabinet dependencies', () => {
    const mod = registry.get('cab-explorer')!
    expect(mod.dependencies).toContain('ICabinetEngine')
    expect(mod.dependencies).toContain('IRecentCabinets')
  })

  it('AC-4b: CabDesigner declares field dependencies', () => {
    const mod = registry.get('cab-designer')!
    expect(mod.dependencies).toContain('IFieldTypeRegistry')
    expect(mod.dependencies).toContain('IFieldRepository')
    expect(mod.dependencies).toContain('IChoiceOptionRepository')
  })

  it('AC-4c: CabFeeder declares field and record dependencies', () => {
    const mod = registry.get('cab-feeder')!
    expect(mod.dependencies).toContain('IFieldRepository')
    expect(mod.dependencies).toContain('IRecordRepository')
  })

  it('AC-4d: CabFinder declares field and record dependencies', () => {
    const mod = registry.get('cab-finder')!
    expect(mod.dependencies).toContain('IFieldRepository')
    expect(mod.dependencies).toContain('IRecordRepository')
  })

  it('AC-4e: CabAnalyzer declares field and record dependencies', () => {
    const mod = registry.get('cab-analyzer')!
    expect(mod.dependencies).toContain('IFieldRepository')
    expect(mod.dependencies).toContain('IRecordRepository')
  })

  it('AC-4f: all dependencies are valid FoundationDependency values', () => {
    const valid = new Set([
      'ICabinetEngine', 'IRecentCabinets', 'IFieldTypeRegistry',
      'IFieldRepository', 'IChoiceOptionRepository', 'IRecordRepository',
    ])
    for (const mod of registry.all()) {
      for (const dep of mod.dependencies) {
        expect(valid.has(dep)).toBe(true)
      }
    }
  })
})

// ── AC-7: IModuleRegistry mockability (NFR-011) ───────────────────────────────

describe('IModuleRegistry mockability (NFR-011)', () => {
  it('AC-7: a mock implementation satisfies the IModuleRegistry interface', () => {
    const mockMod: ICabModule = {
      id: 'mock-module',
      displayName: 'Mock',
      parentModuleId: null,
      dependencies: [],
      register: () => {},
    }

    const mock: IModuleRegistry = {
      register: () => {},
      get: (id) => id === 'mock-module' ? mockMod : undefined,
      all: () => [mockMod],
      has: (id) => id === 'mock-module',
      extensionsOf: () => [],
    }

    expect(mock.has('mock-module')).toBe(true)
    expect(mock.has('other')).toBe(false)
    expect(mock.all()).toHaveLength(1)
    expect(mock.get('mock-module')?.displayName).toBe('Mock')
    expect(mock.extensionsOf('mock-module')).toHaveLength(0)
  })
})

// ── AC-8: module stubs use correct module structure ───────────────────────────

describe('Module stub structure (AC-8)', () => {
  it('each module exports MODULE_ID constant matching its class id', () => {
    expect(new CabExplorerModule().id).toBe('cab-explorer')
    expect(new CabDesignerModule().id).toBe('cab-designer')
    expect(new CabFeederModule().id).toBe('cab-feeder')
    expect(new CabFinderModule().id).toBe('cab-finder')
    expect(new CabAnalyzerModule().id).toBe('cab-analyzer')
  })

  it('register() calls registry.register(this) — verifiable via registry', () => {
    const registry = new ModuleRegistry()
    const mod = new CabExplorerModule()

    // Before register
    expect(registry.has(mod.id)).toBe(false)

    // After register
    mod.register(registry)
    expect(registry.has(mod.id)).toBe(true)
    expect(registry.get(mod.id)).toBe(mod)
  })
})
