import { mockRecords, mockFields } from "../data/mockData";

const GENRE_DATA = [
  { label: "Sci-Fi",   count: 3, color: "#6184EF" },   // cobalt-500
  { label: "Drama",    count: 2, color: "#41C0C2" },   // aqua-400
  { label: "Thriller", count: 1, color: "#F5848F" },   // merlot-400
  { label: "Mystery",  count: 1, color: "#8279EF" },   // lavender-500
  { label: "Comedy",   count: 1, color: "#F7B750" },   // amber-300
  { label: "Horror",   count: 1, color: "#BD2A49" },   // merlot-600
  { label: "Romance",  count: 1, color: "#DE38C4" },   // rose-500
];

const FIELD_TYPE_DATA = [
  { label: "text",        count: 2, color: "#A6ABB7" },  // gray-400
  { label: "integer",     count: 1, color: "#83CFF7" },  // ocean-300
  { label: "decimal",     count: 1, color: "#83CFF7" },
  { label: "choice",      count: 1, color: "#F7B750" },  // amber-300
  { label: "yesno",       count: 1, color: "#4DE491" },  // grass-300
  { label: "multiline",   count: 1, color: "#C0C4CD" },  // gray-300
  { label: "linked-file", count: 1, color: "#F7B09A" },  // coral-300
];

const STAT_TILES = [
  { label: "Records", value: String(mockRecords.length), mono: true },
  { label: "Fields", value: String(mockFields.length), mono: true },
  { label: "File size", value: "52 KB", mono: true },
  { label: "Last saved", value: "2 min ago", mono: false },
];

export default function CabAnalyzer() {
  return (
    <div
      className="flex flex-col overflow-auto"
      style={{ height: "100%", backgroundColor: "var(--background)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 shrink-0 px-4"
        style={{ height: 44, borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          Film Collection
        </span>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Overview
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ExportButton label="Export CSV" />
          <ExportButton label="Export JSON" primary />
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: 800 }}>
        {/* Stat tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {STAT_TILES.map((tile) => (
            <StatTile key={tile.label} tile={tile} />
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ChartCard title="Records by Genre">
            <HBarChart data={GENRE_DATA} />
          </ChartCard>
          <ChartCard title="Field Types">
            <HBarChart data={FIELD_TYPE_DATA} />
          </ChartCard>
        </div>

        {/* Records timeline */}
        <div style={{ marginTop: 16 }}>
          <ChartCard title="Records added over time">
            <TimelineChart />
          </ChartCard>
        </div>

        {/* Footer note */}
        <p
          className="font-mono mt-5"
          style={{ fontSize: 10, color: "var(--muted-foreground)" }}
        >
          Cabinet: ~/Documents/cabinets/films.cabinet · Schema v1 · Last migrated never
        </p>
      </div>
    </div>
  );
}

function StatTile({ tile }: { tile: { label: string; value: string; mono: boolean } }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--card)",
      }}
    >
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{tile.label}</p>
      <p
        className={tile.mono ? "font-mono" : ""}
        style={{ fontSize: 22, fontWeight: 600, color: "var(--foreground)", lineHeight: 1 }}
      >
        {tile.value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--card)",
      }}
    >
      <p className="text-xs font-medium mb-4" style={{ color: "var(--foreground)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function HBarChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count));
  const BAR_MAX = 160;
  const ROW_H = 24;
  const LABEL_W = 72;
  const total = data.reduce((s, d) => s + d.count, 0);
  const svgH = data.length * ROW_H;

  return (
    <svg
      viewBox={`0 0 ${LABEL_W + BAR_MAX + 36} ${svgH}`}
      width="100%"
      style={{ overflow: "visible" }}
    >
      {data.map((item, i) => {
        const barW = (item.count / maxCount) * BAR_MAX;
        const y = i * ROW_H;
        const pct = Math.round((item.count / total) * 100);
        return (
          <g key={item.label}>
            <text
              x={LABEL_W - 8}
              y={y + 14}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
              fontFamily="inherit"
            >
              {item.label}
            </text>
            <rect
              x={LABEL_W}
              y={y + 5}
              width={barW}
              height={14}
              rx={2}
              fill={item.color}
              opacity={0.85}
            />
            <text
              x={LABEL_W + barW + 6}
              y={y + 14}
              fontSize="10"
              fill="var(--muted-foreground)"
              fontFamily="'JetBrains Mono', monospace"
            >
              {item.count} ({pct}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TimelineChart() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const counts = [2, 2, 2, 2, 1, 0, 0, 1];
  const max = Math.max(...counts);
  const W = 340;
  const H = 60;
  const pad = 24;
  const colW = (W - pad * 2) / months.length;

  const points = months.map((_, i) => {
    const x = pad + i * colW + colW / 2;
    const y = H - 8 - (counts[i] / max) * (H - 20);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} width="100%" style={{ overflow: "visible" }}>
      {/* Gridline */}
      <line x1={pad} y1={H - 8} x2={W - pad} y2={H - 8} stroke="var(--border)" strokeWidth="1" />

      {/* Area fill */}
      <path
        d={`M ${points[0]} L ${points.join(" L ")} L ${pad + (months.length - 1) * colW + colW / 2},${H - 8} L ${pad + colW / 2},${H - 8} Z`}
        fill="#3757EB"
        opacity="0.12"
      />

      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#3757EB"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {points.map((pt, i) => {
        const [x, y] = pt.split(",").map(Number);
        return counts[i] > 0 ? (
          <circle key={i} cx={x} cy={y} r={3} fill="#3757EB" />
        ) : null;
      })}

      {/* Labels */}
      {months.map((m, i) => (
        <text
          key={m}
          x={pad + i * colW + colW / 2}
          y={H + 14}
          textAnchor="middle"
          fontSize="10"
          fill="var(--muted-foreground)"
          fontFamily="inherit"
        >
          {m}
        </text>
      ))}
    </svg>
  );
}

function ExportButton({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: "var(--radius)",
        border: `1px solid ${primary ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: primary ? "var(--primary)" : "transparent",
        color: primary ? "var(--primary-foreground)" : "var(--foreground)",
        fontFamily: "inherit",
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
