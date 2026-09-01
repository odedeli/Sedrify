// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — Window API type declarations  (v1.3.0 — adds field API)
// Exposed by the preload script via contextBridge.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IpcResult,
  CabinetInfo,
  RecentCabinetInfo,
  CabinetCreatePayload,
  CabinetClonePayload,
  FieldInfo,
  FieldCreatePayload,
  FieldUpdatePayload,
  FieldReorderPayload,
} from '../main/ipcChannels'

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
    field: {
      list(): Promise<IpcResult<FieldInfo[]>>
      listRecycled(): Promise<IpcResult<FieldInfo[]>>
      create(payload: FieldCreatePayload): Promise<IpcResult<FieldInfo>>
      update(payload: FieldUpdatePayload): Promise<IpcResult<FieldInfo>>
      reorder(payload: FieldReorderPayload): Promise<IpcResult<null>>
      recycle(id: string): Promise<IpcResult<null>>
      restore(id: string): Promise<IpcResult<FieldInfo>>
      duplicate(id: string): Promise<IpcResult<FieldInfo>>
    }
  }
}

export {}
