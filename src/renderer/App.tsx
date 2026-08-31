import { useState } from "react";
import CabExplorer from "./modules/CabExplorer";
import CabDesigner from "./modules/CabDesigner";
import CabFeeder from "./modules/CabFeeder";
import CabFinder from "./modules/CabFinder";
import CabAnalyzer from "./modules/CabAnalyzer";
import Settings, { defaultSettings, type AppSettings } from "./modules/Settings";

type ModuleId = "explorer" | "designer" | "feeder" | "finder" | "analyzer";

interface Module {
  id: ModuleId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const MODULES: Module[] = [
  {
    id: "explorer",
    shortLabel: "Explorer",
    label: "Cab Explorer",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="12" height="10" rx="1" />
        <path d="M2 6h12" />
        <path d="M5 9h6M5 11.5h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "designer",
    shortLabel: "Designer",
    label: "Cab Designer",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3z" />
        <path d="M9 11h4M11 9v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "feeder",
    shortLabel: "Feeder",
    label: "Cab Feeder",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="12" height="12" rx="1" />
        <path d="M2 5.5h12M2 9h12M5.5 5.5v8.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "finder",
    shortLabel: "Finder",
    label: "Cab Finder",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "analyzer",
    shortLabel: "Analyzer",
    label: "Cab Analyzer",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 13l4-5 3 3 3-6 3 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 13h12" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeModule, setActiveModule] = useState<ModuleId>("feeder");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { theme, sidebarCollapsed, showStatusBar } = settings;

  function setSidebarCollapsed(v: boolean) {
    setSettings((s) => ({ ...s, sidebarCollapsed: v }));
  }

  function renderModule() {
    switch (activeModule) {
      case "explorer":  return <CabExplorer />;
      case "designer":  return <CabDesigner />;
      case "feeder":    return <CabFeeder />;
      case "finder":    return <CabFinder />;
      case "analyzer":  return <CabAnalyzer />;
    }
  }

  return (
    <div className={theme === "light" ? "light" : ""} style={{ height: "100%" }}>
      <div
        className="flex flex-col"
        style={{ height: "100%", backgroundColor: "var(--background)", color: "var(--foreground)" }}
      >
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Sidebar */}
          <aside
            className="flex flex-col shrink-0 transition-all duration-200"
            style={{
              width: sidebarCollapsed ? 48 : 200,
              backgroundColor: "var(--card)",
              borderRight: "1px solid var(--border)",
            }}
          >
            {/* Wordmark */}
            <div
              className="flex items-center shrink-0"
              style={{
                height: 44,
                borderBottom: "1px solid var(--border)",
                padding: sidebarCollapsed ? "0 12px" : "0 14px",
                gap: 8,
              }}
            >
              {!sidebarCollapsed && (
                <span
                  className="font-semibold tracking-tight text-sm select-none"
                  style={{ color: "var(--foreground)", letterSpacing: "-0.01em" }}
                >
                  SEDRIFY
                </span>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="ml-auto flex items-center justify-center"
                style={{ width: 24, height: 24, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="1.5">
                  {sidebarCollapsed
                    ? <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                    : <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
                  }
                </svg>
              </button>
            </div>

            {/* Cabinet badge */}
            {!sidebarCollapsed && (
              <div
                className="flex items-center gap-2 mx-3 my-2 px-2 py-1.5"
                style={{
                  borderRadius: "var(--radius)",
                  backgroundColor: "var(--secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  className="inline-block rounded-full shrink-0"
                  style={{ width: 6, height: 6, backgroundColor: "#4DE491" }}
                />
                <span className="text-xs truncate" style={{ color: "var(--foreground)", fontWeight: 500 }}>
                  Film Collection
                </span>
              </div>
            )}

            {/* Nav */}
            <nav className="flex flex-col flex-1 overflow-y-auto py-1">
              {MODULES.map((mod) => {
                const active = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveModule(mod.id)}
                    className="flex items-center gap-2.5 text-left w-full"
                    style={{
                      padding: "7px 14px",
                      color: active ? "var(--primary)" : "var(--secondary-foreground)",
                      backgroundColor: active ? "var(--secondary)" : "transparent",
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: "none",
                      borderLeft: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                    title={sidebarCollapsed ? mod.label : undefined}
                  >
                    <span className="shrink-0">{mod.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="truncate">{mod.shortLabel}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Settings button */}
            <div className="shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2 w-full"
                style={{
                  height: 40,
                  padding: "0 14px",
                  color: settingsOpen ? "var(--primary)" : "var(--muted-foreground)",
                  backgroundColor: settingsOpen ? "var(--secondary)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: settingsOpen ? 500 : 400,
                }}
                title={sidebarCollapsed ? "Settings" : undefined}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="2.5" />
                  <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" strokeLinecap="round" />
                </svg>
                {!sidebarCollapsed && <span>Settings</span>}
              </button>
            </div>
          </aside>

          {/* Module workspace */}
          <main className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
            {renderModule()}
          </main>
        </div>

        {/* Status bar */}
        {showStatusBar && (
          <div
            className="flex items-center shrink-0 gap-3"
            style={{
              height: 24,
              padding: "0 14px",
              borderTop: "1px solid var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <StatusItem label="Cabinet" value="Film Collection" />
            <Divider />
            <StatusItem label="Records" value="10" />
            <Divider />
            <StatusItem label="Fields" value="8" />
            <Divider />
            <div className="flex items-center gap-1.5 ml-auto">
              <span
                className="inline-block rounded-full"
                style={{ width: 5, height: 5, backgroundColor: "#4DE491" }}
              />
              <span className="font-mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {settings.autoSave === "off" ? "Auto-save off" : `Auto-save every ${settings.autoSave}m`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Settings drawer */}
      {settingsOpen && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</span>
      <span className="font-mono" style={{ fontSize: 11, color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return (
    <span style={{ width: 1, height: 10, backgroundColor: "var(--border)", display: "inline-block" }} />
  );
}
