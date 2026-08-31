// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — Window API type declarations for the renderer process
// These are exposed by the preload script via contextBridge.
// ─────────────────────────────────────────────────────────────────────────────

import type { IpcResult, CabinetInfo, RecentCabinetInfo, CabinetCreatePayload, CabinetClonePayload } from '../main/ipcChannels'

declare global {
  interface Window {
    cabinet: {
      create(payload: CabinetCreatePayload): Promise<IpcResult<CabinetInfo>>
      open(path: string): Promise<IpcResult<CabinetInfo>>
      close(): Promise<IpcResult<null>>
      current(): Promise<IpcResult<CabinetInfo | null>>
      clone(payload: CabinetClonePayload): Promise<IpcResult<{ destPath: string }>>
      delete(path: string): Promise<IpcResult<null>>
    }
    recent: {
      list(): Promise<IpcResult<RecentCabinetInfo[]>>
      remove(path: string): Promise<IpcResult<null>>
    }
    dialog: {
      openFile(): Promise<IpcResult<string | null>>
      saveFile(defaultName?: string): Promise<IpcResult<string | null>>
    }
  }
}

export {}
