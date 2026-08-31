// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Module Registry (concrete implementation)
// The shell instantiates one ModuleRegistry and passes it to each module.
// Feature modules must not import this class directly — use IModuleRegistry.
// ─────────────────────────────────────────────────────────────────────────────

import type { ICabModule, IModuleRegistry } from '../contracts/IPluginContract'

export class ModuleRegistry implements IModuleRegistry {
  private readonly modules: Map<string, ICabModule> = new Map()
  private readonly order: string[] = []

  register(module: ICabModule): void {
    // AC-6: no duplicate registrations
    if (this.modules.has(module.id)) {
      throw new Error(`Module already registered: ${module.id}`)
    }

    // AC-5: validate parent exists if declared
    if (module.parentModuleId !== null) {
      if (!this.modules.has(module.parentModuleId)) {
        throw new Error(
          `Cannot register extension "${module.id}": ` +
          `parent module "${module.parentModuleId}" is not registered`
        )
      }
    }

    this.modules.set(module.id, module)
    this.order.push(module.id)
  }

  get(moduleId: string): ICabModule | undefined {
    return this.modules.get(moduleId)
  }

  all(): ICabModule[] {
    return this.order.map(id => this.modules.get(id)!)
  }

  has(moduleId: string): boolean {
    return this.modules.has(moduleId)
  }

  extensionsOf(parentModuleId: string): ICabModule[] {
    return this.all().filter(m => m.parentModuleId === parentModuleId)
  }
}
