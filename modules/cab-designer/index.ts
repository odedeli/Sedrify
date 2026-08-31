// ─────────────────────────────────────────────────────────────────────────────
// Cab Designer — Essential Module
// Responsibility: Schema definition — fields, types, masks, formats, relationships.
// Sprint M-2 will implement the full feature module.
// ─────────────────────────────────────────────────────────────────────────────

import type { ICabModule, IModuleRegistry, FoundationDependency } from '../../foundation/contracts/IPluginContract'

export const MODULE_ID = 'cab-designer'

export class CabDesignerModule implements ICabModule {
  readonly id = MODULE_ID
  readonly displayName = 'Cab Designer'
  readonly parentModuleId = null
  readonly dependencies: FoundationDependency[] = [
    'IFieldTypeRegistry',
    'IFieldRepository',
    'IChoiceOptionRepository',
  ]

  register(registry: IModuleRegistry): void {
    registry.register(this)
  }
}
