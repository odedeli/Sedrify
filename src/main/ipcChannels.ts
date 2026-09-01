// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — IPC Channel Definitions  (v1.3.0 — adds field channels)
// Shared between main process, preload, and renderer.
// ─────────────────────────────────────────────────────────────────────────────

export const IPC = {
  // ── Cabinet operations (M-1) ────────────────────────────────────────────────
  CABINET_CREATE:     'cabinet:create',
  CABINET_OPEN:       'cabinet:open',
  CABINET_CLOSE:      'cabinet:close',
  CABINET_CURRENT:    'cabinet:current',
  CABINET_CLONE:      'cabinet:clone',
  CABINET_DELETE:     'cabinet:delete',

  // ── Recent cabinets (M-1) ───────────────────────────────────────────────────
  RECENT_LIST:        'recent:list',
  RECENT_REMOVE:      'recent:remove',

  // ── OS dialogs (M-1) ────────────────────────────────────────────────────────
  DIALOG_OPEN_FILE:   'dialog:openFile',
  DIALOG_SAVE_FILE:   'dialog:saveFile',

  // ── Field operations (M-2) ──────────────────────────────────────────────────
  FIELD_LIST:         'field:list',           // list active fields for open cabinet
  FIELD_LIST_RECYCLED:'field:listRecycled',   // list recycled fields
  FIELD_CREATE:       'field:create',         // create new field
  FIELD_UPDATE:       'field:update',         // update field properties
  FIELD_REORDER:      'field:reorder',        // persist display order
  FIELD_RECYCLE:      'field:recycle',        // soft-delete
  FIELD_RESTORE:      'field:restore',        // restore from recycle
  FIELD_DUPLICATE:    'field:duplicate',      // create copy of a field
} as const

// ── Cabinet payload types (M-1) ───────────────────────────────────────────────

export interface CabinetCreatePayload {
  path: string
  name?: string
}

export interface CabinetClonePayload {
  sourcePath: string
  destPath: string
}

export interface CabinetInfo {
  id: string
  name: string
  path: string
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface RecentCabinetInfo {
  path: string
  name: string
  lastOpenedAt: string
}

// ── Field payload types (M-2) ─────────────────────────────────────────────────

// FieldType mirrors the FieldType enum from Foundation — string literals
export type FieldType =
  | 'text'
  | 'multiline'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'yesno'
  | 'choice'
  | 'linked-file'
  | 'embedded-file'
  // Extension types (stored as-is, interpreted by feature modules):
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'
  | 'rating'
  | 'percentage'
  | 'time'
  | 'duration'
  | 'tags'
  | 'multichoice'
  | 'lookup'
  | 'formula'

export interface FieldInfo {
  id: string
  collectionId: string
  name: string
  type: FieldType
  required: boolean
  isPrimary: boolean
  description: string
  defaultValue: string
  displayOrder: number
  options: Record<string, string | number | boolean | string[]>
  recycled: boolean
  createdAt: string
  updatedAt: string
}

export interface FieldCreatePayload {
  name: string
  type: FieldType
  required: boolean
  isPrimary: boolean
  description: string
  defaultValue: string
  options: Record<string, string | number | boolean | string[]>
}

export interface FieldUpdatePayload {
  id: string
  name?: string
  type?: FieldType
  required?: boolean
  isPrimary?: boolean
  description?: string
  defaultValue?: string
  options?: Record<string, string | number | boolean | string[]>
}

export interface FieldReorderPayload {
  // Ordered array of field IDs representing the new display order
  orderedIds: string[]
}

// ── IPC result wrapper (M-1) ──────────────────────────────────────────────────

export interface IpcOk<T> {
  ok: true
  data: T
}

export interface IpcFail {
  ok: false
  error: string
}

export type IpcResult<T> = IpcOk<T> | IpcFail
