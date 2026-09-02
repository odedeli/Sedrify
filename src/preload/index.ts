import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type IpcResult,
  type CabinetInfo, type RecentCabinetInfo,
  type CabinetCreatePayload, type CabinetClonePayload,
  type FieldInfo, type FieldCreatePayload, type FieldUpdatePayload, type FieldReorderPayload,
  type RecordInfo, type RecordDraftInfo, type RecordSavePayload, type RecordUpdatePayload,
} from '../main/ipcChannels'
import { SETTINGS_GET, SETTINGS_SET, SETTINGS_RESET, type AppSettingsData } from '../main/settings-handlers'

const cabinetAPI = {
  create: (p: CabinetCreatePayload): Promise<IpcResult<CabinetInfo>> => ipcRenderer.invoke(IPC.CABINET_CREATE, p),
  open: (path: string): Promise<IpcResult<CabinetInfo>> => ipcRenderer.invoke(IPC.CABINET_OPEN, path),
  close: (): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.CABINET_CLOSE),
  current: (): Promise<IpcResult<CabinetInfo | null>> => ipcRenderer.invoke(IPC.CABINET_CURRENT),
  clone: (p: CabinetClonePayload): Promise<IpcResult<{ destPath: string }>> => ipcRenderer.invoke(IPC.CABINET_CLONE, p),
  delete: (path: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.CABINET_DELETE, path),
  fileSize: (): Promise<IpcResult<number>> => ipcRenderer.invoke(IPC.CABINET_FILE_SIZE),
}

const recentAPI = {
  list: (): Promise<IpcResult<RecentCabinetInfo[]>> => ipcRenderer.invoke(IPC.RECENT_LIST),
  remove: (path: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.RECENT_REMOVE, path),
}

const dialogAPI = {
  openFile: (): Promise<IpcResult<string | null>> => ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE),
  saveFile: (n?: string): Promise<IpcResult<string | null>> => ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE, n),
}

const fieldAPI = {
  list: (): Promise<IpcResult<FieldInfo[]>> => ipcRenderer.invoke(IPC.FIELD_LIST),
  listRecycled: (): Promise<IpcResult<FieldInfo[]>> => ipcRenderer.invoke(IPC.FIELD_LIST_RECYCLED),
  create: (p: FieldCreatePayload): Promise<IpcResult<FieldInfo>> => ipcRenderer.invoke(IPC.FIELD_CREATE, p),
  update: (p: FieldUpdatePayload): Promise<IpcResult<FieldInfo>> => ipcRenderer.invoke(IPC.FIELD_UPDATE, p),
  reorder: (p: FieldReorderPayload): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.FIELD_REORDER, p),
  recycle: (id: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.FIELD_RECYCLE, id),
  restore: (id: string): Promise<IpcResult<FieldInfo>> => ipcRenderer.invoke(IPC.FIELD_RESTORE, id),
  duplicate: (id: string): Promise<IpcResult<FieldInfo>> => ipcRenderer.invoke(IPC.FIELD_DUPLICATE, id),
}

const recordAPI = {
  list: (): Promise<IpcResult<RecordInfo[]>> => ipcRenderer.invoke(IPC.RECORD_LIST),
  listRecycled: (): Promise<IpcResult<RecordInfo[]>> => ipcRenderer.invoke(IPC.RECORD_LIST_RECYCLED),
  draft: (): Promise<IpcResult<RecordDraftInfo>> => ipcRenderer.invoke(IPC.RECORD_DRAFT),
  save: (p: RecordSavePayload): Promise<IpcResult<RecordInfo>> => ipcRenderer.invoke(IPC.RECORD_SAVE, p),
  update: (p: RecordUpdatePayload): Promise<IpcResult<RecordInfo>> => ipcRenderer.invoke(IPC.RECORD_UPDATE, p),
  recycle: (id: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.RECORD_RECYCLE, id),
  restore: (id: string): Promise<IpcResult<RecordInfo>> => ipcRenderer.invoke(IPC.RECORD_RESTORE, id),
  delete: (id: string): Promise<IpcResult<null>> => ipcRenderer.invoke(IPC.RECORD_DELETE, id),
}

const settingsAPI = {
  get: (): Promise<IpcResult<AppSettingsData>> => ipcRenderer.invoke(SETTINGS_GET),
  set: (s: AppSettingsData): Promise<IpcResult<AppSettingsData>> => ipcRenderer.invoke(SETTINGS_SET, s),
  reset: (): Promise<IpcResult<AppSettingsData>> => ipcRenderer.invoke(SETTINGS_RESET),
}

contextBridge.exposeInMainWorld('cabinet', cabinetAPI)
contextBridge.exposeInMainWorld('recent', recentAPI)
contextBridge.exposeInMainWorld('dialog', dialogAPI)
contextBridge.exposeInMainWorld('field', fieldAPI)
contextBridge.exposeInMainWorld('record', recordAPI)
contextBridge.exposeInMainWorld('settings', settingsAPI)

export type CabinetAPI = typeof cabinetAPI
export type RecentAPI = typeof recentAPI
export type DialogAPI = typeof dialogAPI
export type FieldAPI = typeof fieldAPI
export type RecordAPI = typeof recordAPI
export type SettingsAPI = typeof settingsAPI
