// ─────────────────────────────────────────────────────────────────────────────
// Cab Finder — Essential Module
// Responsibility: Cross-cutting search and lookup — records, fields, files.
// Sprint M-4 will implement the full feature module.
// ─────────────────────────────────────────────────────────────────────────────

import type { ICabModule, IModuleRegistry, FoundationDependency } from '../../foundation/contracts/IPluginContract'

export const MODULE_ID = 'cab-finder'

export class CabFinderModule implements ICabModule {
  readonly id = MODULE_ID
  readonly displayName = 'Cab Finder'
  readonly parentModuleId = null
  readonly dependencies: FoundationDependency[] = [
    'IFieldTypeRegistry',
    'IFieldRepository',
    'IRecordRepository',
  ]

  register(registry: IModuleRegistry): void {
    registry.register(this)
  }
}
