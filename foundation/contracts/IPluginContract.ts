// ─────────────────────────────────────────────────────────────────────────────
// Sedrify Foundation — Plugin Contract Interfaces
// Appendix A of the RFD: Module Registration Contract.
// NFR-011: All layer boundaries must be mockable.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Foundation contract dependencies a module may declare.
 * Modules declare which Foundation interfaces they depend on.
 * The shell / DI root uses this to inject the correct implementations.
 */
export type FoundationDependency =
  | 'ICabinetEngine'
  | 'IRecentCabinets'
  | 'IFieldTypeRegistry'
  | 'IFieldRepository'
  | 'IChoiceOptionRepository'
  | 'IRecordRepository'

/**
 * Every feature module must implement this interface.
 * Appendix A.1 — Module Registration Contract.
 */
export interface ICabModule {
  /**
   * Unique, stable identifier for this module.
   * Convention: kebab-case, e.g. 'cab-explorer', 'cab-designer'.
   * Extension modules use parent prefix: 'cab-feeder.scheduler'.
   */
  readonly id: string

  /** Human-readable display name shown in the UI shell navigation. */
  readonly displayName: string

  /**
   * Parent module id for extension modules.
   * null for essential (top-level) modules.
   * Appendix A.3 — Extension Contract.
   */
  readonly parentModuleId: string | null

  /**
   * Foundation interfaces this module depends on.
   * The shell uses this to inject correct implementations.
   * Appendix A.2 — Foundation Access Contract.
   */
  readonly dependencies: FoundationDependency[]

  /**
   * Called by the shell at startup to register this module.
   * The module declares its routes, views, and navigation entries here.
   * Must not throw — registration errors are caught and logged by the shell.
   */
  register(registry: IModuleRegistry): void
}

/**
 * The registry that the shell provides to each module during registration.
 * Appendix A.1 — Module Registration Contract.
 * NFR-011: Must be mockable.
 */
export interface IModuleRegistry {
  /**
   * Register a module.
   * Throws if a module with the same id is already registered.
   * Throws if parentModuleId is set and the parent is not yet registered.
   */
  register(module: ICabModule): void

  /** Return a registered module by id, or undefined if not found. */
  get(moduleId: string): ICabModule | undefined

  /** Return all registered modules in registration order. */
  all(): ICabModule[]

  /** Return true if a module with this id is registered. */
  has(moduleId: string): boolean

  /** Return all registered extension modules for a given parent. */
  extensionsOf(parentModuleId: string): ICabModule[]
}
