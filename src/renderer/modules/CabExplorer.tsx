import { useState, useRef, useEffect } from "react";
import { mockCabinets, mockFields, mockRecords, type Cabinet } from "../data/mockData";

export default function CabExplorer() {
  const [cabinets, setCabinets] = useState<Cabinet[]>(mockCabinets);
  const [activeId, setActiveId] = useState("c1");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [exportModal, setExportModal] = useState<Cabinet | null>(null);
  const [importModal, setImportModal] = useState<Cabinet | null>(null);

  function openCabinet(id: string) {
    setActiveId(id);
    setCabinets((prev) => prev.map((c) => ({ ...c, isActive: c.id === id })));
  }

  return (
    <div className="flex flex-col" style={{ height: "100%", backgroundColor: "var(--background)", position: "relative" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 shrink-0 px-4"
        style={{ height: 44, borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {cabinets.length} cabinets
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ToolbarButton label="Open File…" />
          <ToolbarButton label="New Cabinet" primary />
        </div>
      </div>

      {/* Grid */}
      <div
        className="flex-1 overflow-auto p-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
          gap: 12,
          alignContent: "start",
        }}
      >
        {cabinets.map((cab) => (
          <CabinetCard
            key={cab.id}
            cabinet={cab}
            isActive={cab.id === activeId}
            isHovered={hoveredId === cab.id}
            hoveredAction={hoveredId === cab.id ? hoveredAction : null}
            onMouseEnter={() => setHoveredId(cab.id)}
            onMouseLeave={() => { setHoveredId(null); setHoveredAction(null); }}
            onActionEnter={(a) => setHoveredAction(a)}
            onActionLeave={() => setHoveredAction(null)}
            onClick={() => openCabinet(cab.id)}
            onImport={(e) => { e.stopPropagation(); setImportModal(cab); }}
            onExport={(e) => { e.stopPropagation(); setExportModal(cab); }}
          />
        ))}
      </div>

      {exportModal && (
        <ExportModal cabinet={exportModal} onClose={() => setExportModal(null)} />
      )}
      {importModal && (
        <ImportModal cabinet={importModal} onClose={() => setImportModal(null)} />
      )}
    </div>
  );
}

// ── Cabinet card ──────────────────────────────────────────────────────────────

function CabinetCard({
  cabinet, isActive, isHovered, hoveredAction,
  onMouseEnter, onMouseLeave, onActionEnter, onActionLeave,
  onClick, onImport, onExport,
}: {
  cabinet: Cabinet;
  isActive: boolean;
  isHovered: boolean;
  hoveredAction: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onActionEnter: (a: string) => void;
  onActionLeave: () => void;
  onClick: () => void;
  onImport: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        backgroundColor: "var(--card)",
        border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: 16,
        cursor: "pointer",
        transition: "border-color 0.1s",
        position: "relative",
      }}
    >
      {isActive && (
        <span
          className="absolute top-3 right-3 font-mono"
          style={{ fontSize: 9, color: "var(--primary)", fontWeight: 600, letterSpacing: "0.05em" }}
        >
          OPEN
        </span>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 36, height: 36, borderRadius: "var(--radius)",
            backgroundColor: isActive ? "var(--primary)" : "var(--secondary)",
            color: isActive ? "var(--primary-foreground)" : "var(--secondary-foreground)",
          }}
        >
          <CabinetIcon />
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
            {cabinet.name}
          </p>
          <p className="font-mono truncate" style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
            {cabinet.path}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3" style={{ marginBottom: isHovered ? 12 : 0 }}>
        <MetaPill label={`${cabinet.recordCount} rec`} />
        <MetaPill label={`${cabinet.fieldCount} fields`} />
        <MetaPill label={cabinet.fileSize} />
        <span className="ml-auto" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {cabinet.lastOpened}
        </span>
      </div>

      {isHovered && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
          {/* Data actions row */}
          <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
            <DataActionButton
              label="Import"
              icon={<ImportIcon />}
              isHovered={hoveredAction === "Import"}
              onMouseEnter={() => onActionEnter("Import")}
              onMouseLeave={onActionLeave}
              onClick={onImport}
            />
            <DataActionButton
              label="Export"
              icon={<ExportIcon />}
              isHovered={hoveredAction === "Export"}
              onMouseEnter={() => onActionEnter("Export")}
              onMouseLeave={onActionLeave}
              onClick={onExport}
            />
          </div>
          {/* Cabinet utility actions */}
          <div className="flex items-center gap-1">
            {["Clone", "Backup", "Encrypt", "Delete"].map((action) => (
              <ActionButton
                key={action}
                label={action}
                isHovered={hoveredAction === action}
                destructive={action === "Delete"}
                onMouseEnter={() => onActionEnter(action)}
                onMouseLeave={onActionLeave}
                onClick={(e) => e.stopPropagation()}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export modal ──────────────────────────────────────────────────────────────

type ExportFormat = "csv" | "json" | "tsv";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  json: "JSON",
  tsv: "TSV",
};

function ExportModal({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const isFilmCab = cabinet.id === "c1";
  const availableFields = isFilmCab
    ? mockFields
    : Array.from({ length: cabinet.fieldCount }, (_, i) => ({
        id: `gf${i}`, name: `Field ${i + 1}`, type: "text" as const,
        required: false, isPrimary: false, description: "", defaultValue: "", displayOrder: i,
      }));

  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(availableFields.map((f) => f.id))
  );
  const [includeHeader, setIncludeHeader] = useState(true);
  const [prettyPrint, setPrettyPrint] = useState(true);
  const [delimiter, setDelimiter] = useState(",");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleField(id: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedFields.size === availableFields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(availableFields.map((f) => f.id)));
    }
  }

  function doExport() {
    if (!isFilmCab) { onClose(); return; }
    const fields = mockFields.filter((f) => selectedFields.has(f.id));
    const records = mockRecords;

    if (format === "csv" || format === "tsv") {
      const sep = format === "tsv" ? "\t" : delimiter;
      const rows: string[] = [];
      if (includeHeader) rows.push(fields.map((f) => f.name).join(sep));
      for (const rec of records) {
        rows.push(fields.map((f) => {
          const v = rec.values[f.id];
          const s = v === null || v === undefined ? "" : String(v);
          return s.includes(sep) || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        }).join(sep));
      }
      triggerDownload(rows.join("\n"), `${cabinet.name.replace(/\s+/g, "_")}.${format}`, "text/plain");
    } else {
      const data = records.map((rec) => {
        const obj: Record<string, unknown> = {};
        for (const f of fields) obj[f.name] = rec.values[f.id] ?? null;
        return obj;
      });
      const json = prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
      triggerDownload(json, `${cabinet.name.replace(/\s+/g, "_")}.json`, "application/json");
    }
    onClose();
  }

  const allSelected = selectedFields.size === availableFields.length;
  const noneSelected = selectedFields.size === 0;

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: 480 }}>
        <ModalHeader
          title={`Export — ${cabinet.name}`}
          subtitle={`${isFilmCab ? mockRecords.length : cabinet.recordCount} records will be exported`}
          onClose={onClose}
          icon={<ExportIcon />}
        />

        <div className="flex flex-col gap-5" style={{ padding: "20px 24px" }}>
          {/* Format selector */}
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>Format</label>
            <div className="flex gap-1.5">
              {(["csv", "json", "tsv"] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    padding: "5px 14px", fontSize: 12, fontFamily: "inherit", fontWeight: 500,
                    borderRadius: "var(--radius)", cursor: "pointer",
                    border: `1px solid ${format === f ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: format === f ? "var(--primary)" : "var(--secondary)",
                    color: format === f ? "var(--primary-foreground)" : "var(--secondary-foreground)",
                  }}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Format-specific options */}
          {format === "csv" && (
            <div className="flex flex-col gap-3">
              <label style={labelStyle}>Options</label>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5" style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Delimiter</span>
                  <select
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                    style={selectStyle}
                  >
                    <option value=",">Comma  (,)</option>
                    <option value=";">Semicolon  (;)</option>
                    <option value="|">Pipe  (|)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5" style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Header row</span>
                  <MiniToggle checked={includeHeader} onChange={setIncludeHeader} trueLabel="Include" falseLabel="Omit" />
                </div>
              </div>
            </div>
          )}

          {format === "json" && (
            <div className="flex flex-col gap-3">
              <label style={labelStyle}>Options</label>
              <MiniToggle checked={prettyPrint} onChange={setPrettyPrint} trueLabel="Pretty-print" falseLabel="Minified" />
            </div>
          )}

          {/* Field selection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label style={labelStyle}>Fields to include</label>
              <button
                onClick={toggleAll}
                style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div
              style={{
                border: "1px solid var(--border)", borderRadius: "var(--radius)",
                overflow: "hidden", maxHeight: 200, overflowY: "auto",
              }}
            >
              {availableFields.map((f, i) => (
                <label
                  key={f.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 10px", cursor: "pointer",
                    borderBottom: i < availableFields.length - 1 ? "1px solid var(--border)" : "none",
                    backgroundColor: selectedFields.has(f.id) ? "var(--background)" : "var(--card)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(f.id)}
                    onChange={() => toggleField(f.id)}
                    style={{ accentColor: "var(--primary)", width: 12, height: 12, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--foreground)", flex: 1 }}>{f.name}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                    {f.type}
                  </span>
                </label>
              ))}
            </div>
            {noneSelected && (
              <p style={{ fontSize: 11, color: "#BD2A49" }}>Select at least one field to export.</p>
            )}
          </div>
        </div>

        <ModalFooter>
          <CancelButton onClick={onClose} />
          <button
            onClick={doExport}
            disabled={noneSelected}
            style={{
              padding: "6px 16px", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
              borderRadius: "var(--radius)", border: "none", cursor: noneSelected ? "not-allowed" : "pointer",
              backgroundColor: noneSelected ? "var(--muted)" : "var(--primary)",
              color: noneSelected ? "var(--muted-foreground)" : "var(--primary-foreground)",
            }}
          >
            Download {FORMAT_LABELS[format]}
          </button>
        </ModalFooter>
      </div>
    </ModalOverlay>
  );
}

// ── Import modal ──────────────────────────────────────────────────────────────

type ImportMode = "append" | "replace" | "update";

const MOCK_SOURCE_COLUMNS = ["Title", "Year", "Director", "Score", "Watched", "Notes"];

function ImportModal({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const isFilmCab = cabinet.id === "c1";
  const cabinetFields = isFilmCab ? mockFields : [];

  const [step, setStep] = useState<"drop" | "map">("drop");
  const [isDragOver, setIsDragOver] = useState(false);
  const [mockFile, setMockFile] = useState<{ name: string; size: string; format: string } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_SOURCE_COLUMNS.map((col) => {
      const match = isFilmCab ? mockFields.find((f) =>
        f.name.toLowerCase() === col.toLowerCase() ||
        (col === "Score" && f.name === "Rating") ||
        (col === "Watched" && f.name === "Watched")
      ) : null;
      return [col, match?.id ?? ""];
    }))
  );
  const [importMode, setImportMode] = useState<ImportMode>("append");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleFileSelect(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";
    const fmt = ext === "json" ? "JSON" : ext === "tsv" ? "TSV" : "CSV";
    setMockFile({ name: file.name, size: formatBytes(file.size), format: fmt });
    setStep("map");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleBrowse() {
    fileInputRef.current?.click();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function simulateSelect() {
    setMockFile({ name: "films_import.csv", size: "4.2 KB", format: "CSV" });
    setStep("map");
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: step === "map" ? 540 : 460 }}>
        <ModalHeader
          title={`Import — ${cabinet.name}`}
          subtitle={step === "drop" ? "Add records from an external file" : `Mapping ${MOCK_SOURCE_COLUMNS.length} source columns`}
          onClose={onClose}
          icon={<ImportIcon />}
        />

        {step === "drop" ? (
          <div style={{ padding: "20px 24px" }}>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={handleBrowse}
              style={{
                border: `2px dashed ${isDragOver ? "var(--primary)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                padding: "36px 24px",
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: isDragOver ? "color-mix(in srgb, var(--primary) 6%, transparent)" : "var(--background)",
                transition: "background-color 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ marginBottom: 12, color: isDragOver ? "var(--primary)" : "var(--muted-foreground)" }}>
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40, margin: "0 auto" }}>
                  <rect x="6" y="8" width="28" height="24" rx="2" />
                  <path d="M6 14h28" />
                  <path d="M14 20h12M14 25h8" strokeLinecap="round" />
                  <path d="M28 5v6M25 8l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>
                Drop a file here, or click to browse
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Supports CSV, TSV, and JSON
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.json"
              onChange={handleInputChange}
              style={{ display: "none" }}
            />

            {/* Demo shortcut */}
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={simulateSelect}
                style={{ fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
              >
                Use demo file (films_import.csv)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5" style={{ padding: "20px 24px" }}>
            {/* File summary */}
            <div
              className="flex items-center gap-3"
              style={{ padding: "8px 12px", backgroundColor: "var(--secondary)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, color: "var(--muted-foreground)", flexShrink: 0 }}>
                <path d="M3 2h7l3 3v9H3z" />
                <path d="M10 2v3h3" />
              </svg>
              <span style={{ fontSize: 12, color: "var(--foreground)", flex: 1 }}>{mockFile?.name}</span>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{mockFile?.size}</span>
              <span
                style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 2, backgroundColor: "var(--background)", color: "var(--primary)", border: "1px solid var(--border)" }}
              >
                {mockFile?.format}
              </span>
              <button
                onClick={() => { setStep("drop"); setMockFile(null); }}
                style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
              >
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 10, height: 10 }}>
                  <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Field mapping */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <label style={labelStyle}>Field mapping</label>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: "auto" }}>
                  {Object.values(mapping).filter(Boolean).length} of {MOCK_SOURCE_COLUMNS.length} mapped
                </span>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr", gap: 0, padding: "6px 12px", backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Source column</span>
                  <span />
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Cabinet field</span>
                </div>
                {MOCK_SOURCE_COLUMNS.map((col, i) => (
                  <div
                    key={col}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 28px 1fr", alignItems: "center",
                      padding: "6px 12px",
                      borderBottom: i < MOCK_SOURCE_COLUMNS.length - 1 ? "1px solid var(--border)" : "none",
                      backgroundColor: "var(--background)",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--foreground)", fontFamily: "monospace" }}>{col}</span>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 12, height: 12, color: "var(--muted-foreground)", margin: "0 auto" }}>
                      <path d="M3 8h10M9 4l4 4-4 4" strokeLinejoin="round" />
                    </svg>
                    <select
                      value={mapping[col] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                      style={selectStyle}
                    >
                      <option value="">— Skip —</option>
                      {cabinetFields.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                      {!isFilmCab && Array.from({ length: cabinet.fieldCount }, (_, i) => (
                        <option key={`gf${i}`} value={`gf${i}`}>Field {i + 1}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Import mode */}
            <div className="flex flex-col gap-2">
              <label style={labelStyle}>Import mode</label>
              <div className="flex flex-col gap-1.5">
                {([
                  { value: "append", label: "Append new records", hint: "Adds imported rows without modifying existing ones" },
                  { value: "replace", label: "Replace all records", hint: "Deletes all existing records before importing" },
                  { value: "update", label: "Update by primary field", hint: "Matches on primary field and updates existing records" },
                ] as { value: ImportMode; label: string; hint: string }[]).map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "8px 10px", cursor: "pointer", borderRadius: "var(--radius)",
                      border: `1px solid ${importMode === opt.value ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: importMode === opt.value ? "color-mix(in srgb, var(--primary) 8%, var(--background))" : "var(--background)",
                    }}
                  >
                    <input
                      type="radio"
                      checked={importMode === opt.value}
                      onChange={() => setImportMode(opt.value)}
                      style={{ accentColor: "var(--primary)", marginTop: 2, flexShrink: 0 }}
                    />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{opt.label}</p>
                      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{opt.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
              {importMode === "replace" && (
                <p style={{ fontSize: 11, color: "#BD2A49", paddingLeft: 2 }}>
                  Warning: all {isFilmCab ? mockRecords.length : cabinet.recordCount} existing records will be permanently deleted.
                </p>
              )}
            </div>
          </div>
        )}

        <ModalFooter>
          <CancelButton onClick={onClose} />
          {step === "drop" ? (
            <button
              onClick={handleBrowse}
              style={{ padding: "6px 16px", fontSize: 12, fontWeight: 500, fontFamily: "inherit", borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--foreground)", cursor: "pointer" }}
            >
              Browse files
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                borderRadius: "var(--radius)", border: "none", cursor: "pointer",
                backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
              }}
            >
              Import records
            </button>
          )}
        </ModalFooter>
      </div>
    </ModalOverlay>
  );
}

// ── Shared modal primitives ───────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--card)", borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose, icon }: { title: string; subtitle: string; onClose: () => void; icon: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 24px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: "var(--radius)", flexShrink: 0,
          backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{title}</p>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{subtitle}</p>
      </div>
      <button
        onClick={onClose}
        style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", marginTop: -2 }}
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12 }}>
          <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
        padding: "14px 24px",
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--secondary)",
        borderRadius: "0 0 var(--radius) var(--radius)",
      }}
    >
      {children}
    </div>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "6px 16px", fontSize: 12, fontWeight: 400, fontFamily: "inherit",
        borderRadius: "var(--radius)", border: "1px solid var(--border)", cursor: "pointer",
        backgroundColor: hovered ? "var(--background)" : "transparent",
        color: "var(--secondary-foreground)",
      }}
    >
      Cancel
    </button>
  );
}

function MiniToggle({ checked, onChange, trueLabel, falseLabel }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  trueLabel: string;
  falseLabel: string;
}) {
  return (
    <div className="flex gap-1">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          style={{
            padding: "4px 10px", fontSize: 11, fontFamily: "inherit", borderRadius: 2,
            border: `1px solid ${checked === v ? "var(--primary)" : "var(--border)"}`,
            backgroundColor: checked === v ? "var(--primary)" : "transparent",
            color: checked === v ? "var(--primary-foreground)" : "var(--secondary-foreground)",
            cursor: "pointer",
          }}
        >
          {v ? trueLabel : falseLabel}
        </button>
      ))}
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Small components ──────────────────────────────────────────────────────────

function MetaPill({ label }: { label: string }) {
  return (
    <span
      className="font-mono"
      style={{ fontSize: 10, padding: "2px 6px", borderRadius: 2, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}
    >
      {label}
    </span>
  );
}

function DataActionButton({ label, icon, isHovered, onMouseEnter, onMouseLeave, onClick }: {
  label: string; icon: React.ReactNode; isHovered: boolean;
  onMouseEnter: () => void; onMouseLeave: () => void; onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        flex: 1, justifyContent: "center",
        fontSize: 11, padding: "4px 0", borderRadius: 2,
        border: `1px solid ${isHovered ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: isHovered ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--secondary)",
        color: isHovered ? "var(--primary)" : "var(--secondary-foreground)",
        cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
        transition: "color 0.1s, border-color 0.1s, background-color 0.1s",
      }}
    >
      <span style={{ display: "flex" }}>{icon}</span>
      {label}
    </button>
  );
}

function ActionButton({ label, isHovered, destructive, onMouseEnter, onMouseLeave, onClick }: {
  label: string; isHovered: boolean; destructive: boolean;
  onMouseEnter: () => void; onMouseLeave: () => void; onClick: (e: React.MouseEvent) => void;
}) {
  const destructiveColor = "#BD2A49";
  return (
    <button
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        fontSize: 11, padding: "3px 8px", borderRadius: 2,
        border: `1px solid ${isHovered && destructive ? destructiveColor : "var(--border)"}`,
        backgroundColor: isHovered ? (destructive ? "#3A0610" : "var(--secondary)") : "transparent",
        color: isHovered && destructive ? destructiveColor : "var(--secondary-foreground)",
        cursor: "pointer", fontFamily: "inherit",
        transition: "background-color 0.1s",
      }}
    >
      {label}
    </button>
  );
}

function ToolbarButton({ label, primary }: { label: string; primary?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: 12, padding: "4px 10px", borderRadius: "var(--radius)",
        border: `1px solid ${primary ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: primary
          ? hovered ? "#222BDA" : "var(--primary)"
          : hovered ? "var(--secondary)" : "transparent",
        color: primary ? "var(--primary-foreground)" : "var(--foreground)",
        cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CabinetIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 6h12" />
      <path d="M5 9.5h6M5 11.5h3.5" strokeLinecap="round" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M7 2v7M4 6.5l3 3 3-3" />
      <path d="M2 10.5v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M7 9V2M4 4.5l3-3 3 3" />
      <path d="M2 10.5v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
    </svg>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--foreground)",
  letterSpacing: "0.02em",
};

const selectStyle: React.CSSProperties = {
  width: "100%", fontSize: 12, padding: "5px 8px",
  borderRadius: "var(--radius)", border: "1px solid var(--border)",
  backgroundColor: "var(--background)", color: "var(--foreground)",
  fontFamily: "inherit", cursor: "pointer",
};
