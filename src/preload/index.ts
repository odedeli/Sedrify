import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type IpcResult, type CabinetInfo, type RecentCabinetInfo, type CabinetCreatePayload, type CabinetClonePayload } from '../main/ipcChannels'

// ── Cabinet API exposed to renderer ───────────────────────────────────────────

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

// ── Expose to renderer ────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('cabinet', cabinetAPI)
contextBridge.exposeInMainWorld('recent', recentAPI)
contextBridge.exposeInMainWorld('dialog', dialogAPI)

// ── TypeScript declarations (available in renderer) ───────────────────────────

export type CabinetAPI = typeof cabinetAPI
export type RecentAPI = typeof recentAPI
export type DialogAPI = typeof dialogAPI
