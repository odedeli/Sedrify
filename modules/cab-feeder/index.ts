// ─────────────────────────────────────────────────────────────────────────────
// Cab Feeder — Essential Module
// Responsibility: Data entry and editing — tabular, form, and other input modes.
// Sprint M-3 will implement the full feature module.
// ─────────────────────────────────────────────────────────────────────────────

import type { ICabModule, IModuleRegistry, FoundationDependency } from '../../foundation/contracts/IPluginContract'

export const MODULE_ID = 'cab-feeder'

export class CabFeederModule implements ICabModule {
  readonly id = MODULE_ID
  readonly displayName = 'Cab Feeder'
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
