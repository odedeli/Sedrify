// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — IPC wrapper with DevLog integration
// contextBridge objects are frozen — wrap here instead of patching window.
// ─────────────────────────────────────────────────────────────────────────────

import { devLog } from '../components/DevLog'
import type {
  IpcResult, CabinetInfo, RecentCabinetInfo,
  CabinetCreatePayload, CabinetClonePayload,
  FieldInfo, FieldCreatePayload, FieldUpdatePayload, FieldReorderPayload,
  RecordInfo, RecordDraftInfo, RecordSavePayload, RecordUpdatePayload,
} from '../../main/ipcChannels'

async function call<T>(
  namespace: string,
  method: string,
  fn: () => Promise<IpcResult<T>>,
  args?: unknown,
): Promise<IpcResult<T>> {
  const channel = `${namespace}:${method}`
  devLog('info', channel, `→ ${method}`, args)
  try {
    const result = await fn()
    if (result.ok) {
      devLog('success', channel, `✓ ${method}`, result.data)
    } else {
      devLog('error', channel, `✗ ${method}: ${result.error}`)
    }
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    devLog('error', channel, `✗ ${method}: ${msg}`)
    return { ok: false, error: msg }
  }
}

// ── Cabinet ───────────────────────────────────────────────────────────────────

export const ipcCabinet = {
  create: (p: CabinetCreatePayload) =>
    call<CabinetInfo>('cabinet', 'create', () => window.cabinet.create(p), p),
  open: (path: string) =>
    call<CabinetInfo>('cabinet', 'open', () => window.cabinet.open(path), path),
  close: () =>
    call<null>('cabinet', 'close', () => window.cabinet.close()),
  current: () =>
    call<CabinetInfo | null>('cabinet', 'current', () => window.cabinet.current()),
  clone: (p: CabinetClonePayload) =>
    call<{ destPath: string }>('cabinet', 'clone', () => window.cabinet.clone(p), p),
  delete: (path: string) =>
    call<null>('cabinet', 'delete', () => window.cabinet.delete(path), path),
}

// ── Recent ────────────────────────────────────────────────────────────────────

export const ipcRecent = {
  list: () =>
    call<RecentCabinetInfo[]>('recent', 'list', () => window.recent.list()),
  remove: (path: string) =>
    call<null>('recent', 'remove', () => window.recent.remove(path), path),
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export const ipcDialog = {
  openFile: () =>
    call<string | null>('dialog', 'openFile', () => window.dialog.openFile()),
  saveFile: (name?: string) =>
    call<string | null>('dialog', 'saveFile', () => window.dialog.saveFile(name), name),
}

// ── Field ─────────────────────────────────────────────────────────────────────

export const ipcField = {
  list: () =>
    call<FieldInfo[]>('field', 'list', () => window.field.list()),
  listRecycled: () =>
    call<FieldInfo[]>('field', 'listRecycled', () => window.field.listRecycled()),
  create: (p: FieldCreatePayload) =>
    call<FieldInfo>('field', 'create', () => window.field.create(p), p),
  update: (p: FieldUpdatePayload) =>
    call<FieldInfo>('field', 'update', () => window.field.update(p), { id: p.id }),
  reorder: (p: FieldReorderPayload) =>
    call<null>('field', 'reorder', () => window.field.reorder(p), { count: p.orderedIds.length }),
  recycle: (id: string) =>
    call<null>('field', 'recycle', () => window.field.recycle(id), id),
  restore: (id: string) =>
    call<FieldInfo>('field', 'restore', () => window.field.restore(id), id),
  duplicate: (id: string) =>
    call<FieldInfo>('field', 'duplicate', () => window.field.duplicate(id), id),
}

// ── Record ────────────────────────────────────────────────────────────────────

export const ipcRecord = {
  list: () =>
    call<RecordInfo[]>('record', 'list', () => window.record.list()),
  listRecycled: () =>
    call<RecordInfo[]>('record', 'listRecycled', () => window.record.listRecycled()),
  draft: () =>
    call<RecordDraftInfo>('record', 'draft', () => window.record.draft()),
  save: (p: RecordSavePayload) =>
    call<RecordInfo>('record', 'save', () => window.record.save(p)),
  update: (p: RecordUpdatePayload) =>
    call<RecordInfo>('record', 'update', () => window.record.update(p), { id: p.id }),
  recycle: (id: string) =>
    call<null>('record', 'recycle', () => window.record.recycle(id), id),
  restore: (id: string) =>
    call<RecordInfo>('record', 'restore', () => window.record.restore(id), id),
  delete: (id: string) =>
    call<null>('record', 'delete', () => window.record.delete(id), id),
}
