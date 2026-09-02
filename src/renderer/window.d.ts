import type {
  IpcResult, CabinetInfo, RecentCabinetInfo,
  CabinetCreatePayload, CabinetClonePayload,
  FieldInfo, FieldCreatePayload, FieldUpdatePayload, FieldReorderPayload,
  RecordInfo, RecordDraftInfo, RecordSavePayload, RecordUpdatePayload,
} from '../main/ipcChannels'
import type { AppSettingsData } from '../main/settings-handlers'

declare global {
  interface Window {
    cabinet: {
      create(p: CabinetCreatePayload): Promise<IpcResult<CabinetInfo>>
      open(path: string): Promise<IpcResult<CabinetInfo>>
      close(): Promise<IpcResult<null>>
      current(): Promise<IpcResult<CabinetInfo | null>>
      clone(p: CabinetClonePayload): Promise<IpcResult<{ destPath: string }>>
      delete(path: string): Promise<IpcResult<null>>
      fileSize(): Promise<IpcResult<number>>
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
      create(p: FieldCreatePayload): Promise<IpcResult<FieldInfo>>
      update(p: FieldUpdatePayload): Promise<IpcResult<FieldInfo>>
      reorder(p: FieldReorderPayload): Promise<IpcResult<null>>
      recycle(id: string): Promise<IpcResult<null>>
      restore(id: string): Promise<IpcResult<FieldInfo>>
      duplicate(id: string): Promise<IpcResult<FieldInfo>>
    }
    record: {
      list(): Promise<IpcResult<RecordInfo[]>>
      listRecycled(): Promise<IpcResult<RecordInfo[]>>
      draft(): Promise<IpcResult<RecordDraftInfo>>
      save(p: RecordSavePayload): Promise<IpcResult<RecordInfo>>
      update(p: RecordUpdatePayload): Promise<IpcResult<RecordInfo>>
      recycle(id: string): Promise<IpcResult<null>>
      restore(id: string): Promise<IpcResult<RecordInfo>>
      delete(id: string): Promise<IpcResult<null>>
    }
    settings: {
      get(): Promise<IpcResult<AppSettingsData>>
      set(s: AppSettingsData): Promise<IpcResult<AppSettingsData>>
      reset(): Promise<IpcResult<AppSettingsData>>
    }
  }
}

export {}
