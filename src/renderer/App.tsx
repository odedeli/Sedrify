import { useState, useEffect, useCallback, createContext, useContext } from "react";
import CabExplorer from "./modules/CabExplorer";
import CabDesigner from "./modules/CabDesigner";
import CabFeeder from "./modules/CabFeeder";
import CabFinder from "./modules/CabFinder";
import CabAnalyzer from "./modules/CabAnalyzer";
import Settings, { defaultSettings, type AppSettings } from "./modules/Settings";
import DevLog, { devLog } from "./components/DevLog";
import { ipcSettings, ipcCabinet, ipcField, ipcRecord } from "./lib/ipc";

devLog('info', 'app', 'Sedrify renderer started')

// ── Cross-module navigation context ──────────────────────────────────────────
// Allows CabFinder to navigate to Feeder and open a specific record.

export type ModuleId = "explorer" | "designer" | "feeder" | "finder" | "analyzer"

interface AppNav {
  navigateTo: (module: ModuleId, recordId?: string) => void
  openRecordId: string | null
  clearOpenRecord: () => void
}

export const AppNavContext = createContext<AppNav>({
  navigateTo: () => {},
  openRecordId: null,
  clearOpenRecord: () => {},
})

export function useAppNav() { return useContext(AppNavContext) }

// ── Cabinet status context ─────────────────────────────────────────────────────
// Shared live cabinet stats for status bar + sidebar badge.

interface CabinetStatus {
  name: string | null
  recordCount: number
  fieldCount: number
  refresh: () => void
}

export const CabinetStatusContext = createContext<CabinetStatus>({
  name: null, recordCount: 0, fieldCount: 0, refresh: () => {},
})

export function useCabinetStatus() { return useContext(CabinetStatusContext) }

// ── Module definitions ────────────────────────────────────────────────────────

const MODULES = [
  { id: "explorer" as ModuleId, shortLabel: "Explorer", label: "Cab Explorer", icon: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6h12"/><path d="M5 9h6M5 11.5h4" strokeLinecap="round"/>
    </svg>
  )},
  { id: "designer" as ModuleId, shortLabel: "Designer", label: "Cab Designer", icon: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3z"/><path d="M9 11h4M11 9v4" strokeLinecap="round"/>
    </svg>
  )},
  { id: "feeder" as ModuleId, shortLabel: "Feeder", label: "Cab Feeder", icon: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 5.5h12M2 9h12M5.5 5.5v8.5" strokeLinecap="round"/>
    </svg>
  )},
  { id: "finder" as ModuleId, shortLabel: "Finder", label: "Cab Finder", icon: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14" strokeLinecap="round"/>
    </svg>
  )},
  { id: "analyzer" as ModuleId, shortLabel: "Analyzer", label: "Cab Analyzer", icon: (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 13l4-5 3 3 3-6 3 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13h12" strokeLinecap="round"/>
    </svg>
  )},
]

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [activeModule, setActiveModule] = useState<ModuleId>("explorer")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  // Cross-module navigation
  const [openRecordId, setOpenRecordId] = useState<string | null>(null)

  // Live cabinet status
  const [cabinetName, setCabinetName] = useState<string | null>(null)
  const [recordCount, setRecordCount] = useState(0)
  const [fieldCount, setFieldCount] = useState(0)

  // ── Load settings on startup ───────────────────────────────────────────────

  useEffect(() => {
    ipcSettings.get().then(result => {
      if (result.ok && result.data) setSettings(result.data as AppSettings)
      setSettingsLoaded(true)
    })
  }, [])

  // ── Persist settings on change ─────────────────────────────────────────────

  useEffect(() => {
    if (!settingsLoaded) return
    ipcSettings.set(settings)
  }, [settings, settingsLoaded])

  // ── Live cabinet status ────────────────────────────────────────────────────

  const refreshCabinetStatus = useCallback(async () => {
    const current = await ipcCabinet.current()
    if (!current.ok || !current.data) {
      setCabinetName(null); setRecordCount(0); setFieldCount(0); return
    }
    setCabinetName(current.data.name)
    const [fields, records] = await Promise.all([ipcField.list(), ipcRecord.list()])
    if (fields.ok) setFieldCount(fields.data.length)
    if (records.ok) setRecordCount(records.data.length)
  }, [])

  useEffect(() => { refreshCabinetStatus() }, [refreshCabinetStatus])

  // ── Cross-module navigation ────────────────────────────────────────────────

  const navigateTo = useCallback((module: ModuleId, recordId?: string) => {
    setActiveModule(module)
    if (recordId) setOpenRecordId(recordId)
  }, [])

  const clearOpenRecord = useCallback(() => setOpenRecordId(null), [])

  const { theme, sidebarCollapsed, showStatusBar, autoSave } = settings

  function setSidebarCollapsed(v: boolean) {
    setSettings(s => ({ ...s, sidebarCollapsed: v }))
  }

  function renderModule() {
    switch (activeModule) {
      case "explorer":  return <CabExplorer settings={settings} onCabinetChange={refreshCabinetStatus} />
      case "designer":  return <CabDesigner />
      case "feeder":    return <CabFeeder settings={settings} onRecordsChange={refreshCabinetStatus} />
      case "finder":    return <CabFinder />
      case "analyzer":  return <CabAnalyzer />
    }
  }

  if (!settingsLoaded) return null

  const navValue: AppNav = { navigateTo, openRecordId, clearOpenRecord }
  const statusValue: CabinetStatus = { name: cabinetName, recordCount, fieldCount, refresh: refreshCabinetStatus }

  return (
    <AppNavContext.Provider value={navValue}>
    <CabinetStatusContext.Provider value={statusValue}>
    <div className={theme === "light" ? "light" : ""} style={{ height: "100%" }}>
      <div className="flex flex-col" style={{ height: "100%", backgroundColor: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Sidebar */}
          <aside className="flex flex-col shrink-0 transition-all duration-200" style={{
            width: sidebarCollapsed ? 48 : 200,
            backgroundColor: "var(--card)", borderRight: "1px solid var(--border)",
          }}>
            {/* Wordmark + collapse */}
            <div className="flex items-center shrink-0" style={{ height: 44, borderBottom: "1px solid var(--border)", padding: sidebarCollapsed ? "0 12px" : "0 14px", gap: 8 }}>
              {!sidebarCollapsed && <span className="font-semibold tracking-tight text-sm select-none" style={{ color: "var(--foreground)", letterSpacing: "-0.01em" }}>SEDRIFY</span>}
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="ml-auto flex items-center justify-center"
                style={{ width: 24, height: 24, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="1.5">
                  {sidebarCollapsed ? <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/> : <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round"/>}
                </svg>
              </button>
            </div>

            {/* Cabinet badge — live name */}
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 mx-3 my-2 px-2 py-1.5" style={{ borderRadius: "var(--radius)", backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: cabinetName ? "#4DE491" : "#656C7B" }}/>
                <span className="text-xs truncate" style={{ color: cabinetName ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: 500 }}>
                  {cabinetName ?? "No cabinet open"}
                </span>
              </div>
            )}

            {/* Nav */}
            <nav className="flex flex-col flex-1 overflow-y-auto py-1">
              {MODULES.map(mod => {
                const active = activeModule === mod.id
                return (
                  <button key={mod.id} onClick={() => setActiveModule(mod.id)}
                    className="flex items-center gap-2.5 text-left w-full"
                    title={sidebarCollapsed ? mod.label : undefined}
                    style={{
                      padding: "7px 14px", color: active ? "var(--primary)" : "var(--secondary-foreground)",
                      backgroundColor: active ? "var(--secondary)" : "transparent",
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderLeft: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                      fontSize: 13, fontWeight: active ? 500 : 400, fontFamily: "inherit", cursor: "pointer",
                    }}>
                    <span className="shrink-0">{mod.icon}</span>
                    {!sidebarCollapsed && <span className="truncate">{mod.shortLabel}</span>}
                  </button>
                )
              })}
            </nav>

            {/* Bottom: DevLog + Settings */}
            <div className="shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setLogOpen(o => !o)} className="flex items-center gap-2 w-full"
                title={sidebarCollapsed ? "DevLog" : undefined}
                style={{
                  height: 36, padding: "0 14px",
                  color: logOpen ? "#4DE491" : "var(--muted-foreground)",
                  backgroundColor: logOpen ? "#052312" : "transparent",
                  border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11,
                  fontWeight: logOpen ? 600 : 400,
                }}>
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="12" height="10" rx="1"/>
                  <path d="M5 6h6M5 8.5h4M5 11h3" strokeLinecap="round"/>
                </svg>
                {!sidebarCollapsed && <span>DevLog</span>}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 w-full"
                title={sidebarCollapsed ? "Settings" : undefined}
                style={{
                  height: 40, padding: "0 14px",
                  color: settingsOpen ? "var(--primary)" : "var(--muted-foreground)",
                  backgroundColor: settingsOpen ? "var(--secondary)" : "transparent",
                  border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                }}>
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="2.5"/>
                  <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" strokeLinecap="round"/>
                </svg>
                {!sidebarCollapsed && <span>Settings</span>}
              </button>
            </div>
          </aside>

          {/* Workspace */}
          <main className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
            {renderModule()}
          </main>
        </div>

        {/* Status bar — live counts */}
        {showStatusBar && (
          <div className="flex items-center shrink-0 gap-3" style={{ height: 24, padding: "0 14px", borderTop: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
            {cabinetName ? (
              <>
                <StatusItem label="Cabinet" value={cabinetName}/>
                <Divider/>
                <StatusItem label="Records" value={String(recordCount)}/>
                <Divider/>
                <StatusItem label="Fields" value={String(fieldCount)}/>
              </>
            ) : (
              <span className="font-mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>No cabinet open</span>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="inline-block rounded-full" style={{ width: 5, height: 5, backgroundColor: cabinetName ? "#4DE491" : "#656C7B" }}/>
              <span className="font-mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {autoSave === "off" ? "Auto-save off" : `Auto-save every ${autoSave}m`}
              </span>
            </div>
          </div>
        )}
      </div>

      {settingsOpen && (
        <Settings settings={settings} setSettings={setSettings} onClose={() => setSettingsOpen(false)}/>
      )}
      {logOpen && <DevLog onClose={() => setLogOpen(false)}/>}
    </div>
    </CabinetStatusContext.Provider>
    </AppNavContext.Provider>
  )
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</span>
      <span className="font-mono" style={{ fontSize: 11, color: "var(--foreground)" }}>{value}</span>
    </div>
  )
}
function Divider() {
  return <span style={{ width: 1, height: 10, backgroundColor: "var(--border)", display: "inline-block" }}/>
}
