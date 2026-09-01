import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { copyFileSync, unlinkSync, existsSync, appendFileSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { CabinetEngine } from '../../foundation/cabinet/CabinetEngine'
import { RecentCabinetsService } from '../../foundation/cabinet/RecentCabinetsService'
import { FieldRepository } from '../../foundation/fields/FieldRepository'
import { FieldTypeRegistry } from '../../foundation/fields/FieldTypeRegistry'
import type { FieldEntity } from '../../foundation/contracts/IFieldRepository'
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

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail<T>(error: unknown): IpcResult<T> {
  const message = error instanceof Error ? error.message : String(error)
  log('ERROR', 'IPC handler error', message)
  return { ok: false, error: message } as IpcResult<T>
}

function metaToCabinetInfo(meta: {
  id: string; name: string; path: string
  schemaVersion: number; createdAt: string; updatedAt: string
}): CabinetInfo {
  return {
    id: meta.id, name: meta.name, path: meta.path,
    schemaVersion: meta.schemaVersion,
    createdAt: meta.createdAt, updatedAt: meta.updatedAt,
  }
}

function entityToFieldInfo(e: FieldEntity): FieldInfo {
  return {
    id: e.id,
    collectionId: e.collectionId,
    name: e.name,
    type: e.fieldType as FieldInfo['type'],
    required: e.required,
    isPrimary: e.isPrimary,
    description: e.description,
    defaultValue: e.defaultValue ?? '',
    displayOrder: e.displayOrder,
    options: e.config as Record<string, string | number | boolean | string[]>,
    recycled: e.recycled,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

/** Get FieldRepository for the currently open cabinet. Throws if none open. */
function getFieldRepo(): FieldRepository {
  const db = cabinetEngine.getDb()
  return new FieldRepository(db, fieldTypeRegistry)
}

/** Get the default collection ID from the open cabinet. */
function getCollectionId(): string {
  const db = cabinetEngine.getDb()
  const row = db.prepare('SELECT id FROM collections LIMIT 1').get() as { id: string } | undefined
  if (!row) throw new Error('No collection found in cabinet')
  return row.id
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {

  // ── Cabinet handlers (M-1) ─────────────────────────────────────────────────

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
    log('INFO', 'cabinet:close')
    try { await cabinetEngine.close(); return ok(null) }
    catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.CABINET_CURRENT, () => {
    const meta = cabinetEngine.currentCabinet()
    return ok(meta ? metaToCabinetInfo(meta) : null)
  })

  ipcMain.handle(IPC.CABINET_CLONE, async (_event, payload: CabinetClonePayload) => {
    log('INFO', 'cabinet:clone', payload)
    try {
      if (!existsSync(payload.sourcePath)) throw new Error(`Source cabinet not found: ${payload.sourcePath}`)
      if (existsSync(payload.destPath)) throw new Error(`A file already exists at destination: ${payload.destPath}`)
      copyFileSync(payload.sourcePath, payload.destPath)
      return ok({ destPath: payload.destPath })
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.CABINET_DELETE, async (_event, path: string) => {
    log('INFO', 'cabinet:delete', path)
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

  // ── Field handlers (M-2) ───────────────────────────────────────────────────

  ipcMain.handle(IPC.FIELD_LIST, async (): Promise<IpcResult<FieldInfo[]>> => {
    try {
      const repo = getFieldRepo()
      const collectionId = getCollectionId()
      const fields = await repo.list(collectionId)
      return ok(fields.map(entityToFieldInfo))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_LIST_RECYCLED, async (): Promise<IpcResult<FieldInfo[]>> => {
    try {
      const repo = getFieldRepo()
      const collectionId = getCollectionId()
      const fields = await repo.listRecycled(collectionId)
      return ok(fields.map(entityToFieldInfo))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_CREATE, async (_event, payload: FieldCreatePayload): Promise<IpcResult<FieldInfo>> => {
    log('INFO', 'field:create', { name: payload.name, type: payload.type })
    try {
      const repo = getFieldRepo()
      const collectionId = getCollectionId()

      // FR-FLD-006: if setting as primary, clear existing primary first
      if (payload.isPrimary) {
        const existing = await repo.list(collectionId)
        const currentPrimary = existing.find(f => f.isPrimary)
        if (currentPrimary) {
          await repo.update(currentPrimary.id, { isPrimary: false })
        }
      }

      const entity = await repo.create({
        collectionId,
        name: payload.name,
        fieldType: payload.type,
        required: payload.required,
        isPrimary: payload.isPrimary,
        description: payload.description,
        defaultValue: payload.defaultValue || null,
        config: payload.options ?? {},
      })
      log('INFO', 'field:create success', entity.id)
      return ok(entityToFieldInfo(entity))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_UPDATE, async (_event, payload: FieldUpdatePayload): Promise<IpcResult<FieldInfo>> => {
    log('INFO', 'field:update', { id: payload.id })
    try {
      const repo = getFieldRepo()
      const collectionId = getCollectionId()

      // FR-FLD-006: if setting as primary, clear existing primary first
      if (payload.isPrimary === true) {
        const existing = await repo.list(collectionId)
        const currentPrimary = existing.find(f => f.isPrimary && f.id !== payload.id)
        if (currentPrimary) {
          await repo.update(currentPrimary.id, { isPrimary: false })
        }
      }

      const entity = await repo.update(payload.id, {
        name: payload.name,
        fieldType: payload.type,
        required: payload.required,
        isPrimary: payload.isPrimary,
        description: payload.description,
        defaultValue: payload.defaultValue !== undefined ? (payload.defaultValue || null) : undefined,
        config: payload.options,
      })
      return ok(entityToFieldInfo(entity))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_REORDER, async (_event, payload: FieldReorderPayload): Promise<IpcResult<null>> => {
    log('INFO', 'field:reorder', { count: payload.orderedIds.length })
    try {
      const repo = getFieldRepo()
      const collectionId = getCollectionId()
      await repo.reorder(collectionId, payload.orderedIds)
      return ok(null)
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_RECYCLE, async (_event, id: string): Promise<IpcResult<null>> => {
    log('INFO', 'field:recycle', id)
    try {
      const repo = getFieldRepo()
      await repo.recycle(id)
      return ok(null)
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_RESTORE, async (_event, id: string): Promise<IpcResult<FieldInfo>> => {
    log('INFO', 'field:restore', id)
    try {
      const repo = getFieldRepo()
      const entity = await repo.restore(id)
      return ok(entityToFieldInfo(entity))
    } catch (err) { return fail(err) }
  })

  ipcMain.handle(IPC.FIELD_DUPLICATE, async (_event, id: string): Promise<IpcResult<FieldInfo>> => {
    log('INFO', 'field:duplicate', id)
    try {
      const repo = getFieldRepo()
      const collectionId = getCollectionId()

      // Get the source field
      const source = await repo.get(id)
      if (!source) throw new Error(`Field not found: ${id}`)

      // Create a copy with modified name
      const copyName = `${source.name} (copy)`
      const entity = await repo.create({
        collectionId,
        name: copyName,
        fieldType: source.fieldType,
        required: source.required,
        isPrimary: false, // copy is never primary
        description: source.description,
        defaultValue: source.defaultValue,
        config: { ...source.config },
      })
      log('INFO', 'field:duplicate success', { from: id, to: entity.id })
      return ok(entityToFieldInfo(entity))
    } catch (err) { return fail(err) }
  })

  log('INFO', 'IPC handlers registered (cabinet + field)')
}

// ── Window ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Sedrify',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    log('INFO', 'Window shown')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cabinetEngine.close().finally(() => {
      log('INFO', 'App quitting')
      app.quit()
    })
  }
})
