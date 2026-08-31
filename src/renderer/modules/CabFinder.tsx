import { useState, useMemo } from "react";
import { mockRecords, mockFields, formatValue } from "../data/mockData";

const RECENT = ["Denis Villeneuve", "Sci-Fi", "9.0", "2019"];

type RecordHit = { kind: "record"; id: string; seq: number; title: string; fieldName: string; matchValue: string };
type FieldHit = { kind: "field"; id: string; name: string; type: string };
type Hit = RecordHit | FieldHit;

export default function CabFinder() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedHit, setSelectedHit] = useState<string | null>(null);

  const hits = useMemo<Hit[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results: Hit[] = [];

    mockRecords.forEach((record) => {
      mockFields.forEach((field) => {
        const v = record.values[field.id];
        if (v !== null && v !== undefined && String(v).toLowerCase().includes(q)) {
          const existing = results.find(
            (h) => h.kind === "record" && h.id === record.id
          );
          if (!existing) {
            results.push({
              kind: "record",
              id: record.id,
              seq: record.seq,
              title: String(record.values["f1"] ?? `Record ${record.seq}`),
              fieldName: field.name,
              matchValue: String(v),
            });
          }
        }
      });
    });

    mockFields.forEach((field) => {
      if (field.name.toLowerCase().includes(q)) {
        results.push({ kind: "field", id: field.id, name: field.name, type: field.type });
      }
    });

    return results;
  }, [query]);

  const recordHits = hits.filter((h): h is RecordHit => h.kind === "record");
  const fieldHits = hits.filter((h): h is FieldHit => h.kind === "field");

  return (
    <div
      className="flex flex-col"
      style={{ height: "100%", backgroundColor: "var(--background)" }}
    >
      {/* Search bar region */}
      <div
        className="flex flex-col items-center justify-center shrink-0"
        style={{ padding: "40px 24px 24px", borderBottom: "1px solid var(--border)" }}
      >
        <p className="text-xs font-medium mb-4" style={{ color: "var(--muted-foreground)", letterSpacing: "0.06em" }}>
          CAB FINDER
        </p>

        {/* Search input */}
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            height: 44,
            borderRadius: "var(--radius)",
            border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`,
            backgroundColor: "var(--card)",
            transition: "border-color 0.15s",
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--muted-foreground)" }}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M11 11l3 3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search records, fields, values…"
            style={{
              flex: 1,
              fontSize: 14,
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              fontFamily: "inherit",
            }}
          />
          {query ? (
            <button onClick={() => setQuery("")} style={{ color: "var(--muted-foreground)" }}>
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <kbd
              className="font-mono"
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 2,
                border: "1px solid var(--border)",
                backgroundColor: "var(--secondary)",
                color: "var(--muted-foreground)",
              }}
            >
              /
            </kbd>
          )}
        </div>

        {/* Result count */}
        {query && (
          <p className="font-mono mt-3" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {hits.length === 0 ? "No results" : `${hits.length} result${hits.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {/* Results / recent area */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px" }}>
        {!query ? (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>
              RECENT SEARCHES
            </p>
            <div className="flex flex-wrap gap-2">
              {RECENT.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                    color: "var(--secondary-foreground)",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {term}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 32 }}>
              <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>
                SEARCH SCOPE
              </p>
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Records", note: "All field values in the current view" },
                  { label: "Fields", note: "Field names and descriptions" },
                  { label: "Linked files", note: "File paths — matched by filename" },
                ].map((scope) => (
                  <div key={scope.label} className="flex items-center gap-3 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)", width: 90 }}>{scope.label}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{scope.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 560, margin: "0 auto" }} className="flex flex-col gap-5">
            {recordHits.length > 0 && (
              <ResultGroup title="Records" count={recordHits.length}>
                {recordHits.map((hit) => (
                  <RecordResult
                    key={hit.id}
                    hit={hit}
                    query={query}
                    isSelected={selectedHit === hit.id}
                    onClick={() => setSelectedHit(hit.id === selectedHit ? null : hit.id)}
                  />
                ))}
              </ResultGroup>
            )}

            {fieldHits.length > 0 && (
              <ResultGroup title="Fields" count={fieldHits.length}>
                {fieldHits.map((hit) => (
                  <FieldResult
                    key={hit.id}
                    hit={hit}
                    query={query}
                    isSelected={selectedHit === hit.id}
                    onClick={() => setSelectedHit(hit.id === selectedHit ? null : hit.id)}
                  />
                ))}
              </ResultGroup>
            )}

            {hits.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.2" style={{ color: "var(--border)" }}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M16.5 16.5L21 21" strokeLinecap="round" />
                  <path d="M8 11h6M11 8v6" strokeLinecap="round" />
                </svg>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  No results for <strong style={{ color: "var(--foreground)" }}>{query}</strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>
          {title.toUpperCase()}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 10, padding: "1px 5px", borderRadius: 2, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: "rgba(55,87,235,0.25)", color: "var(--foreground)", borderRadius: 1 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

function RecordResult({
  hit,
  query,
  isSelected,
  onClick,
}: {
  hit: RecordHit;
  query: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: isSelected ? "var(--secondary)" : hovered ? "var(--card)" : "transparent",
        cursor: "pointer",
      }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-mono" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
          #{hit.seq}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          {highlightMatch(hit.title, query)}
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        <span style={{ color: "var(--secondary-foreground)" }}>{hit.fieldName}: </span>
        {highlightMatch(hit.matchValue, query)}
      </p>
    </div>
  );
}

function FieldResult({
  hit,
  query,
  isSelected,
  onClick,
}: {
  hit: FieldHit;
  query: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: isSelected ? "var(--secondary)" : hovered ? "var(--card)" : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        className="font-mono"
        style={{ fontSize: 10, padding: "2px 5px", borderRadius: 2, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}
      >
        {hit.type}
      </span>
      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
        {highlightMatch(hit.name, query)}
      </span>
      <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>Field</span>
    </div>
  );
}
