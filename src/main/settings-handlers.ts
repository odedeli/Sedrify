// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — Settings IPC Handlers
// Persists AppSettings to ~/.config/sedrify/settings.json
// Import and call registerSettingsHandlers() from main/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import { ipcMain, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

export const SETTINGS_GET   = 'settings:get'
export const SETTINGS_SET   = 'settings:set'
export const SETTINGS_RESET = 'settings:reset'

export interface AppSettingsData {
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  compactRows: boolean
  dateFormat: 'iso' | 'dmy' | 'mdy'
  decimalSep: '.' | ','
  thousandsSep: 'none' | ',' | '.' | ' '
  autoSave: 'off' | '1' | '5' | '10'
  confirmDelete: boolean
  recycleBinRetention: 'forever' | '30' | '90'
  defaultPath: string
  showStatusBar: boolean
}

export const DEFAULT_SETTINGS: AppSettingsData = {
  theme: 'dark',
  sidebarCollapsed: false,
  compactRows: false,
  dateFormat: 'iso',
  decimalSep: '.',
  thousandsSep: 'none',
  autoSave: '5',
  confirmDelete: true,
  recycleBinRetention: 'forever',
  defaultPath: '~/Documents/cabinets',
  showStatusBar: true,
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettingsData {
  const path = getSettingsPath()
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS }
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw)
    // Merge with defaults so new keys always have values
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: AppSettingsData): void {
  const path = getSettingsPath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(SETTINGS_GET, () => {
    return { ok: true, data: loadSettings() }
  })

  ipcMain.handle(SETTINGS_SET, (_event, settings: AppSettingsData) => {
    try {
      saveSettings(settings)
      return { ok: true, data: settings }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(SETTINGS_RESET, () => {
    try {
      saveSettings(DEFAULT_SETTINGS)
      return { ok: true, data: DEFAULT_SETTINGS }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
