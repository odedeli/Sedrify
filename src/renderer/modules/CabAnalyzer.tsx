import { useState, useEffect, useCallback, useMemo } from 'react'
import type { FieldInfo, RecordInfo, CabinetInfo } from '../../main/ipcChannels'
import { ipcField, ipcRecord } from '../lib/ipc'

// ── Colour palette for charts ─────────────────────────────────────────────────

const CHART_COLOURS = [
  '#6184EF', '#41C0C2', '#F5848F', '#8279EF', '#F7B750',
  '#BD2A49', '#DE38C4', '#4DE491', '#83CFF7', '#F7B09A',
  '#A6ABB7', '#C0C4CD', '#3757EB', '#52D9A0', '#FF8C42',
]

function colourFor(index: number): string {
  return CHART_COLOURS[index % CHART_COLOURS.length]
}

// ── Type label map ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  'text': 'Text', 'multiline': 'Multiline', 'integer': 'Integer',
  'decimal': 'Decimal', 'date': 'Date', 'datetime': 'DateTime',
  'yesno': 'Yes/No', 'choice': 'Choice', 'linked-file': 'Linked File',
  'embedded-file': 'Embedded', 'url': 'URL', 'email': 'Email',
  'phone': 'Phone', 'currency': 'Currency', 'rating': 'Rating',
  'percentage': 'Percentage', 'time': 'Time', 'duration': 'Duration',
  'tags': 'Tags', 'multichoice': 'Multi-choice', 'lookup': 'Lookup',
  'formula': 'Formula',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return '—' }
}

// ── Bar chart component ───────────────────────────────────────────────────────

interface BarChartItem { label: string; count: number; color: string }

function BarChart({ data, title }: { data: BarChartItem[]; title: string }) {
  const max = Math.max(...data.map(d => d.count), 1)

  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 16 }}>{title}</p>
      {data.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', padding: '20px 0' }}>No data</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <div style={{ flex: 1, height: 18, backgroundColor: 'var(--secondary)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${(item.count / max) * 100}%`,
                  height: '100%',
                  backgroundColor: item.color,
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                  minWidth: item.count > 0 ? 4 : 0,
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--foreground)', width: 24, textAlign: 'right', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Timeline chart ────────────────────────────────────────────────────────────

function TimelineChart({ records }: { records: RecordInfo[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of records) {
      const d = new Date(r.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      counts[key] = (counts[key] ?? 0) + 1
    }
    const keys = Object.keys(counts).sort()
    return keys.map((k, i) => ({ label: k, count: counts[k], color: colourFor(i) }))
  }, [records])

  return <BarChart data={data} title="Records created over time" />
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      backgroundColor: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px 16px', flex: 1, minWidth: 120,
    }}>
      <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>
        {label.toUpperCase()}
      </p>
      <p style={{
        fontSize: 22, fontWeight: 600, color: 'var(--foreground)',
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
      }}>
        {value}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CabAnalyzer() {
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [records, setRecords] = useState<RecordInfo[]>([])
  const [cabinet, setCabinet] = useState<CabinetInfo | null>(null)
  const [noCabinet, setNoCabinet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const currentResult = await window.cabinet.current()
      if (!currentResult.ok || !currentResult.data) {
        setNoCabinet(true)
        return
      }
      setNoCabinet(false)
      setCabinet(currentResult.data)

      const [fieldsResult, recordsResult] = await Promise.all([
        ipcField.list(),
        ipcRecord.list(),
      ])
      if (!fieldsResult.ok) throw new Error(fieldsResult.error)
      if (!recordsResult.ok) throw new Error(recordsResult.error)
      setFields(fieldsResult.data)
      setRecords(recordsResult.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ── Derived chart data ─────────────────────────────────────────────────────

  const genreChartData = useMemo((): BarChartItem[] => {
    // Find a choice field — prefer one named 'genre', else first choice field
    const choiceField = fields.find(f => f.name.toLowerCase() === 'genre')
      ?? fields.find(f => f.type === 'choice')
    if (!choiceField) return []

    const counts: Record<string, number> = {}
    for (const r of records) {
      const v = r.values[choiceField.id]
      if (v === null || v === undefined) continue
      const key = String(v)
      counts[key] = (counts[key] ?? 0) + 1
    }

    // Map option IDs to labels using the field options config
    // Options are stored as choice option UUIDs — try to resolve to label
    // Since we don't have choice options in the renderer, use raw value for now
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count], i) => ({
        label: label.length > 12 ? label.slice(0, 12) + '…' : label,
        count,
        color: colourFor(i),
      }))
  }, [fields, records])

  const fieldTypeChartData = useMemo((): BarChartItem[] => {
    const counts: Record<string, number> = {}
    for (const f of fields) {
      counts[f.type] = (counts[f.type] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({
        label: TYPE_LABELS[type] ?? type,
        count,
        color: colourFor(i),
      }))
  }, [fields])

  // ── Stat tile values ───────────────────────────────────────────────────────

  const fileSize = useMemo(() => {
    // Estimate: SQLite page size 4096, rough estimate from record/field count
    const estimated = 32768 + records.length * 512 + fields.length * 256
    return formatFileSize(estimated)
  }, [records, fields])

  const lastSaved = useMemo(() => {
    if (!cabinet) return '—'
    return formatRelativeTime(cabinet.updatedAt)
  }, [cabinet])

  // ── No cabinet ─────────────────────────────────────────────────────────────

  if (noCabinet) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40 }}>
          <path d="M2 36l10-12 8 8 10-14 10 10M2 36h44" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p style={{ fontSize: 13 }}>No cabinet open — open one in Cab Explorer</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-auto" style={{ height: '100%', backgroundColor: 'var(--background)' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0 px-4" style={{ height: 44, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
          {cabinet?.name ?? 'Analyzer'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {error && <span style={{ fontSize: 11, color: '#F07070' }}>{error}</span>}
          {loading && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Loading…</span>}
          <button onClick={refresh} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', backgroundColor: 'transparent',
            color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'inherit',
          }}>↺ Refresh</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stat tiles */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatTile label="Records" value={String(records.length)} mono />
          <StatTile label="Fields" value={String(fields.length)} mono />
          <StatTile label="Est. size" value={fileSize} mono />
          <StatTile label="Cabinet updated" value={lastSaved} />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {genreChartData.length > 0 ? (
            <BarChart
              data={genreChartData}
              title={`Records by ${fields.find(f => f.type === 'choice')?.name ?? 'Choice field'}`}
            />
          ) : (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>No choice field — add one in Cab Designer</p>
            </div>
          )}
          <BarChart data={fieldTypeChartData} title="Fields by type" />
        </div>

        {/* Timeline */}
        <TimelineChart records={records} />

        {/* Field summary table */}
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>Field summary</p>
          {fields.length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>No fields defined</p>
          ) : (
            <div style={{ fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 60px 60px', gap: '6px 12px', padding: '4px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                {['Field', 'Type', 'Required', 'Primary'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>{h.toUpperCase()}</span>
                ))}
              </div>
              {fields.map(f => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 60px 60px', gap: '6px 12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>{TYPE_LABELS[f.type] ?? f.type}</span>
                  <span style={{ color: f.required ? '#4DE491' : 'var(--muted-foreground)' }}>{f.required ? '✓' : '—'}</span>
                  <span style={{ color: f.isPrimary ? 'var(--primary)' : 'var(--muted-foreground)' }}>{f.isPrimary ? '✓' : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
