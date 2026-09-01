import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type IpcResult,
  type CabinetInfo,
  type RecentCabinetInfo,
  type CabinetCreatePayload,
  type CabinetClonePayload,
  type FieldInfo,
  type FieldCreatePayload,
  type FieldUpdatePayload,
  type FieldReorderPayload,
} from '../main/ipcChannels'

// ── Cabinet API (M-1) ─────────────────────────────────────────────────────────

const cabinetAPI = {
  create: (payload: CabinetCreatePayload): Promise<IpcResult<CabinetInfo>> =>
    ipcRenderer.invoke(IPC.CABINET_CREATE, payload),
  open: (path: string): Promise<IpcResult<CabinetInfo>> =>
    ipcRenderer.invoke(IPC.CABINET_OPEN, path),
  close: (): Promise<IpcResult<null>> =>
    ipcRenderer.invoke(IPC.CABINET_CLOSE),
  current: (): Promise<IpcResult<CabinetInfo | null>> =>
    ipcRenderer.invoke(IPC.CABINET_CURRENT),
  clone: (payload: CabinetClonePayload): Promise<IpcResult<{ destPath: string }>> =>
    ipcRenderer.invoke(IPC.CABINET_CLONE, payload),
  delete: (path: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke(IPC.CABINET_DELETE, path),
}

const recentAPI = {
  list: (): Promise<IpcResult<RecentCabinetInfo[]>> =>
    ipcRenderer.invoke(IPC.RECENT_LIST),
  remove: (path: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke(IPC.RECENT_REMOVE, path),
}

const dialogAPI = {
  openFile: (): Promise<IpcResult<string | null>> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE),
  saveFile: (defaultName?: string): Promise<IpcResult<string | null>> =>
    ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE, defaultName),
}

// ── Field API (M-2) ───────────────────────────────────────────────────────────

const fieldAPI = {
  list: (): Promise<IpcResult<FieldInfo[]>> =>
    ipcRenderer.invoke(IPC.FIELD_LIST),
  listRecycled: (): Promise<IpcResult<FieldInfo[]>> =>
    ipcRenderer.invoke(IPC.FIELD_LIST_RECYCLED),
  create: (payload: FieldCreatePayload): Promise<IpcResult<FieldInfo>> =>
    ipcRenderer.invoke(IPC.FIELD_CREATE, payload),
  update: (payload: FieldUpdatePayload): Promise<IpcResult<FieldInfo>> =>
    ipcRenderer.invoke(IPC.FIELD_UPDATE, payload),
  reorder: (payload: FieldReorderPayload): Promise<IpcResult<null>> =>
    ipcRenderer.invoke(IPC.FIELD_REORDER, payload),
  recycle: (id: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke(IPC.FIELD_RECYCLE, id),
  restore: (id: string): Promise<IpcResult<FieldInfo>> =>
    ipcRenderer.invoke(IPC.FIELD_RESTORE, id),
  duplicate: (id: string): Promise<IpcResult<FieldInfo>> =>
    ipcRenderer.invoke(IPC.FIELD_DUPLICATE, id),
}

// ── Expose to renderer ────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('cabinet', cabinetAPI)
contextBridge.exposeInMainWorld('recent', recentAPI)
contextBridge.exposeInMainWorld('dialog', dialogAPI)
contextBridge.exposeInMainWorld('field', fieldAPI)

// ── Type exports (for window.d.ts) ────────────────────────────────────────────

export type CabinetAPI = typeof cabinetAPI
export type RecentAPI = typeof recentAPI
export type DialogAPI = typeof dialogAPI
export type FieldAPI = typeof fieldAPI
