import { useState } from "react";

export interface AppSettings {
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
  compactRows: boolean;
  dateFormat: "iso" | "dmy" | "mdy";
  decimalSep: "." | ",";
  thousandsSep: "none" | "," | "." | " ";
  autoSave: "off" | "1" | "5" | "10";
  confirmDelete: boolean;
  recycleBinRetention: "forever" | "30" | "90";
  defaultPath: string;
  showStatusBar: boolean;
}

export const defaultSettings: AppSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  compactRows: false,
  dateFormat: "iso",
  decimalSep: ".",
  thousandsSep: "none",
  autoSave: "5",
  confirmDelete: true,
  recycleBinRetention: "forever",
  defaultPath: "~/Documents/cabinets",
  showStatusBar: true,
};

interface Props {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  onClose: () => void;
}

export default function Settings({ settings, setSettings, onClose }: Props) {
  function patch(partial: Partial<AppSettings>) {
    setSettings({ ...settings, ...partial });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 201,
          width: 340,
          backgroundColor: "var(--card)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center shrink-0 px-5"
          style={{ height: 52, borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2.5">
            <GearIcon />
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto"
            style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
            title="Close settings"
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0 24px" }}>

          {/* ── Appearance ── */}
          <Section label="Appearance">
            {/* Theme */}
            <SettingRow label="Theme" hint="Sets the global colour scheme">
              <SegmentedControl
                value={settings.theme}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                onChange={(v) => patch({ theme: v as "dark" | "light" })}
              />
            </SettingRow>

            {/* Sidebar */}
            <SettingRow label="Sidebar" hint="Show labels next to nav icons">
              <SegmentedControl
                value={settings.sidebarCollapsed ? "icons" : "labels"}
                options={[
                  { value: "labels", label: "Labels" },
                  { value: "icons", label: "Icons only" },
                ]}
                onChange={(v) => patch({ sidebarCollapsed: v === "icons" })}
              />
            </SettingRow>

            {/* Compact rows */}
            <SettingRow label="Compact rows" hint="Tighter row height in table views">
              <Toggle checked={settings.compactRows} onChange={(v) => patch({ compactRows: v })} />
            </SettingRow>

            {/* Status bar */}
            <SettingRow label="Status bar" hint="Show cabinet info at the bottom">
              <Toggle checked={settings.showStatusBar} onChange={(v) => patch({ showStatusBar: v })} />
            </SettingRow>

            {/* Accent swatch — info only */}
            <SettingRow label="Accent colour" hint="Ambersky Cobalt-600 — fixed in v0.1">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    display: "inline-block",
                    width: 20,
                    height: 20,
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--primary)",
                    border: "1px solid var(--border)",
                  }}
                />
                <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                  #3757EB
                </span>
              </div>
            </SettingRow>
          </Section>

          {/* ── Cabinet Defaults ── */}
          <Section label="Cabinet Defaults">
            <SettingRow label="Default save path" hint="Used for new cabinet creation">
              <input
                type="text"
                value={settings.defaultPath}
                onChange={(e) => patch({ defaultPath: e.target.value })}
                style={inputStyle}
              />
            </SettingRow>

            <SettingRow label="Auto-save" hint="Interval between automatic saves">
              <Select
                value={settings.autoSave}
                options={[
                  { value: "off", label: "Off" },
                  { value: "1", label: "Every 1 min" },
                  { value: "5", label: "Every 5 min" },
                  { value: "10", label: "Every 10 min" },
                ]}
                onChange={(v) => patch({ autoSave: v as AppSettings["autoSave"] })}
              />
            </SettingRow>

            <SettingRow label="Confirm permanent delete" hint="Prompt before purging recycled items">
              <Toggle checked={settings.confirmDelete} onChange={(v) => patch({ confirmDelete: v })} />
            </SettingRow>

            <SettingRow label="Recycle bin retention" hint="Auto-purge recycled fields and records">
              <Select
                value={settings.recycleBinRetention}
                options={[
                  { value: "forever", label: "Keep forever" },
                  { value: "30", label: "30 days" },
                  { value: "90", label: "90 days" },
                ]}
                onChange={(v) => patch({ recycleBinRetention: v as AppSettings["recycleBinRetention"] })}
              />
            </SettingRow>
          </Section>

          {/* ── Data Format ── */}
          <Section label="Data Format">
            <SettingRow label="Date format" hint="Applied to date and date/time fields">
              <Select
                value={settings.dateFormat}
                options={[
                  { value: "iso", label: "ISO 8601 (2026-08-31)" },
                  { value: "dmy", label: "DD/MM/YYYY" },
                  { value: "mdy", label: "MM/DD/YYYY" },
                ]}
                onChange={(v) => patch({ dateFormat: v as AppSettings["dateFormat"] })}
              />
            </SettingRow>

            <SettingRow label="Decimal separator" hint="Used in decimal number fields">
              <SegmentedControl
                value={settings.decimalSep}
                options={[
                  { value: ".", label: "Period  1.5" },
                  { value: ",", label: "Comma  1,5" },
                ]}
                onChange={(v) => patch({ decimalSep: v as "." | "," })}
              />
            </SettingRow>

            <SettingRow label="Thousands separator" hint="Used in integer and decimal fields">
              <Select
                value={settings.thousandsSep}
                options={[
                  { value: "none", label: "None  1000" },
                  { value: ",", label: "Comma  1,000" },
                  { value: ".", label: "Period  1.000" },
                  { value: " ", label: "Space  1 000" },
                ]}
                onChange={(v) => patch({ thousandsSep: v as AppSettings["thousandsSep"] })}
              />
            </SettingRow>
          </Section>

          {/* ── About ── */}
          <Section label="About">
            <div style={{ padding: "2px 20px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Application", value: "Sedrify" },
                { label: "Version", value: "v0.1.0-draft" },
                { label: "RFD", value: "RFD-SED-001 v0.1" },
                { label: "Platform", value: "Linux (primary)" },
                { label: "File format", value: ".cabinet (SQLite)" },
                { label: "Stack", value: "React / Vite / Tailwind v4" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center" style={{ gap: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 110, flexShrink: 0 }}>
                    {label}
                  </span>
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--foreground)" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Reset */}
            <div style={{ padding: "8px 20px 0", borderTop: "1px solid var(--border)", marginTop: 4 }}>
              <button
                onClick={() => setSettings(defaultSettings)}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--muted-foreground)",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Reset to defaults
              </button>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p
        className="font-mono"
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--muted-foreground)",
          padding: "14px 20px 6px",
        }}
      >
        {label.toUpperCase()}
      </p>
      {children}
    </div>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 20px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{label}</p>
        <p style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 34,
        height: 20,
        borderRadius: 10,
        border: "none",
        backgroundColor: checked ? "var(--primary)" : "var(--secondary)",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background-color 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 17 : 3,
          width: 14,
          height: 14,
          borderRadius: "50%",
          backgroundColor: "#FFFFFF",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        backgroundColor: "var(--secondary)",
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              padding: "4px 10px",
              border: "none",
              borderLeft: opt === options[0] ? "none" : "1px solid var(--border)",
              backgroundColor: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary-foreground)" : "var(--secondary-foreground)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background-color 0.1s",
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontSize: 11,
        padding: "4px 8px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--secondary)",
        color: "var(--foreground)",
        fontFamily: "inherit",
        cursor: "pointer",
        outline: "none",
        maxWidth: 160,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--muted-foreground)" }}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" strokeLinecap="round" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  backgroundColor: "var(--secondary)",
  color: "var(--foreground)",
  fontFamily: "inherit",
  outline: "none",
  width: 160,
};
