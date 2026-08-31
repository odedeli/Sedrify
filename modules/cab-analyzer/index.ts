// ─────────────────────────────────────────────────────────────────────────────
// Cab Analyzer — Essential Module
// Responsibility: Visualisation and reporting — charts, dashboards, exports.
// Sprint M-5 will implement the full feature module. Scope TBD per RFD.
// ─────────────────────────────────────────────────────────────────────────────

import type { ICabModule, IModuleRegistry, FoundationDependency } from '../../foundation/contracts/IPluginContract'

export const MODULE_ID = 'cab-analyzer'

export class CabAnalyzerModule implements ICabModule {
  readonly id = MODULE_ID
  readonly displayName = 'Cab Analyzer'
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
