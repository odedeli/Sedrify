// ─────────────────────────────────────────────────────────────────────────────
// Cab Explorer — Essential Module
// Responsibility: Cabinet lifecycle — open, save, clone, backup, restore, encrypt.
// Sprint M-1 will implement the full feature module.
// ─────────────────────────────────────────────────────────────────────────────

import type { ICabModule, IModuleRegistry, FoundationDependency } from '../../foundation/contracts/IPluginContract'

export const MODULE_ID = 'cab-explorer'

export class CabExplorerModule implements ICabModule {
  readonly id = MODULE_ID
  readonly displayName = 'Cab Explorer'
  readonly parentModuleId = null
  readonly dependencies: FoundationDependency[] = [
    'ICabinetEngine',
    'IRecentCabinets',
  ]

  register(registry: IModuleRegistry): void {
    registry.register(this)
  }
}
