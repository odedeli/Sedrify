export const IPC = {
  CABINET_CREATE:      'cabinet:create',
  CABINET_OPEN:        'cabinet:open',
  CABINET_CLOSE:       'cabinet:close',
  CABINET_CURRENT:     'cabinet:current',
  CABINET_CLONE:       'cabinet:clone',
  CABINET_DELETE:      'cabinet:delete',
  CABINET_FILE_SIZE:   'cabinet:fileSize',
  RECENT_LIST:         'recent:list',
  RECENT_REMOVE:       'recent:remove',
  DIALOG_OPEN_FILE:    'dialog:openFile',
  DIALOG_SAVE_FILE:    'dialog:saveFile',
  FIELD_LIST:          'field:list',
  FIELD_LIST_RECYCLED: 'field:listRecycled',
  FIELD_CREATE:        'field:create',
  FIELD_UPDATE:        'field:update',
  FIELD_REORDER:       'field:reorder',
  FIELD_RECYCLE:       'field:recycle',
  FIELD_RESTORE:       'field:restore',
  FIELD_DUPLICATE:     'field:duplicate',
  RECORD_LIST:         'record:list',
  RECORD_LIST_RECYCLED:'record:listRecycled',
  RECORD_DRAFT:        'record:draft',
  RECORD_SAVE:         'record:save',
  RECORD_UPDATE:       'record:update',
  RECORD_RECYCLE:      'record:recycle',
  RECORD_RESTORE:      'record:restore',
  RECORD_DELETE:       'record:delete',
} as const

export interface CabinetCreatePayload { path: string; name?: string }
export interface CabinetClonePayload { sourcePath: string; destPath: string }
export interface CabinetInfo {
  id: string; name: string; path: string
  schemaVersion: number; createdAt: string; updatedAt: string
}
export interface RecentCabinetInfo { path: string; name: string; lastOpenedAt: string }

export type FieldType =
  | 'text' | 'multiline' | 'integer' | 'decimal' | 'date' | 'datetime'
  | 'yesno' | 'choice' | 'linked-file' | 'embedded-file'
  | 'url' | 'email' | 'phone' | 'currency' | 'rating' | 'percentage'
  | 'time' | 'duration' | 'tags' | 'multichoice' | 'lookup' | 'formula'

export interface FieldInfo {
  id: string; collectionId: string; name: string; type: FieldType
  required: boolean; isPrimary: boolean; description: string
  defaultValue: string; displayOrder: number
  options: Record<string, string | number | boolean | string[]>
  recycled: boolean; createdAt: string; updatedAt: string
}
export interface FieldCreatePayload {
  name: string; type: FieldType; required: boolean; isPrimary: boolean
  description: string; defaultValue: string
  options: Record<string, string | number | boolean | string[]>
}
export interface FieldUpdatePayload {
  id: string; name?: string; type?: FieldType; required?: boolean
  isPrimary?: boolean; description?: string; defaultValue?: string
  options?: Record<string, string | number | boolean | string[]>
}
export interface FieldReorderPayload { orderedIds: string[] }

export type RecordValue = string | number | null
export interface RecordInfo {
  id: string; collectionId: string; sequence: number
  recycled: boolean; recycledAt: string | null
  createdAt: string; updatedAt: string
  values: Record<string, RecordValue>
}
export interface RecordDraftInfo { collectionId: string; values: Record<string, RecordValue> }
export interface RecordSavePayload { values: Record<string, RecordValue> }
export interface RecordUpdatePayload { id: string; values: Record<string, RecordValue> }

export interface IpcOk<T> { ok: true; data: T }
export interface IpcFail { ok: false; error: string }
export type IpcResult<T> = IpcOk<T> | IpcFail
