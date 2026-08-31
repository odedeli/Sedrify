import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { mockRecords, mockFields, formatValue, type CabinetRecord, type Field } from "../data/mockData";
import TypeBadge from "../components/TypeBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "kanban" | "calendar";
type CalMode = "monthly" | "daily" | "yearly" | "timeline";
type SortItem = { fieldId: string; dir: "asc" | "desc" };
type KanbanGroup = { value: string; label: string; records: CabinetRecord[] };

// ── Constants ─────────────────────────────────────────────────────────────────

const VISIBLE_FIELD_IDS = ["f1", "f2", "f3", "f4", "f5", "f6"];
const INITIAL_WIDTHS = [36, 200, 160, 64, 84, 52, 64, 28];
const MIN_WIDTHS = [36, 60, 60, 48, 60, 36, 40, 28];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Main component ────────────────────────────────────────────────────────────

const RECENT_SEARCHES_KEY = "sedrify_recent_searches";

export default function CabFeeder() {
  const [records, setRecords] = useState<CabinetRecord[]>(mockRecords);
  const [fields] = useState<Field[]>(mockFields);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [calMode, setCalMode] = useState<CalMode>("monthly");
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [sorts, setSorts] = useState<SortItem[]>([]);
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [calDate, setCalDate] = useState(new Date(2026, 0, 1));
  const [findMode, setFindMode] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(["Denis Villeneuve", "Sci-Fi", "9.0", "2019"]);

  const visibleFields = useMemo(
    () => fields.filter((f) => VISIBLE_FIELD_IDS.includes(f.id)),
    [fields]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let result = q
      ? records.filter((r) =>
          visibleFields.some((f) => {
            const v = r.values[f.id];
            return v !== null && String(v).toLowerCase().includes(q);
          })
        )
      : [...records];

    if (sorts.length > 0) {
      result = [...result].sort((a, b) => {
        for (const s of sorts) {
          const va = a.values[s.fieldId] ?? "";
          const vb = b.values[s.fieldId] ?? "";
          const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
          if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    }
    return result;
  }, [records, query, sorts, visibleFields]);

  function updateRecord(id: string, fieldId: string, value: string | number | boolean | null) {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, values: { ...r.values, [fieldId]: value }, updatedAt: new Date().toISOString().slice(0, 10) }
          : r
      )
    );
  }

  const kanbanGroupFieldId = groupBy ?? "f4";
  const kanbanGroups = useMemo((): KanbanGroup[] => {
    const seen = new Map<string, CabinetRecord[]>();
    for (const r of filtered) {
      const v = r.values[kanbanGroupFieldId];
      const key = v !== null && v !== undefined && v !== "" ? String(v) : "__empty__";
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(r);
    }
    const groups: KanbanGroup[] = [];
    seen.forEach((recs, key) => {
      groups.push({ value: key === "__empty__" ? "" : key, label: key === "__empty__" ? "No value" : key, records: recs });
    });
    groups.sort((a, b) => {
      if (a.value === "" && b.value !== "") return 1;
      if (b.value === "" && a.value !== "") return -1;
      return a.value.localeCompare(b.value);
    });
    return groups;
  }, [filtered, kanbanGroupFieldId]);

  function openFind() { setFindMode(true); }
  function closeFind() { setFindMode(false); setFindQuery(""); }
  function commitSearch(q: string) {
    if (q.trim() && !recentSearches.includes(q.trim())) {
      setRecentSearches((prev) => [q.trim(), ...prev].slice(0, 8));
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "100%", backgroundColor: "var(--background)" }}>
      <FeederToolbar
        viewMode={viewMode} calMode={calMode} query={query} groupBy={groupBy}
        sorts={sorts} sortPanelOpen={sortPanelOpen} visibleFields={visibleFields}
        filteredCount={filtered.length} totalCount={records.length}
        findMode={findMode}
        onViewMode={setViewMode} onCalMode={setCalMode} onQuery={setQuery}
        onGroupBy={setGroupBy} onSorts={setSorts} onSortPanelOpen={setSortPanelOpen}
        onFind={openFind}
      />
      <div className="flex-1 overflow-hidden">
        {findMode ? (
          <FindPanel
            query={findQuery}
            records={records}
            fields={fields}
            recentSearches={recentSearches}
            onQuery={(q) => { setFindQuery(q); if (q.trim()) commitSearch(q); }}
            onClose={closeFind}
            onSelectRecord={(id) => { closeFind(); setSelectedId(id); setDetailOpen(true); }}
          />
        ) : viewMode === "grid" ? (
          <GridView
            records={filtered} fields={fields} visibleFields={visibleFields}
            groupBy={groupBy} sorts={sorts} onSorts={setSorts}
            selectedId={selectedId} detailOpen={detailOpen}
            onSelectRecord={(id) => { setSelectedId(id); setDetailOpen(true); }}
            onCloseDetail={() => { setSelectedId(null); setDetailOpen(false); }}
            onUpdateRecord={updateRecord}
          />
        ) : viewMode === "kanban" ? (
          <KanbanView groups={kanbanGroups} fields={fields} />
        ) : (
          <CalendarView mode={calMode} records={filtered} calDate={calDate} onCalDate={setCalDate} />
        )}
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function FeederToolbar({
  viewMode, calMode, query, groupBy, sorts, sortPanelOpen, visibleFields,
  filteredCount, totalCount, findMode,
  onViewMode, onCalMode, onQuery, onGroupBy, onSorts, onSortPanelOpen, onFind,
}: {
  viewMode: ViewMode; calMode: CalMode; query: string; groupBy: string | null;
  sorts: SortItem[]; sortPanelOpen: boolean; visibleFields: Field[];
  filteredCount: number; totalCount: number; findMode: boolean;
  onViewMode: (v: ViewMode) => void; onCalMode: (v: CalMode) => void;
  onQuery: (v: string) => void; onGroupBy: (v: string | null) => void;
  onSorts: (v: SortItem[]) => void; onSortPanelOpen: (v: boolean) => void;
  onFind: () => void;
}) {
  const sortRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (sortPanelOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) onSortPanelOpen(false);
      if (groupMenuOpen && groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sortPanelOpen, groupMenuOpen, onSortPanelOpen]);

  return (
    <div
      className="flex items-center gap-2 shrink-0 px-3"
      style={{ height: 44, borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}
    >
      <button style={primaryBtnStyle}>+ Add Record</button>

      {/* View switcher */}
      <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {([
          { v: "grid" as ViewMode, label: "Grid", icon: <GridIcon /> },
          { v: "kanban" as ViewMode, label: "Kanban", icon: <KanbanIcon /> },
          { v: "calendar" as ViewMode, label: "Calendar", icon: <CalIcon /> },
        ]).map(({ v, label, icon }) => (
          <button
            key={v}
            onClick={() => onViewMode(v)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
              fontSize: 12, fontFamily: "inherit", fontWeight: viewMode === v ? 500 : 400,
              border: "none", borderRight: "1px solid var(--border)", cursor: "pointer",
              backgroundColor: viewMode === v ? "var(--secondary)" : "transparent",
              color: viewMode === v ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            {icon}<span>{label}</span>
          </button>
        ))}
      </div>

      {/* Calendar sub-modes */}
      {viewMode === "calendar" && (
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {(["monthly","daily","yearly","timeline"] as CalMode[]).map((v) => (
            <button
              key={v}
              onClick={() => onCalMode(v)}
              style={{
                padding: "3px 9px", fontSize: 11, fontFamily: "inherit", fontWeight: calMode === v ? 500 : 400,
                border: "none", borderRight: "1px solid var(--border)", cursor: "pointer",
                backgroundColor: calMode === v ? "var(--secondary)" : "transparent",
                color: calMode === v ? "var(--foreground)" : "var(--muted-foreground)",
                textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", backgroundColor: "var(--background)", maxWidth: 200 }}>
        <svg viewBox="0 0 12 12" fill="none" style={{ width: 12, height: 12, flexShrink: 0, color: "var(--muted-foreground)" }} stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="5" r="3.5" /><path d="M8 8l2.5 2.5" strokeLinecap="round" />
        </svg>
        <input
          type="text" placeholder="Filter…" value={query} onChange={(e) => onQuery(e.target.value)}
          style={{ flex: 1, fontSize: 12, border: "none", outline: "none", backgroundColor: "transparent", color: "var(--foreground)", fontFamily: "inherit" }}
        />
        {query && (
          <button onClick={() => onQuery("")} style={{ color: "var(--muted-foreground)", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>
            <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }} stroke="currentColor" strokeWidth="1.5"><path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>

      {/* Group by */}
      {viewMode !== "calendar" && (
        <div ref={groupRef} style={{ position: "relative" }}>
          <button
            onClick={() => setGroupMenuOpen((v) => !v)}
            style={{ ...toolbarBtnStyle, backgroundColor: groupBy ? "var(--secondary)" : "transparent", color: groupBy ? "var(--foreground)" : "var(--muted-foreground)", borderColor: groupBy ? "var(--primary)" : "var(--border)" }}
          >
            <GroupIcon />
            {groupBy ? `Group: ${visibleFields.find((f) => f.id === groupBy)?.name ?? groupBy}` : "Group"}
          </button>
          {groupMenuOpen && (
            <div style={{ ...popoverStyle, top: "calc(100% + 4px)", left: 0, minWidth: 160 }}>
              <button onClick={() => { onGroupBy(null); setGroupMenuOpen(false); }} style={{ ...popoverItemStyle, color: !groupBy ? "var(--primary)" : "var(--foreground)", fontWeight: !groupBy ? 500 : 400 }}>None</button>
              {visibleFields.map((f) => (
                <button key={f.id} onClick={() => { onGroupBy(f.id); setGroupMenuOpen(false); }} style={{ ...popoverItemStyle, color: groupBy === f.id ? "var(--primary)" : "var(--foreground)", fontWeight: groupBy === f.id ? 500 : 400 }}>{f.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sort */}
      {viewMode === "grid" && (
        <div ref={sortRef} style={{ position: "relative" }}>
          <button
            onClick={() => onSortPanelOpen(!sortPanelOpen)}
            style={{ ...toolbarBtnStyle, backgroundColor: sorts.length > 0 ? "var(--secondary)" : "transparent", color: sorts.length > 0 ? "var(--foreground)" : "var(--muted-foreground)", borderColor: sorts.length > 0 ? "var(--primary)" : "var(--border)" }}
          >
            <SortIcon />
            {sorts.length > 0 ? `Sort (${sorts.length})` : "Sort"}
          </button>
          {sortPanelOpen && <SortPanel sorts={sorts} fields={visibleFields} onChange={onSorts} />}
        </div>
      )}

      {/* Find button */}
      <button
        onClick={onFind}
        title="Find records (all fields)"
        style={{ ...toolbarBtnStyle, marginLeft: "auto", backgroundColor: findMode ? "var(--secondary)" : "transparent", color: findMode ? "var(--primary)" : "var(--muted-foreground)", borderColor: findMode ? "var(--primary)" : "var(--border)" }}
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ width: 12, height: 12 }}>
          <circle cx="5.5" cy="5.5" r="3.5" /><path d="M8.5 8.5l2 2" />
        </svg>
        Find
      </button>

      <span className="font-mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        {filteredCount} / {totalCount}
      </span>
    </div>
  );
}

// ── Sort panel ────────────────────────────────────────────────────────────────

function SortPanel({ sorts, fields, onChange }: { sorts: SortItem[]; fields: Field[]; onChange: (v: SortItem[]) => void }) {
  function add() {
    const used = new Set(sorts.map((s) => s.fieldId));
    const next = fields.find((f) => !used.has(f.id));
    if (!next) return;
    onChange([...sorts, { fieldId: next.id, dir: "asc" }]);
  }
  function remove(i: number) { onChange(sorts.filter((_, j) => j !== i)); }
  function update(i: number, patch: Partial<SortItem>) { onChange(sorts.map((s, j) => j === i ? { ...s, ...patch } : s)); }

  return (
    <div style={{ ...popoverStyle, top: "calc(100% + 4px)", left: 0, minWidth: 300, padding: 10 }}>
      {sorts.length === 0 && <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>No sort applied</p>}
      {sorts.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", width: 28, textAlign: "right", flexShrink: 0 }}>{i === 0 ? "By" : "then"}</span>
          <select value={s.fieldId} onChange={(e) => update(i, { fieldId: e.target.value })} style={{ ...popoverSelectStyle, flex: 1 }}>
            {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={s.dir} onChange={(e) => update(i, { dir: e.target.value as "asc" | "desc" })} style={{ ...popoverSelectStyle, width: 80 }}>
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
          <button onClick={() => remove(i)} style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 10, height: 10 }}><path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" /></svg>
          </button>
        </div>
      ))}
      <div style={{ display: "flex", marginTop: 4 }}>
        <button onClick={add} disabled={sorts.length >= fields.length} style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>+ Add sort level</button>
        {sorts.length > 0 && <button onClick={() => onChange([])} style={{ fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, marginLeft: "auto" }}>Clear all</button>}
      </div>
    </div>
  );
}

// ── Grid view ─────────────────────────────────────────────────────────────────

function GridView({
  records, fields, visibleFields, groupBy, sorts, onSorts,
  selectedId, detailOpen, onSelectRecord, onCloseDetail, onUpdateRecord,
}: {
  records: CabinetRecord[]; fields: Field[]; visibleFields: Field[];
  groupBy: string | null; sorts: SortItem[]; onSorts: (v: SortItem[]) => void;
  selectedId: string | null; detailOpen: boolean;
  onSelectRecord: (id: string) => void; onCloseDetail: () => void;
  onUpdateRecord: (id: string, fieldId: string, value: string | number | boolean | null) => void;
}) {
  const [colWidths, setColWidths] = useState<number[]>(INITIAL_WIDTHS);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; fieldId: string } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const resizeRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const gridTemplate = useMemo(() => colWidths.map((w) => `${w}px`).join(" "), [colWidths]);

  const startResize = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { colIdx, startX: e.clientX, startWidth: colWidths[colIdx] };
    setResizingCol(colIdx);
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const { colIdx: ci, startX, startWidth } = resizeRef.current;
      setColWidths((prev) => prev.map((w, i) => i === ci ? Math.max(MIN_WIDTHS[ci], startWidth + ev.clientX - startX) : w));
    }
    function onUp() {
      resizeRef.current = null; setResizingCol(null);
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  function toggleHeaderSort(fieldId: string) {
    const existing = sorts.find((s) => s.fieldId === fieldId);
    if (existing) {
      if (sorts.length === 1) onSorts([{ fieldId, dir: existing.dir === "asc" ? "desc" : "asc" }]);
      else onSorts(sorts.map((s) => s.fieldId === fieldId ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : s));
    } else {
      onSorts([{ fieldId, dir: "asc" }]);
    }
  }

  type Row = { kind: "group"; value: string; count: number } | { kind: "record"; record: CabinetRecord };

  const rows = useMemo((): Row[] => {
    if (!groupBy) return records.map((r): Row => ({ kind: "record", record: r }));
    const map = new Map<string, CabinetRecord[]>();
    for (const r of records) {
      const v = r.values[groupBy];
      const key = (v !== null && v !== undefined && String(v) !== "") ? String(v) : "__empty__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const result: Row[] = [];
    const keys = Array.from(map.keys()).sort((a, b) => a === "__empty__" ? 1 : b === "__empty__" ? -1 : a.localeCompare(b));
    for (const key of keys) {
      const label = key === "__empty__" ? "" : key;
      result.push({ kind: "group", value: label, count: map.get(key)!.length });
      if (!collapsedGroups.has(key)) result.push(...map.get(key)!.map((r): Row => ({ kind: "record", record: r })));
    }
    return result;
  }, [records, groupBy, collapsedGroups]);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex" style={{ height: "100%", cursor: resizingCol !== null ? "col-resize" : "auto", userSelect: resizingCol !== null ? "none" : "auto" }}>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: gridTemplate, borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)", flexShrink: 0 }}>
          <div style={thStyle}>#</div>
          {visibleFields.map((field, i) => {
            const colIdx = i + 1;
            const sortItem = sorts.find((s) => s.fieldId === field.id);
            return (
              <div key={field.id} onClick={() => toggleHeaderSort(field.id)} style={{ ...thStyle, cursor: "pointer", position: "relative" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.name}</span>
                {sortItem && (
                  <svg viewBox="0 0 8 8" fill="none" style={{ width: 8, height: 8, flexShrink: 0, marginLeft: 2 }} stroke="currentColor" strokeWidth="1.5">
                    {sortItem.dir === "asc"
                      ? <path d="M4 1v6M1.5 4l2.5-3 2.5 3" strokeLinecap="round" strokeLinejoin="round" />
                      : <path d="M4 1v6M1.5 4l2.5 3 2.5-3" strokeLinecap="round" strokeLinejoin="round" />}
                  </svg>
                )}
                <ResizeHandle isResizing={resizingCol === colIdx} onMouseDown={(e) => startResize(colIdx, e)} />
              </div>
            );
          })}
          <div style={thStyle} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {rows.map((row, i) => {
            if (row.kind === "group") {
              const gf = visibleFields.find((f) => f.id === groupBy);
              return (
                <div
                  key={`g-${row.value}-${i}`}
                  onClick={() => setCollapsedGroups((prev) => { const n = new Set(prev); n.has(row.value === "" ? "__empty__" : row.value) ? n.delete(row.value === "" ? "__empty__" : row.value) : n.add(row.value === "" ? "__empty__" : row.value); return n; })}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)", cursor: "pointer" }}
                >
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 10, height: 10, color: "var(--muted-foreground)", flexShrink: 0, transform: collapsedGroups.has(row.value === "" ? "__empty__" : row.value) ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                    <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, color: row.value ? "var(--foreground)" : "var(--muted-foreground)", fontStyle: row.value ? "normal" : "italic" }}>
                    {row.value || "No value"}
                  </span>
                  {gf && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>— {gf.name}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)", backgroundColor: "var(--background)", padding: "1px 5px", borderRadius: 2 }}>{row.count}</span>
                </div>
              );
            }
            return (
              <InlineRow
                key={row.record.id}
                record={row.record}
                fields={visibleFields}
                isSelected={selectedId === row.record.id}
                gridTemplate={gridTemplate}
                editingFieldId={editingCell?.rowId === row.record.id ? editingCell.fieldId : null}
                onSelect={() => onSelectRecord(row.record.id)}
                onStartEdit={(fieldId) => setEditingCell({ rowId: row.record.id, fieldId })}
                onStopEdit={() => setEditingCell(null)}
                onUpdateRecord={onUpdateRecord}
              />
            );
          })}
          {rows.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No records match the filter</p>
            </div>
          )}
        </div>
      </div>

      {detailOpen && selectedRecord && (
        <DetailPanel record={selectedRecord} fields={fields} onClose={onCloseDetail} onUpdate={onUpdateRecord} />
      )}
    </div>
  );
}

// ── Inline row ────────────────────────────────────────────────────────────────

function InlineRow({ record, fields, isSelected, gridTemplate, editingFieldId, onSelect, onStartEdit, onStopEdit, onUpdateRecord }: {
  record: CabinetRecord; fields: Field[]; isSelected: boolean; gridTemplate: string;
  editingFieldId: string | null;
  onSelect: () => void;
  onStartEdit: (fieldId: string) => void;
  onStopEdit: () => void;
  onUpdateRecord: (id: string, fieldId: string, value: string | number | boolean | null) => void;
}) {
  const [hovered, setHovered] = useState(false);

  function save(fieldId: string, raw: string) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) { onStopEdit(); return; }
    let value: string | number | boolean | null = raw;
    if (field.type === "integer") value = parseInt(raw) || 0;
    else if (field.type === "decimal") value = parseFloat(raw) || 0;
    else if (field.type === "yesno") value = raw === "1";
    onUpdateRecord(record.id, fieldId, value);
    onStopEdit();
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "grid", gridTemplateColumns: gridTemplate, borderBottom: "1px solid var(--border)", backgroundColor: isSelected ? "var(--secondary)" : hovered ? "var(--muted)" : "transparent", cursor: "pointer" }}
    >
      <div style={tdStyle}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{record.seq}</span>
      </div>
      {fields.map((field) => {
        const raw = record.values[field.id];
        const display = formatValue(raw, field.type);
        const isEmpty = raw === null || raw === undefined || raw === "";
        const isEditing = editingFieldId === field.id;
        return (
          <div
            key={field.id}
            style={{ ...tdStyle, padding: isEditing ? "3px 4px" : "0 10px" }}
            onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(field.id); }}
            title={isEditing ? undefined : "Double-click to edit"}
          >
            {isEditing ? (
              <InlineCellEditor field={field} initialValue={raw} onSave={(v) => save(field.id, v)} onCancel={onStopEdit} />
            ) : field.type === "yesno" ? (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 2, backgroundColor: raw ? "#052312" : "var(--secondary)", color: raw ? "#4DE491" : "var(--muted-foreground)" }}>
                {raw ? "Yes" : "No"}
              </span>
            ) : (
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: isEmpty ? "var(--muted-foreground)" : isSelected ? "var(--foreground)" : "var(--secondary-foreground)", fontStyle: isEmpty ? "italic" : "normal" }}>
                {display}
              </span>
            )}
          </div>
        );
      })}
      <div style={tdStyle}>
        {(hovered || isSelected) && !editingFieldId && (
          <svg viewBox="0 0 12 12" fill="none" style={{ width: 12, height: 12, color: "var(--muted-foreground)" }} stroke="currentColor" strokeWidth="1.5">
            <path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Inline cell editor ────────────────────────────────────────────────────────

function InlineCellEditor({ field, initialValue, onSave, onCancel }: {
  field: Field;
  initialValue: string | number | boolean | null | undefined;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(() => {
    if (initialValue === null || initialValue === undefined) return "";
    if (typeof initialValue === "boolean") return initialValue ? "1" : "0";
    return String(initialValue);
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (field.type === "yesno") selectRef.current?.focus();
    else { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [field.type]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); onSave(val); }
    if (e.key === "Escape") onCancel();
  }

  const cellInputStyle: React.CSSProperties = {
    width: "100%", height: 28, fontSize: 12, fontFamily: "inherit",
    padding: "0 6px", borderRadius: 3, border: "1.5px solid var(--primary)",
    backgroundColor: "var(--background)", color: "var(--foreground)", outline: "none",
  };

  if (field.type === "yesno") {
    return (
      <select ref={selectRef} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => onSave(val)} onKeyDown={onKey} style={cellInputStyle}>
        <option value="0">No</option>
        <option value="1">Yes</option>
      </select>
    );
  }

  return (
    <input
      ref={inputRef}
      type={field.type === "integer" || field.type === "decimal" ? "number" : "text"}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={onKey}
      style={cellInputStyle}
    />
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ record, fields, onClose, onUpdate }: {
  record: CabinetRecord; fields: Field[]; onClose: () => void;
  onUpdate: (id: string, fieldId: string, value: string | number | boolean | null) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, record.values[f.id] !== null && record.values[f.id] !== undefined ? String(record.values[f.id]) : ""]))
  );

  function save() {
    for (const field of fields) {
      let v: string | number | boolean | null = draft[field.id];
      if (field.type === "integer") v = parseInt(draft[field.id]) || 0;
      else if (field.type === "decimal") v = parseFloat(draft[field.id]) || 0;
      else if (field.type === "yesno") v = draft[field.id] === "1";
      onUpdate(record.id, field.id, v);
    }
    onClose();
  }

  return (
    <div className="flex flex-col shrink-0" style={{ width: 280, borderLeft: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center shrink-0 px-4 gap-2" style={{ height: 44, borderBottom: "1px solid var(--border)" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {formatValue(record.values["f1"], "text")}
          </p>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)" }}>Record #{record.seq}</p>
        </div>
        <button onClick={onClose} className="ml-auto shrink-0" style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
          <svg viewBox="0 0 12 12" fill="none" style={{ width: 12, height: 12 }} stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {fields.map((field) => (
            <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TypeBadge type={field.type} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--secondary-foreground)" }}>{field.name}</span>
              </div>
              {field.type === "multiline" ? (
                <textarea value={draft[field.id]} onChange={(e) => setDraft((d) => ({ ...d, [field.id]: e.target.value }))} rows={3} style={{ ...detailInputStyle, resize: "vertical" }} />
              ) : field.type === "yesno" ? (
                <select value={draft[field.id]} onChange={(e) => setDraft((d) => ({ ...d, [field.id]: e.target.value }))} style={detailInputStyle}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              ) : (
                <input type={field.type === "integer" || field.type === "decimal" ? "number" : "text"} value={draft[field.id]} onChange={(e) => setDraft((d) => ({ ...d, [field.id]: e.target.value }))} style={detailInputStyle} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 16px", height: 48, borderTop: "1px solid var(--border)", alignItems: "center" }}>
        <button onClick={save} style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: "5px 0", borderRadius: "var(--radius)", border: "none", backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "inherit", cursor: "pointer" }}>Save</button>
        <button onClick={onClose} style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--foreground)", fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanView({ groups, fields }: { groups: KanbanGroup[]; fields: Field[] }) {
  const titleField = fields.find((f) => f.isPrimary) ?? fields[0];

  return (
    <div style={{ display: "flex", height: "100%", overflowX: "auto", padding: 12, gap: 10, alignItems: "flex-start" }}>
      {groups.map((g) => <KanbanCol key={g.value || "__empty__"} group={g} fields={fields} titleField={titleField} />)}
      {groups.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", fontSize: 12 }}>
          No records to display
        </div>
      )}
    </div>
  );
}

function KanbanCol({ group, fields, titleField }: { group: KanbanGroup; fields: Field[]; titleField: Field }) {
  return (
    <div style={{ flexShrink: 0, width: 244, display: "flex", flexDirection: "column", backgroundColor: "var(--secondary)", borderRadius: "var(--radius)", border: "1px solid var(--border)", maxHeight: "100%" }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: group.value ? "var(--foreground)" : "var(--muted-foreground)", fontStyle: group.value ? "normal" : "italic", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {group.label}
        </span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)", backgroundColor: "var(--background)", padding: "1px 5px", borderRadius: 2, flexShrink: 0 }}>
          {group.records.length}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 6, display: "flex", flexDirection: "column", gap: 5 }}>
        {group.records.map((r) => <KanbanCard key={r.id} record={r} fields={fields} titleField={titleField} />)}
        <button style={{ width: "100%", padding: "5px 0", border: "1px dashed var(--border)", borderRadius: "var(--radius)", backgroundColor: "transparent", color: "var(--muted-foreground)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          + Add record
        </button>
      </div>
    </div>
  );
}

function KanbanCard({ record, fields, titleField }: { record: CabinetRecord; fields: Field[]; titleField: Field }) {
  const [hovered, setHovered] = useState(false);
  const directorField = fields.find((f) => f.id === "f2");
  const yearField = fields.find((f) => f.id === "f3");
  const ratingField = fields.find((f) => f.id === "f5");
  const watchedField = fields.find((f) => f.id === "f6");

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: hovered ? "var(--background)" : "var(--card)", border: `1px solid ${hovered ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "8px 10px", cursor: "pointer", transition: "border-color 0.1s, background-color 0.1s" }}
    >
      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {formatValue(record.values[titleField.id], titleField.type)}
      </p>
      {directorField && record.values[directorField.id] && (
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {formatValue(record.values[directorField.id], directorField.type)}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {yearField && record.values[yearField.id] && (
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{record.values[yearField.id]}</span>
        )}
        {ratingField && record.values[ratingField.id] !== null && (
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#F7B750", marginLeft: "auto" }}>★ {record.values[ratingField.id]}</span>
        )}
        {watchedField && (
          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 2, backgroundColor: record.values[watchedField.id] ? "#052312" : "var(--secondary)", color: record.values[watchedField.id] ? "#4DE491" : "var(--muted-foreground)" }}>
            {record.values[watchedField.id] ? "Watched" : "Unwatched"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Calendar router ───────────────────────────────────────────────────────────

function CalendarView({ mode, records, calDate, onCalDate }: { mode: CalMode; records: CabinetRecord[]; calDate: Date; onCalDate: (d: Date) => void }) {
  const byDate = useMemo(() => {
    const map = new Map<string, CabinetRecord[]>();
    for (const r of records) {
      const d = r.createdAt.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(r);
    }
    return map;
  }, [records]);

  if (mode === "monthly") return <CalMonthly calDate={calDate} onCalDate={onCalDate} byDate={byDate} />;
  if (mode === "daily") return <CalDaily calDate={calDate} onCalDate={onCalDate} byDate={byDate} />;
  if (mode === "yearly") return <CalYearly calDate={calDate} onCalDate={onCalDate} byDate={byDate} />;
  return <CalTimeline calDate={calDate} onCalDate={onCalDate} records={records} />;
}

// ── Calendar: Monthly ─────────────────────────────────────────────────────────

function CalMonthly({ calDate, onCalDate, byDate }: { calDate: Date; onCalDate: (d: Date) => void; byDate: Map<string, CabinetRecord[]> }) {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells: { day: number; inMonth: boolean; date: string }[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevDays - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day: d, inMonth: false, date: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  let nd = 1;
  while (cells.length < 42) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ day: nd, inMonth: false, date: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}` });
    nd++;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
        <button onClick={() => onCalDate(new Date(year, month - 1, 1))} style={navBtnStyle}><ChevLeft /></button>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", flex: 1, textAlign: "center" }}>{MONTHS[month]} {year}</h2>
        <button onClick={() => onCalDate(new Date(year, month + 1, 1))} style={navBtnStyle}><ChevRight /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4, flexShrink: 0 }}>
        {DAYS_SHORT.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", letterSpacing: "0.04em" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, flex: 1 }}>
        {cells.map((cell, i) => {
          const recs = byDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          return (
            <div key={i} style={{ border: `1px solid ${isToday ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "3px 4px", backgroundColor: isToday ? "color-mix(in srgb, var(--primary) 6%, var(--background))" : cell.inMonth ? "var(--card)" : "var(--background)", opacity: cell.inMonth ? 1 : 0.35, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--primary)" : "var(--foreground)", marginBottom: 2, lineHeight: 1 }}>{cell.day}</span>
              {recs.slice(0, 2).map((r) => (
                <div key={r.id} style={{ fontSize: 9, lineHeight: 1.3, padding: "1px 3px", borderRadius: 2, marginBottom: 1, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {formatValue(r.values["f1"], "text")}
                </div>
              ))}
              {recs.length > 2 && <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>+{recs.length - 2}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar: Daily ───────────────────────────────────────────────────────────

function CalDaily({ calDate, onCalDate, byDate }: { calDate: Date; onCalDate: (d: Date) => void; byDate: Map<string, CabinetRecord[]> }) {
  const dateStr = calDate.toISOString().slice(0, 10);
  const recs = byDate.get(dateStr) ?? [];
  const dayName = calDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = calDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
        <button onClick={() => onCalDate(new Date(calDate.getTime() - 86400000))} style={navBtnStyle}><ChevLeft /></button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 1 }}>{dayName}</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{dateLabel}</p>
        </div>
        <button onClick={() => onCalDate(new Date(calDate.getTime() + 86400000))} style={navBtnStyle}><ChevRight /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {recs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
            <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28, color: "var(--muted-foreground)" }}>
              <rect x="2" y="4" width="24" height="22" rx="2" />
              <path d="M2 10h24M8 2v4M20 2v4" strokeLinecap="round" />
              <path d="M8 16h12M8 20h8" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No records on this day</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
              {recs.length} record{recs.length !== 1 ? "s" : ""} added
            </p>
            {recs.map((r) => (
              <div key={r.id} style={{ padding: "10px 14px", borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", flex: 1 }}>
                    {formatValue(r.values["f1"], "text")}
                  </p>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 2, backgroundColor: r.values["f6"] ? "#052312" : "var(--secondary)", color: r.values["f6"] ? "#4DE491" : "var(--muted-foreground)" }}>
                    {r.values["f6"] ? "Watched" : "Unwatched"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {r.values["f2"] && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{formatValue(r.values["f2"], "text")}</span>}
                  {r.values["f3"] && <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{r.values["f3"]}</span>}
                  {r.values["f4"] && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{String(r.values["f4"])}</span>}
                  {r.values["f5"] != null && <span style={{ fontSize: 11, color: "#F7B750" }}>★ {r.values["f5"]}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar: Yearly ──────────────────────────────────────────────────────────

function CalYearly({ calDate, onCalDate, byDate }: { calDate: Date; onCalDate: (d: Date) => void; byDate: Map<string, CabinetRecord[]> }) {
  const year = calDate.getFullYear();
  const [tooltip] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px 16px", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
        <button onClick={() => onCalDate(new Date(year - 1, 0, 1))} style={navBtnStyle}><ChevLeft /></button>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", flex: 1, textAlign: "center" }}>{year}</h2>
        <button onClick={() => onCalDate(new Date(year + 1, 0, 1))} style={navBtnStyle}><ChevRight /></button>
      </div>

      {tooltip && null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: 12 }, (_, mi) => {
          const dim = new Date(year, mi + 1, 0).getDate();
          const monthTotal = Array.from({ length: dim }, (_, di) => {
            const d = `${year}-${String(mi + 1).padStart(2, "0")}-${String(di + 1).padStart(2, "0")}`;
            return byDate.get(d)?.length ?? 0;
          }).reduce((a, b) => a + b, 0);

          return (
            <div key={mi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", width: 28, textAlign: "right", flexShrink: 0 }}>{MONTH_SHORT[mi]}</span>
              <div style={{ display: "flex", gap: 1.5, flex: 1, alignItems: "center" }}>
                {Array.from({ length: dim }, (_, di) => {
                  const d = di + 1;
                  const dateStr = `${year}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const recs = byDate.get(dateStr) ?? [];
                  const has = recs.length > 0;
                  return (
                    <div
                      key={d}
                      title={has ? recs.map((r) => formatValue(r.values["f1"], "text")).join(", ") : `${MONTH_SHORT[mi]} ${d}`}
                      style={{ width: 13, height: 13, borderRadius: 2, flexShrink: 0, backgroundColor: has ? "var(--primary)" : "var(--secondary)", opacity: has ? 1 : 0.35, cursor: has ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {has && recs.length > 1 && <span style={{ fontSize: 7, color: "var(--primary-foreground)", fontWeight: 700, lineHeight: 1 }}>{recs.length}</span>}
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)", width: 14, textAlign: "right", flexShrink: 0 }}>
                {monthTotal > 0 ? monthTotal : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar: Timeline ────────────────────────────────────────────────────────

function CalTimeline({ calDate, onCalDate, records }: { calDate: Date; onCalDate: (d: Date) => void; records: CabinetRecord[] }) {
  const year = calDate.getFullYear();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const doy = isLeap ? 366 : 365;
  const yearStart = new Date(year, 0, 1).getTime();

  function dayOfYear(dateStr: string): number {
    const t = new Date(dateStr + "T00:00:00").getTime();
    const d = Math.floor((t - yearStart) / 86400000);
    return new Date(dateStr).getFullYear() === year ? d : -1;
  }

  const monthStarts = Array.from({ length: 12 }, (_, mi) =>
    Math.floor((new Date(year, mi, 1).getTime() - yearStart) / 86400000)
  );

  const sorted = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const LABEL_W = 190;
  const ROW_H = 32;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      {/* Year nav + month header */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ width: LABEL_W, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 16px", gap: 6 }}>
          <button onClick={() => onCalDate(new Date(year - 1, 0, 1))} style={navBtnStyle}><ChevLeft /></button>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{year}</span>
          <button onClick={() => onCalDate(new Date(year + 1, 0, 1))} style={navBtnStyle}><ChevRight /></button>
        </div>
        <div style={{ flex: 1, position: "relative", height: 32, borderLeft: "1px solid var(--border)" }}>
          {monthStarts.map((ms, mi) => (
            <div
              key={mi}
              style={{ position: "absolute", left: `${(ms / doy) * 100}%`, top: 0, bottom: 0, display: "flex", alignItems: "center", paddingLeft: 4 }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{MONTH_SHORT[mi]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Record rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sorted.map((r) => {
          const d = dayOfYear(r.createdAt);
          const pct = d >= 0 ? (d / doy) * 100 : null;
          return (
            <div key={r.id} style={{ display: "flex", height: ROW_H, borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <div style={{ width: LABEL_W, padding: "0 12px 0 16px", flexShrink: 0, overflow: "hidden" }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatValue(r.values["f1"], "text")}</p>
                <p style={{ fontSize: 10, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(r.values["f4"] ?? "")}</p>
              </div>
              <div style={{ flex: 1, position: "relative", height: "100%", borderLeft: "1px solid var(--border)" }}>
                {monthStarts.slice(1).map((ms, mi) => (
                  <div key={mi} style={{ position: "absolute", left: `${(ms / doy) * 100}%`, top: 0, bottom: 0, width: 1, backgroundColor: "var(--border)", opacity: 0.5 }} />
                ))}
                {pct !== null && (
                  <div
                    title={`${r.createdAt} — ${formatValue(r.values["f1"], "text")}`}
                    style={{ position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)", width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--primary)", border: "2px solid var(--card)", cursor: "pointer", zIndex: 1 }}
                  />
                )}
                {pct === null && (
                  <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)" }}>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontStyle: "italic" }}>outside {year}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No records to display</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Find panel ────────────────────────────────────────────────────────────────

type FindRecordHit = { kind: "record"; id: string; seq: number; title: string; fieldName: string; matchValue: string };
type FindFieldHit = { kind: "field"; id: string; name: string; type: string };
type FindHit = FindRecordHit | FindFieldHit;

function highlightMatch(text: string, q: string) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent)", color: "var(--foreground)", borderRadius: 1 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </span>
  );
}

function FindPanel({ query, records, fields, recentSearches, onQuery, onClose, onSelectRecord }: {
  query: string; records: CabinetRecord[]; fields: Field[];
  recentSearches: string[];
  onQuery: (v: string) => void;
  onClose: () => void;
  onSelectRecord: (id: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [selectedHit, setSelectedHit] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const hits = useMemo<FindHit[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results: FindHit[] = [];
    records.forEach((r) => {
      fields.forEach((f) => {
        const v = r.values[f.id];
        if (v !== null && v !== undefined && String(v).toLowerCase().includes(q)) {
          if (!results.find((h) => h.kind === "record" && h.id === r.id)) {
            results.push({ kind: "record", id: r.id, seq: r.seq, title: String(r.values["f1"] ?? `Record ${r.seq}`), fieldName: f.name, matchValue: String(v) });
          }
        }
      });
    });
    fields.forEach((f) => {
      if (f.name.toLowerCase().includes(q)) results.push({ kind: "field", id: f.id, name: f.name, type: f.type });
    });
    return results;
  }, [query, records, fields]);

  const recordHits = hits.filter((h): h is FindRecordHit => h.kind === "record");
  const fieldHits = hits.filter((h): h is FindFieldHit => h.kind === "field");

  return (
    <div className="flex flex-col" style={{ height: "100%", backgroundColor: "var(--background)" }}>
      {/* Search region */}
      <div className="flex flex-col items-center shrink-0" style={{ padding: "28px 24px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: "100%", maxWidth: 560, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 44, borderRadius: "var(--radius)", border: `1.5px solid ${focused ? "var(--primary)" : "var(--border)"}`, backgroundColor: "var(--card)", transition: "border-color 0.15s" }}>
          <svg viewBox="0 0 14 14" fill="none" style={{ width: 14, height: 14, flexShrink: 0, color: "var(--muted-foreground)" }} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="6" r="4" /><path d="M10 10l3 3" />
          </svg>
          <input
            ref={inputRef}
            type="text" value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            placeholder="Search records, fields, values across all fields…"
            style={{ flex: 1, fontSize: 14, border: "none", outline: "none", backgroundColor: "transparent", color: "var(--foreground)", fontFamily: "inherit" }}
          />
          {query ? (
            <button onClick={() => onQuery("")} style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
              <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }} stroke="currentColor" strokeWidth="1.5"><path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" /></svg>
            </button>
          ) : (
            <kbd style={{ fontSize: 11, padding: "2px 6px", borderRadius: 2, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", fontFamily: "monospace" }}>Esc</kbd>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, width: "100%", maxWidth: 560 }}>
          {query && <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted-foreground)" }}>{hits.length === 0 ? "No results" : `${hits.length} result${hits.length !== 1 ? "s" : ""}`}</span>}
          <button onClick={onClose} style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
            <svg viewBox="0 0 10 10" fill="none" style={{ width: 9, height: 9 }} stroke="currentColor" strokeWidth="1.5"><path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" /></svg>
            Close
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {!query ? (
            <>
              {recentSearches.length > 0 && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--muted-foreground)", marginBottom: 10, textTransform: "uppercase" }}>Recent</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                    {recentSearches.map((term) => (
                      <button key={term} onClick={() => onQuery(term)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--secondary-foreground)", fontFamily: "inherit", cursor: "pointer" }}>{term}</button>
                    ))}
                  </div>
                </>
              )}
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--muted-foreground)", marginBottom: 10, textTransform: "uppercase" }}>Search scope</p>
              {[
                { label: "Records", note: "All field values, including hidden fields" },
                { label: "Fields", note: "Field names matched by query" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", width: 80 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.note}</span>
                </div>
              ))}
            </>
          ) : hits.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 60 }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 32, height: 32, color: "var(--border)" }} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /><path d="M8 11h6M11 8v6" />
              </svg>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No results for <strong style={{ color: "var(--foreground)" }}>{query}</strong></p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {recordHits.length > 0 && (
                <FindGroup title="Records" count={recordHits.length}>
                  {recordHits.map((h) => (
                    <FindRecordResult key={h.id} hit={h} query={query} isSelected={selectedHit === h.id}
                      onClick={() => setSelectedHit(h.id === selectedHit ? null : h.id)}
                      onOpen={() => onSelectRecord(h.id)} />
                  ))}
                </FindGroup>
              )}
              {fieldHits.length > 0 && (
                <FindGroup title="Fields" count={fieldHits.length}>
                  {fieldHits.map((h) => (
                    <FindFieldResult key={h.id} hit={h} query={query} isSelected={selectedHit === h.id} onClick={() => setSelectedHit(h.id === selectedHit ? null : h.id)} />
                  ))}
                </FindGroup>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FindGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--muted-foreground)", textTransform: "uppercase" }}>{title}</span>
        <span style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", borderRadius: 2, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}>{count}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

function FindRecordResult({ hit, query, isSelected, onClick, onOpen }: { hit: FindRecordHit; query: string; isSelected: boolean; onClick: () => void; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`, backgroundColor: isSelected ? "var(--secondary)" : hovered ? "var(--card)" : "transparent", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)" }}>#{hit.seq}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", flex: 1 }}>{highlightMatch(hit.title, query)}</span>
        {(hovered || isSelected) && (
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} style={{ fontSize: 10, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Open ↗</button>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
        <span style={{ color: "var(--secondary-foreground)" }}>{hit.fieldName}: </span>
        {highlightMatch(hit.matchValue, query)}
      </p>
    </div>
  );
}

function FindFieldResult({ hit, query, isSelected, onClick }: { hit: FindFieldHit; query: string; isSelected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`, backgroundColor: isSelected ? "var(--secondary)" : hovered ? "var(--card)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
    >
      <span style={{ fontSize: 10, fontFamily: "monospace", padding: "2px 5px", borderRadius: 2, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}>{hit.type}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{highlightMatch(hit.name, query)}</span>
      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>Field</span>
    </div>
  );
}

// ── Resize handle ─────────────────────────────────────────────────────────────

function ResizeHandle({ isResizing, onMouseDown }: { isResizing: boolean; onMouseDown: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}
    >
      <div style={{ width: 1, height: isResizing || hovered ? "70%" : "40%", borderRadius: 1, backgroundColor: isResizing || hovered ? "var(--primary)" : "var(--border)", transition: "height 0.1s, background-color 0.1s" }} />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GridIcon() {
  return <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 12, height: 12 }}><rect x="1" y="1" width="4" height="4" /><rect x="7" y="1" width="4" height="4" /><rect x="1" y="7" width="4" height="4" /><rect x="7" y="7" width="4" height="4" /></svg>;
}
function KanbanIcon() {
  return <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 12, height: 12 }}><rect x="1" y="1" width="3" height="10" rx="0.5" /><rect x="5" y="1" width="3" height="7" rx="0.5" /><rect x="9" y="1" width="2" height="5" rx="0.5" /></svg>;
}
function CalIcon() {
  return <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ width: 12, height: 12 }}><rect x="1" y="2" width="10" height="9" rx="1" /><path d="M1 5h10M4 1v2M8 1v2" /></svg>;
}
function GroupIcon() {
  return <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ width: 12, height: 12 }}><path d="M1 3h10M1 6h7M1 9h4" /></svg>;
}
function SortIcon() {
  return <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ width: 12, height: 12 }}><path d="M1 3h10M3 6h6M5 9h2" /></svg>;
}
function ChevLeft() {
  return <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 10, height: 10 }}><path d="M6.5 2L3.5 5l3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ChevRight() {
  return <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 10, height: 10 }}><path d="M3.5 2L6.5 5l-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: "var(--radius)", border: "1px solid var(--primary)", backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "inherit", cursor: "pointer" };
const toolbarBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 9px", borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)", fontFamily: "inherit", cursor: "pointer" };
const popoverStyle: React.CSSProperties = { position: "absolute", zIndex: 100, backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", padding: "3px 0" };
const popoverItemStyle: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "6px 12px", fontSize: 12, fontFamily: "inherit", background: "none", border: "none", cursor: "pointer", color: "var(--foreground)" };
const popoverSelectStyle: React.CSSProperties = { fontSize: 12, padding: "4px 6px", borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: "inherit", cursor: "pointer" };
const navBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)", cursor: "pointer" };
const thStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", padding: "0 10px", height: 32, display: "flex", alignItems: "center", letterSpacing: "0.02em", userSelect: "none", overflow: "hidden" };
const tdStyle: React.CSSProperties = { padding: "0 10px", height: 34, display: "flex", alignItems: "center", overflow: "hidden" };
const detailInputStyle: React.CSSProperties = { width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: "inherit", outline: "none" };
