// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — IPC Channel Definitions
// Shared between main process, preload, and renderer.
// ─────────────────────────────────────────────────────────────────────────────

export const IPC = {
  CABINET_CREATE:   'cabinet:create',
  CABINET_OPEN:     'cabinet:open',
  CABINET_CLOSE:    'cabinet:close',
  CABINET_CURRENT:  'cabinet:current',
  CABINET_CLONE:    'cabinet:clone',
  CABINET_DELETE:   'cabinet:delete',
  RECENT_LIST:      'recent:list',
  RECENT_REMOVE:    'recent:remove',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',
} as const

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

// Discriminated union as two separate interfaces + a type alias
export interface IpcOk<T> {
  ok: true
  data: T
}

export interface IpcFail {
  ok: false
  error: string
}

export type IpcResult<T> = IpcOk<T> | IpcFail
