// ── Settings additions for ipcChannels.ts ────────────────────────────────────
// Add these to the IPC object and export them alongside existing channels.

export const SETTINGS_IPC = {
  SETTINGS_GET:   'settings:get',
  SETTINGS_SET:   'settings:set',
  SETTINGS_RESET: 'settings:reset',
} as const

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
