import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { copyFileSync, unlinkSync, existsSync, appendFileSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { CabinetEngine } from '../../foundation/cabinet/CabinetEngine'
import { RecentCabinetsService } from '../../foundation/cabinet/RecentCabinetsService'
import {
  IPC,
  type IpcResult,
  type CabinetInfo,
  type RecentCabinetInfo,
  type CabinetCreatePayload,
  type CabinetClonePayload,
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
  } catch { /* ignore log errors */ }
}

log('INFO', 'Main process starting', { logFile })

// ── Foundation instances ──────────────────────────────────────────────────────

let cabinetEngine: CabinetEngine
let recentService: RecentCabinetsService

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

function metaToInfo(meta: { id: string; name: string; path: string; schemaVersion: number; createdAt: string; updatedAt: string }): CabinetInfo {
  return {
    id: meta.id,
    name: meta.name,
    path: meta.path,
    schemaVersion: meta.schemaVersion,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.CABINET_CREATE, async (_event, payload: CabinetCreatePayload) => {
    log('INFO', 'cabinet:create', payload)
    try {
      const meta = await cabinetEngine.create({ path: payload.path, name: payload.name })
      await recentService.add({ path: meta.path, name: meta.name, lastOpenedAt: new Date().toISOString() })
      log('INFO', 'cabinet:create success', meta.path)
      return ok(metaToInfo(meta))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IPC.CABINET_OPEN, async (_event, path: string) => {
    log('INFO', 'cabinet:open', path)
    try {
      const result = await cabinetEngine.open(path)
      await recentService.add({ path: result.meta.path, name: result.meta.name, lastOpenedAt: new Date().toISOString() })
      log('INFO', 'cabinet:open success', result.meta.name)
      return ok(metaToInfo(result.meta))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IPC.CABINET_CLOSE, async () => {
    log('INFO', 'cabinet:close')
    try {
      await cabinetEngine.close()
      return ok(null)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IPC.CABINET_CURRENT, () => {
    const meta = cabinetEngine.currentCabinet()
    return ok(meta ? metaToInfo(meta) : null)
  })

  ipcMain.handle(IPC.CABINET_CLONE, async (_event, payload: CabinetClonePayload) => {
    log('INFO', 'cabinet:clone', payload)
    try {
      if (!existsSync(payload.sourcePath)) throw new Error(`Source cabinet not found: ${payload.sourcePath}`)
      if (existsSync(payload.destPath)) throw new Error(`A file already exists at destination: ${payload.destPath}`)
      copyFileSync(payload.sourcePath, payload.destPath)
      return ok({ destPath: payload.destPath })
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IPC.CABINET_DELETE, async (_event, path: string) => {
    log('INFO', 'cabinet:delete', path)
    try {
      const current = cabinetEngine.currentCabinet()
      if (current?.path === path) await cabinetEngine.close()
      if (existsSync(path)) unlinkSync(path)
      await recentService.remove(path)
      return ok(null)
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IPC.RECENT_LIST, async (): Promise<IpcResult<RecentCabinetInfo[]>> => {
    try {
      const entries = await recentService.list()
      return ok(entries.map(e => ({ path: e.path, name: e.name, lastOpenedAt: e.lastOpenedAt })))
    } catch (err) {
      return fail(err)
    }
  })

  ipcMain.handle(IPC.RECENT_REMOVE, async (_event, path: string) => {
    try {
      await recentService.remove(path)
      return ok(null)
    } catch (err) {
      return fail(err)
    }
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

  log('INFO', 'IPC handlers registered')
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
