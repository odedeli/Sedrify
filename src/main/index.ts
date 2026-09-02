import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { copyFileSync, unlinkSync, existsSync, statSync, appendFileSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { CabinetEngine } from '../../foundation/cabinet/CabinetEngine'
import { RecentCabinetsService } from '../../foundation/cabinet/RecentCabinetsService'
import { FieldRepository } from '../../foundation/fields/FieldRepository'
import { FieldTypeRegistry } from '../../foundation/fields/FieldTypeRegistry'
import { RecordRepository } from '../../foundation/records/RecordRepository'
import { registerSettingsHandlers } from './settings-handlers'
import type { FieldEntity } from '../../foundation/contracts/IFieldRepository'
import type { RecordEntity } from '../../foundation/contracts/IRecordRepository'
import {
  IPC,
  type IpcResult,
  type CabinetInfo, type RecentCabinetInfo,
  type CabinetCreatePayload, type CabinetClonePayload,
  type FieldInfo, type FieldCreatePayload, type FieldUpdatePayload, type FieldReorderPayload,
  type RecordInfo, type RecordDraftInfo, type RecordSavePayload, type RecordUpdatePayload,
} from './ipcChannels'

// ── Logger ────────────────────────────────────────────────────────────────────

const logDir = join(app.getPath('userData'), 'logs')
const logFile = join(logDir, 'sedrify-main.log')

function log(level: string, message: string, data?: unknown) {
  try {
    mkdirSync(logDir, { recursive: true })
    const line = `[${new Date().toISOString()}] [${level}] ${message}${data !== undefined ? ' ' + JSON.stringify(data, null, 0) : ''}\n`
    appendFileSync(logFile, line)
    console.log(line.trim())
  } catch { /* ignore */ }
}

log('INFO', 'Main process starting', { logFile })

// ── Foundation instances ──────────────────────────────────────────────────────

let cabinetEngine: CabinetEngine
let recentService: RecentCabinetsService
const fieldTypeRegistry = new FieldTypeRegistry()

try {
  cabinetEngine = new CabinetEngine()
  const recentPath = join(app.getPath('userData'), 'recent.json')
  recentService = new RecentCabinetsService(recentPath)
  log('INFO', 'Foundation initialised', { recentPath })
} catch (err) {
  log('ERROR', 'Foundation init failed', err instanceof Error ? err.message : String(err))
  throw err
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok<T>(data: T): IpcResult<T> { return { ok: true, data } }

function fail<T>(error: unknown): IpcResult<T> {
  const message = error instanceof Error ? error.message : String(error)
  log('ERROR', 'IPC handler error', message)
  return { ok: false, error: message } as IpcResult<T>
}

function metaToCabinetInfo(meta: {
  id: string; name: string; path: string
  schemaVersion: number; createdAt: string; updatedAt: string
}): CabinetInfo {
  return { id: meta.id, name: meta.name, path: meta.path, schemaVersion: meta.schemaVersion, createdAt: meta.createdAt, updatedAt: meta.updatedAt }
}

function entityToFieldInfo(e: FieldEntity): FieldInfo {
  return {
    id: e.id, collectionId: e.collectionId, name: e.name,
    type: e.fieldType as FieldInfo['type'], required: e.required, isPrimary: e.isPrimary,
    description: e.description, defaultValue: e.defaultValue ?? '',
    displayOrder: e.displayOrder,
    options: e.config as Record<string, string | number | boolean | string[]>,
    recycled: e.recycled, createdAt: e.createdAt, updatedAt: e.updatedAt,
  }
}

function entityToRecordInfo(e: RecordEntity): RecordInfo {
  const values: Record<string, string | number | null> = {}
  for (const [k, v] of Object.entries(e.values)) {
    if (v instanceof Uint8Array) values[k] = '[blob]'
    else values[k] = v as string | number | null
  }
  return {
    id: e.id, collectionId: e.collectionId, sequence: e.sequence,
    recycled: e.recycled, recycledAt: e.recycledAt,
    createdAt: e.createdAt, updatedAt: e.updatedAt, values,
  }
}

function getFieldRepo(): FieldRepository {
  return new FieldRepository(cabinetEngine.getDb(), fieldTypeRegistry)
}

function getRecordRepo(): RecordRepository {
  const db = cabinetEngine.getDb()
  return new RecordRepository(db, new FieldRepository(db, fieldTypeRegistry))
}

function getCollectionId(): string {
  const db = cabinetEngine.getDb()
  const row = db.prepare('SELECT id FROM collections LIMIT 1').get() as { id: string } | undefined
  if (!row) throw new Error('No collection found in cabinet')
  return row.id
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {

  registerSettingsHandlers()

  // ── Cabinet ────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.CABINET_CREATE, async (_event, payload: CabinetCreatePayload) => {
    log('INFO', 'cabinet:create', payload)
    try {
      const meta = await cabinetEngine.create({ path: payload.path, name: payload.name })
      await recentService.add({ path: meta.path, name: meta.name, lastOpenedAt: new Date().toISOString() })
      log('INFO', 'cabinet:create success', meta.path)
      return ok(metaToCabinetInfo(meta))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.CABINET_OPEN, async (_event, path: string) => {
    log('INFO', 'cabinet:open', path)
    try {
      const result = await cabinetEngine.open(path)
      await recentService.add({ path: result.meta.path, name: result.meta.name, lastOpenedAt: new Date().toISOString() })
      log('INFO', 'cabinet:open success', result.meta.name)
      return ok(metaToCabinetInfo(result.meta))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.CABINET_CLOSE, async () => {
    try { await cabinetEngine.close(); return ok(null) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.CABINET_CURRENT, () => {
    const meta = cabinetEngine.currentCabinet()
    return ok(meta ? metaToCabinetInfo(meta) : null)
  })

  ipcMain.handle(IPC.CABINET_FILE_SIZE, (): IpcResult<number> => {
    try {
      const meta = cabinetEngine.currentCabinet()
      if (!meta) return ok(0)
      const stat = statSync(meta.path)
      return ok(stat.size)
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.CABINET_CLONE, async (_event, payload: CabinetClonePayload) => {
    try {
      if (!existsSync(payload.sourcePath)) throw new Error(`Source cabinet not found: ${payload.sourcePath}`)
      if (existsSync(payload.destPath)) throw new Error(`A file already exists at destination: ${payload.destPath}`)
      copyFileSync(payload.sourcePath, payload.destPath)
      return ok({ destPath: payload.destPath })
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.CABINET_DELETE, async (_event, path: string) => {
    try {
      const current = cabinetEngine.currentCabinet()
      if (current?.path === path) await cabinetEngine.close()
      if (existsSync(path)) unlinkSync(path)
      await recentService.remove(path)
      return ok(null)
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECENT_LIST, async (): Promise<IpcResult<RecentCabinetInfo[]>> => {
    try {
      const entries = await recentService.list()
      return ok(entries.map(e => ({ path: e.path, name: e.name, lastOpenedAt: e.lastOpenedAt })))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECENT_REMOVE, async (_event, path: string) => {
    try { await recentService.remove(path); return ok(null) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      title: 'Open Cabinet',
      filters: [{ name: 'Sedrify Cabinet', extensions: ['cabinet'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return ok(null)
    return ok(result.filePaths[0])
  })

  ipcMain.handle(IPC.DIALOG_SAVE_FILE, async (event, defaultName?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win!, {
      title: 'New Cabinet',
      defaultPath: defaultName ?? 'my-cabinet.cabinet',
      filters: [{ name: 'Sedrify Cabinet', extensions: ['cabinet'] }],
    })
    if (result.canceled || !result.filePath) return ok(null)
    return ok(result.filePath)
  })

  // ── Field ──────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.FIELD_LIST, async (): Promise<IpcResult<FieldInfo[]>> => {
    try {
      return ok((await getFieldRepo().list(getCollectionId())).map(entityToFieldInfo))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_LIST_RECYCLED, async (): Promise<IpcResult<FieldInfo[]>> => {
    try {
      return ok((await getFieldRepo().listRecycled(getCollectionId())).map(entityToFieldInfo))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_CREATE, async (_event, payload: FieldCreatePayload): Promise<IpcResult<FieldInfo>> => {
    log('INFO', 'field:create', { name: payload.name, type: payload.type })
    try {
      const repo = getFieldRepo(); const colId = getCollectionId()
      if (payload.isPrimary) {
        const existing = await repo.list(colId)
        const cur = existing.find(f => f.isPrimary)
        if (cur) await repo.update(cur.id, { isPrimary: false })
      }
      const e = await repo.create({
        collectionId: colId, name: payload.name, fieldType: payload.type,
        required: payload.required, isPrimary: payload.isPrimary,
        description: payload.description, defaultValue: payload.defaultValue || null,
        config: payload.options ?? {},
      })
      return ok(entityToFieldInfo(e))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_UPDATE, async (_event, payload: FieldUpdatePayload): Promise<IpcResult<FieldInfo>> => {
    log('INFO', 'field:update', { id: payload.id })
    try {
      const repo = getFieldRepo(); const colId = getCollectionId()
      if (payload.isPrimary === true) {
        const existing = await repo.list(colId)
        const cur = existing.find(f => f.isPrimary && f.id !== payload.id)
        if (cur) await repo.update(cur.id, { isPrimary: false })
      }
      const e = await repo.update(payload.id, {
        name: payload.name, fieldType: payload.type, required: payload.required,
        isPrimary: payload.isPrimary, description: payload.description,
        defaultValue: payload.defaultValue !== undefined ? (payload.defaultValue || null) : undefined,
        config: payload.options,
      })
      return ok(entityToFieldInfo(e))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_REORDER, async (_event, payload: FieldReorderPayload): Promise<IpcResult<null>> => {
    try { await getFieldRepo().reorder(getCollectionId(), payload.orderedIds); return ok(null) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_RECYCLE, async (_event, id: string): Promise<IpcResult<null>> => {
    try { await getFieldRepo().recycle(id); return ok(null) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_RESTORE, async (_event, id: string): Promise<IpcResult<FieldInfo>> => {
    try { return ok(entityToFieldInfo(await getFieldRepo().restore(id))) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_DUPLICATE, async (_event, id: string): Promise<IpcResult<FieldInfo>> => {
    try {
      const repo = getFieldRepo(); const colId = getCollectionId()
      const source = await repo.get(id)
      if (!source) throw new Error(`Field not found: ${id}`)
      const e = await repo.create({
        collectionId: colId, name: `${source.name} (copy)`, fieldType: source.fieldType,
        required: source.required, isPrimary: false,
        description: source.description, defaultValue: source.defaultValue,
        config: { ...source.config },
      })
      return ok(entityToFieldInfo(e))
    } catch (err) { return fail(err) }
  })

  // ── Record ─────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.RECORD_LIST, async (): Promise<IpcResult<RecordInfo[]>> => {
    try { return ok((await getRecordRepo().list(getCollectionId())).map(entityToRecordInfo)) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECORD_LIST_RECYCLED, async (): Promise<IpcResult<RecordInfo[]>> => {
    try { return ok((await getRecordRepo().listRecycled(getCollectionId())).map(entityToRecordInfo)) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECORD_DRAFT, async (): Promise<IpcResult<RecordDraftInfo>> => {
    try {
      const draft = await getRecordRepo().draft(getCollectionId())
      const values: Record<string, string | number | null> = {}
      for (const [k, v] of Object.entries(draft.values)) {
        values[k] = v instanceof Uint8Array ? null : v as string | number | null
      }
      return ok({ collectionId: draft.collectionId, values })
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECORD_SAVE, async (_event, payload: RecordSavePayload): Promise<IpcResult<RecordInfo>> => {
    log('INFO', 'record:save')
    try {
      const r = await getRecordRepo().save({ collectionId: getCollectionId(), values: payload.values })
      return ok(entityToRecordInfo(r))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECORD_UPDATE, async (_event, payload: RecordUpdatePayload): Promise<IpcResult<RecordInfo>> => {
    try { return ok(entityToRecordInfo(await getRecordRepo().update(payload.id, { values: payload.values }))) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECORD_RECYCLE, async (_event, id: string): Promise<IpcResult<null>> => {
    try { await getRecordRepo().recycle(id); return ok(null) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECORD_RESTORE, async (_event, id: string): Promise<IpcResult<RecordInfo>> => {
    try { return ok(entityToRecordInfo(await getRecordRepo().restore(id))) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.RECORD_DELETE, async (_event, id: string): Promise<IpcResult<null>> => {
    try {
      const db = cabinetEngine.getDb()
      db.prepare('DELETE FROM record_values WHERE record_id = ?').run(id)
      db.prepare('DELETE FROM records WHERE id = ?').run(id)
      return ok(null)
    } catch (err) { return fail(err) }
  })

  log('INFO', 'IPC handlers registered (cabinet + field + record + settings)')
}

// ── Window ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    show: false, autoHideMenuBar: true, title: 'Sedrify',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false },
  })
  mainWindow.on('ready-to-show', () => { mainWindow?.show(); log('INFO', 'Window shown') })
  mainWindow.webContents.setWindowOpenHandler((details) => { shell.openExternal(details.url); return { action: 'deny' } })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cabinetEngine.close().finally(() => { log('INFO', 'App quitting'); app.quit() })
  }
})
