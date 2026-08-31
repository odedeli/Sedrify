import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Expose electron APIs to renderer via context bridge.
// Foundation IPC channels will be added here in Sprint F-1.
contextBridge.exposeInMainWorld('electron', electronAPI)
