import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { FieldInfo, RecordInfo } from '../../main/ipcChannels'
import TypeBadge from '../components/TypeBadge'
import type { AppSettings } from './Settings'
import { ipcRecord, ipcField } from '../lib/ipc'

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'grid' | 'kanban' | 'calendar'
type SortItem = { fieldId: string; dir: 'asc' | 'desc' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(field: FieldInfo, value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (field.type) {
    case 'yesno': return value === 1 || value === '1' || value === true ? '✓ Yes' : '✗ No'
    case 'date': return String(value)
    case 'datetime': return String(value).replace('T', ' ').slice(0, 16)
    case 'integer': return String(value)
    case 'decimal': return Number(value).toFixed(2)
    default: return String(value)
  }
}

// ── Main component ────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface FeederProps { settings: AppSettings; onRecordsChange: () => void }
export default function CabFeeder({ settings, onRecordsChange }: FeederProps) {
  const [records, setRecords] = useState<RecordInfo[]>([])
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [query, setQuery] = useState('')
  const [sorts, setSorts] = useState<SortItem[]>([])
  const [sortPanelOpen, setSortPanelOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [findMode, setFindMode] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [recycleBinOpen, setRecycleBinOpen] = useState(false)
  const [recycledRecords, setRecycledRecords] = useState<RecordInfo[]>([])
  const [noCabinet, setNoCabinet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [colWidths, setColWidths] = useState<number[]>([])
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldId: string } | null>(null)
  const [cellDraft, setCellDraft] = useState<string>('')
  const [calDate, setCalDate] = useState(new Date())
  const [calMode, setCalMode] = useState<'monthly' | 'daily'>('monthly')

  // ── Load data ─────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const currentResult = await window.cabinet.current()
      if (!currentResult.ok || !currentResult.data) {
        setNoCabinet(true)
        setFields([])
        setRecords([])
        return
      }
      setNoCabinet(false)

      const [fieldsResult, recordsResult] = await Promise.all([
        ipcField.list(),
        ipcRecord.list(),
      ])

      if (!fieldsResult.ok) throw new Error(fieldsResult.error)
      if (!recordsResult.ok) throw new Error(recordsResult.error)

      setFields(fieldsResult.data)
      setRecords(recordsResult.data)
      setColWidths([36, ...fieldsResult.data.map(() => 160), 28])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ── Filtered & sorted records ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = (findMode ? findQuery : query).toLowerCase().trim()
    let result = q
      ? records.filter(r =>
          fields.some(f => {
            const v = r.values[f.id]
            return v !== null && v !== undefined && String(v).toLowerCase().includes(q)
          })
        )
      : [...records]

    if (sorts.length > 0) {
      result = [...result].sort((a, b) => {
        for (const s of sorts) {
          const va = a.values[s.fieldId] ?? ''
          const vb = b.values[s.fieldId] ?? ''
          const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
          if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp
        }
        return 0
      })
    }
    return result
  }, [records, fields, query, findQuery, findMode, sorts])

  const selectedRecord = useMemo(
    () => records.find(r => r.id === selectedId) ?? null,
    [records, selectedId]
  )

  // ── New record ────────────────────────────────────────────────────────────

  async function handleNewRecord() {
    const draftResult = await ipcRecord.draft()
    if (!draftResult.ok) { setError(draftResult.error); return }

    const saveResult = await ipcRecord.save({ values: draftResult.data.values })
    if (!saveResult.ok) { setError(saveResult.error); return }

    setRecords(prev => [...prev, saveResult.data])
    onRecordsChange()
    setSelectedId(saveResult.data.id)
    setDetailOpen(true)
  }

  // ── Inline cell edit ──────────────────────────────────────────────────────

  function startCellEdit(recordId: string, fieldId: string, currentValue: string | number | null) {
    setEditingCell({ recordId, fieldId })
    setCellDraft(currentValue !== null ? String(currentValue) : '')
  }

  async function commitCellEdit() {
    if (!editingCell) return
    const { recordId, fieldId } = editingCell
    setEditingCell(null)

    const field = fields.find(f => f.id === fieldId)
    if (!field) return

    let value: string | number | null = cellDraft === '' ? null : cellDraft
    if (field.type === 'integer' || field.type === 'yesno') {
      value = cellDraft === '' ? null : parseInt(cellDraft, 10)
    } else if (field.type === 'decimal') {
      value = cellDraft === '' ? null : parseFloat(cellDraft)
    }

    const result = await ipcRecord.update({ id: recordId, values: { [fieldId]: value } })
    if (!result.ok) { setError(result.error); return }

    setRecords(prev => prev.map(r => r.id === recordId ? result.data : r))
  }

  // ── Detail panel save ─────────────────────────────────────────────────────

  async function handleDetailSave(values: Record<string, string | number | null>) {
    if (!selectedId) return
    const result = await ipcRecord.update({ id: selectedId, values })
    if (!result.ok) { setError(result.error); return }
    setRecords(prev => prev.map(r => r.id === selectedId ? result.data : r))
    setDetailOpen(false)
  }

  // ── Recycle record ────────────────────────────────────────────────────────

  async function handleRecycle(id: string) {
    if (settings.confirmDelete) {
      const confirmed = window.confirm('Move this record to the recycle bin?')
      if (!confirmed) return
    }
    const result = await ipcRecord.recycle(id)
    if (!result.ok) { setError(result.error); return }
    setRecords(prev => prev.filter(r => r.id !== id))
    if (selectedId === id) { setSelectedId(null); setDetailOpen(false) }
  }

  // ── Recycle bin ───────────────────────────────────────────────────────────

  async function openRecycleBin() {
    const result = await ipcRecord.listRecycled()
    if (!result.ok) { setError(result.error); return }
    setRecycledRecords(result.data)
    setRecycleBinOpen(true)
  }

  async function handleRestore(id: string) {
    const result = await ipcRecord.restore(id)
    if (!result.ok) { setError(result.error); return }
    setRecycledRecords(prev => prev.filter(r => r.id !== id))
    setRecords(prev => [...prev, result.data])
  }

  async function handlePermanentDelete(id: string) {
    const confirmed = window.confirm('Permanently delete this record? This cannot be undone.')
    if (!confirmed) return
    const result = await ipcRecord.delete(id)
    if (!result.ok) { setError(result.error); return }
    setRecycledRecords(prev => prev.filter(r => r.id !== id))
  }

  // ── Column resize ─────────────────────────────────────────────────────────

  const resizingCol = useRef<{ idx: number; startX: number; startW: number } | null>(null)

  function onResizeStart(e: React.MouseEvent, idx: number) {
    e.preventDefault()
    resizingCol.current = { idx, startX: e.clientX, startW: colWidths[idx] ?? 160 }
    const onMove = (me: MouseEvent) => {
      if (!resizingCol.current) return
      const delta = me.clientX - resizingCol.current.startX
      setColWidths(prev => {
        const next = [...prev]
        next[resizingCol.current!.idx] = Math.max(60, resizingCol.current!.startW + delta)
        return next
      })
    }
    const onUp = () => { resizingCol.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── No cabinet state ──────────────────────────────────────────────────────

  if (noCabinet) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40 }}>
          <rect x="6" y="8" width="36" height="32" rx="2"/><path d="M6 16h36"/><path d="M16 28h16M16 33h10" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: 13 }}>No cabinet open — open one in Cab Explorer</p>
      </div>
    )
  }

  // ── Grid view ─────────────────────────────────────────────────────────────

  const seqWidth = colWidths[0] ?? 36
  const actionWidth = colWidths[colWidths.length - 1] ?? 28

  return (
    <div className="flex flex-col" style={{ height: '100%', backgroundColor: 'var(--background)' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0 px-3" style={{ height: 44, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
        {/* View mode */}
        <div className="flex" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {(['grid', 'kanban', 'calendar'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              fontSize: 11, padding: '3px 8px', border: 'none', fontFamily: 'inherit',
              backgroundColor: viewMode === v ? 'var(--secondary)' : 'transparent',
              color: viewMode === v ? 'var(--foreground)' : 'var(--muted-foreground)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{v}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, backgroundColor: 'var(--border)' }}/>

        {/* Find */}
        <button onClick={() => setFindMode(f => !f)} style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
          border: `1px solid ${findMode ? 'var(--primary)' : 'var(--border)'}`,
          backgroundColor: findMode ? 'var(--secondary)' : 'transparent',
          color: findMode ? 'var(--primary)' : 'var(--muted-foreground)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Find</button>

        {findMode && (
          <input
            autoFocus
            value={findQuery}
            onChange={e => setFindQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setFindMode(false)}
            placeholder="Search records…"
            style={{
              fontSize: 12, padding: '3px 8px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', backgroundColor: 'var(--background)',
              color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none', width: 200,
            }}
          />
        )}

        {/* Sort */}
        <button onClick={() => setSortPanelOpen(o => !o)} style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
          border: `1px solid ${sorts.length > 0 ? 'var(--primary)' : 'var(--border)'}`,
          backgroundColor: sorts.length > 0 ? 'var(--secondary)' : 'transparent',
          color: sorts.length > 0 ? 'var(--primary)' : 'var(--muted-foreground)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Sort{sorts.length > 0 ? ` (${sorts.length})` : ''}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {error && <span style={{ fontSize: 11, color: '#F07070' }}>{error}</span>}
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {loading ? '…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
          </span>
          {/* Recycle bin */}
          <button onClick={openRecycleBin} title="Recycle Bin" style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', backgroundColor: 'transparent',
            color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'inherit',
          }}>🗑</button>
          {/* New record */}
          <button onClick={handleNewRecord} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius)',
            border: 'none', backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}>+ New</button>
        </div>
      </div>

      {/* Sort panel */}
      {sortPanelOpen && (
        <SortPanel
          fields={fields}
          sorts={sorts}
          onChange={setSorts}
          onClose={() => setSortPanelOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Loading…</span>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView
            records={filtered}
            fields={fields}
            colWidths={colWidths}
            seqWidth={seqWidth}
            actionWidth={actionWidth}
            selectedId={selectedId}
            editingCell={editingCell}
            cellDraft={cellDraft}
            onSelect={(id) => { setSelectedId(id); setDetailOpen(true) }}
            onResizeStart={onResizeStart}
            onCellClick={startCellEdit}
            onCellChange={setCellDraft}
            onCellBlur={commitCellEdit}
            onCellKeyDown={(e) => { if (e.key === 'Enter') commitCellEdit(); if (e.key === 'Escape') setEditingCell(null) }}
            onRecycle={handleRecycle}
          />
        ) : viewMode === 'kanban' ? (
          <PlaceholderView label="Kanban view — post-MVP" />
        ) : (
          <CalendarView
            records={filtered}
            fields={fields}
            calDate={calDate}
            calMode={calMode}
            setCalDate={setCalDate}
            setCalMode={setCalMode}
          />
        )}

        {/* Detail panel */}
        {detailOpen && selectedRecord && (
          <DetailPanel
            record={selectedRecord}
            fields={fields}
            onSave={handleDetailSave}
            onClose={() => setDetailOpen(false)}
            onRecycle={() => handleRecycle(selectedRecord.id)}
          />
        )}
      </div>

      {/* Recycle bin modal */}
      {recycleBinOpen && (
        <RecycleBinModal
          records={recycledRecords}
          fields={fields}
          onRestore={handleRestore}
          onDelete={handlePermanentDelete}
          onClose={() => setRecycleBinOpen(false)}
        />
      )}
    </div>
  )
}

// ── Grid view ─────────────────────────────────────────────────────────────────

function GridView({ records, fields, colWidths, seqWidth, actionWidth, selectedId, editingCell, cellDraft, rowHeight, onSelect, onResizeStart, onCellClick, onCellChange, onCellBlur, onCellKeyDown, onRecycle }: {
  records: RecordInfo[]; fields: FieldInfo[]; colWidths: number[]; seqWidth: number; actionWidth: number
  selectedId: string | null; editingCell: { recordId: string; fieldId: string } | null; cellDraft: string
  rowHeight?: number; onSelect: (id: string) => void; onResizeStart: (e: React.MouseEvent, idx: number) => void
  onCellClick: (recordId: string, fieldId: string, value: string | number | null) => void
  onCellChange: (v: string) => void; onCellBlur: () => void
  onCellKeyDown: (e: React.KeyboardEvent) => void; onRecycle: (id: string) => void
}) {
  return (
    <div className="flex flex-col flex-1 overflow-auto" style={{ fontSize: 12 }}>
      {/* Header */}
      <div className="flex shrink-0 sticky top-0 z-10" style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: seqWidth, minWidth: seqWidth, padding: '6px 8px', color: 'var(--muted-foreground)', fontSize: 11, flexShrink: 0 }}>#</div>
        {fields.map((f, i) => (
          <div key={f.id} style={{ width: colWidths[i + 1] ?? 160, minWidth: 60, position: 'relative', flexShrink: 0 }}>
            <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
              <TypeBadge type={f.type} size="xs" />
              <span style={{ color: 'var(--foreground)', fontWeight: 500, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            </div>
            <div onMouseDown={(e) => onResizeStart(e, i + 1)} style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize',
              backgroundColor: 'transparent',
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            />
          </div>
        ))}
        <div style={{ width: actionWidth, minWidth: actionWidth, flexShrink: 0 }} />
      </div>

      {/* Rows */}
      {records.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
          No records yet — click + New to add one
        </div>
      ) : records.map(record => (
        <div key={record.id} className="flex" style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: selectedId === record.id ? 'var(--secondary)' : 'transparent',
          minHeight: rowHeight ?? 36,
          cursor: 'pointer',
        }}
          onClick={() => onSelect(record.id)}
        >
          <div style={{ width: seqWidth, minWidth: seqWidth, padding: '6px 8px', color: 'var(--muted-foreground)', flexShrink: 0 }}>
            {record.sequence}
          </div>
          {fields.map((f, i) => {
            const value = record.values[f.id] ?? null
            const isEditing = editingCell?.recordId === record.id && editingCell?.fieldId === f.id
            return (
              <div key={f.id} style={{ width: colWidths[i + 1] ?? 160, minWidth: 60, flexShrink: 0, padding: '2px 4px' }}
                onClick={e => { e.stopPropagation(); onCellClick(record.id, f.id, value) }}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={cellDraft}
                    onChange={e => onCellChange(e.target.value)}
                    onBlur={onCellBlur}
                    onKeyDown={onCellKeyDown}
                    style={{
                      width: '100%', fontSize: 12, padding: '3px 4px',
                      border: '1px solid var(--primary)', borderRadius: 2,
                      backgroundColor: 'var(--background)', color: 'var(--foreground)',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div style={{
                    padding: '3px 4px', borderRadius: 2, border: '1px solid transparent',
                    color: value === null ? 'var(--muted-foreground)' : 'var(--foreground)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {formatValue(f, value)}
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ width: actionWidth, minWidth: actionWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => onRecycle(record.id)} title="Recycle" style={{
              fontSize: 11, padding: '2px 4px', border: 'none', background: 'none',
              color: 'var(--muted-foreground)', cursor: 'pointer',
            }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ record, fields, onSave, onClose, onRecycle }: {
  record: RecordInfo; fields: FieldInfo[]
  onSave: (values: Record<string, string | number | null>) => void
  onClose: () => void; onRecycle: () => void
}) {
  const [values, setValues] = useState<Record<string, string | number | null>>(() => {
    const v: Record<string, string | number | null> = {}
    for (const f of fields) v[f.id] = record.values[f.id] ?? null
    return v
  })

  const primaryField = fields.find(f => f.isPrimary)
  const title = primaryField ? (values[primaryField.id] !== null ? String(values[primaryField.id]) : '—') : `Record #${record.sequence}`

  function handleChange(fieldId: string, value: string | number | null) {
    setValues(prev => ({ ...prev, [fieldId]: value }))
  }

  return (
    <div className="flex flex-col shrink-0" style={{ width: 280, borderLeft: '1px solid var(--border)', backgroundColor: 'var(--card)', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>Record #{record.sequence}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 14px' }}>
        {fields.map(field => (
          <div key={field.id} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>
              {field.name} {field.required && <span style={{ color: '#BD2A49' }}>*</span>}
            </label>
            <FieldInput field={field} value={values[field.id] ?? null} onChange={v => handleChange(field.id, v)} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onRecycle} style={{
          fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', backgroundColor: 'transparent',
          color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'inherit',
        }}>Recycle</button>
        <div style={{ flex: 1 }}/>
        <button onClick={onClose} style={{
          fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', backgroundColor: 'transparent',
          color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
        <button onClick={() => onSave(values)} style={{
          fontSize: 11, padding: '5px 12px', borderRadius: 'var(--radius)',
          border: 'none', backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
        }}>Save</button>
      </div>
    </div>
  )
}

// ── Field input ───────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }: {
  field: FieldInfo; value: string | number | null; onChange: (v: string | number | null) => void
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', backgroundColor: 'var(--background)',
    color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none',
  }

  if (field.type === 'yesno') {
    return (
      <select value={value === null ? '' : String(value)} onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value))} style={inputStyle}>
        <option value="">—</option>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
    )
  }

  if (field.type === 'multiline') {
    return (
      <textarea
        value={value !== null ? String(value) : ''}
        onChange={e => onChange(e.target.value || null)}
        rows={3}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    )
  }

  const inputType = field.type === 'integer' || field.type === 'decimal' ? 'number'
    : field.type === 'date' ? 'date'
    : field.type === 'datetime' ? 'datetime-local'
    : 'text'

  return (
    <input
      type={inputType}
      value={value !== null ? String(value) : ''}
      onChange={e => {
        const v = e.target.value
        if (v === '') { onChange(null); return }
        if (field.type === 'integer') onChange(parseInt(v, 10))
        else if (field.type === 'decimal') onChange(parseFloat(v))
        else onChange(v)
      }}
      style={inputStyle}
    />
  )
}

// ── Sort panel ────────────────────────────────────────────────────────────────

function SortPanel({ fields, sorts, onChange, onClose }: {
  fields: FieldInfo[]; sorts: SortItem[]
  onChange: (sorts: SortItem[]) => void; onClose: () => void
}) {
  return (
    <div style={{
      position: 'absolute', top: 44, left: 120, zIndex: 100,
      backgroundColor: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 12, minWidth: 260,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>Sort</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>
      {sorts.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <select value={s.fieldId} onChange={e => { const next = [...sorts]; next[i] = { ...s, fieldId: e.target.value }; onChange(next) }}
            style={{ flex: 1, fontSize: 11, padding: '3px 6px', borderRadius: 2, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', fontFamily: 'inherit' }}>
            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={() => { const next = [...sorts]; next[i] = { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }; onChange(next) }}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 2, border: '1px solid var(--border)', backgroundColor: 'var(--secondary)', color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {s.dir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
          <button onClick={() => onChange(sorts.filter((_, j) => j !== i))}
            style={{ fontSize: 11, padding: '3px 6px', border: 'none', background: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>✕</button>
        </div>
      ))}
      <button onClick={() => { if (fields.length > 0) onChange([...sorts, { fieldId: fields[0].id, dir: 'asc' }]) }}
        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, width: '100%' }}>
        + Add sort
      </button>
      {sorts.length > 0 && (
        <button onClick={() => onChange([])}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, border: 'none', backgroundColor: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, width: '100%' }}>
          Clear all
        </button>
      )}
    </div>
  )
}

// ── Recycle bin modal ─────────────────────────────────────────────────────────

function RecycleBinModal({ records, fields, onRestore, onDelete, onClose }: {
  records: RecordInfo[]; fields: FieldInfo[]
  onRestore: (id: string) => void; onDelete: (id: string) => void; onClose: () => void
}) {
  const primaryField = fields.find(f => f.isPrimary)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.4)' }}/>
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 201, width: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Recycle Bin</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {records.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: 24 }}>Recycle bin is empty</p>
          ) : records.map(r => {
            const title = primaryField ? (r.values[primaryField.id] !== null ? String(r.values[primaryField.id]) : '—') : `Record #${r.sequence}`
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 6, backgroundColor: 'var(--background)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>Record #{r.sequence}</p>
                </div>
                <button onClick={() => onRestore(r.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 2, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit' }}>Restore</button>
                <button onClick={() => onDelete(r.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 2, border: '1px solid #BD2A49', backgroundColor: '#3A0610', color: '#F07070', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function CalendarView({ records, fields, calDate, calMode, setCalDate, setCalMode }: {
  records: RecordInfo[]; fields: FieldInfo[]; calDate: Date
  calMode: 'monthly' | 'daily'; setCalDate: (d: Date) => void; setCalMode: (m: 'monthly' | 'daily') => void
}) {
  const dateField = fields.find(f => f.type === 'date' || f.type === 'datetime')
  const primaryField = fields.find(f => f.isPrimary)

  if (!dateField) {
    return <PlaceholderView label="Calendar view requires a date field" />
  }

  if (calMode === 'monthly') {
    const year = calDate.getFullYear()
    const month = calDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)

    const recordsByDay: Record<number, RecordInfo[]> = {}
    for (const r of records) {
      const v = r.values[dateField.id]
      if (!v) continue
      const d = new Date(String(v))
      if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!recordsByDay[day]) recordsByDay[day] = []
        recordsByDay[day].push(r)
      }
    }

    return (
      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))} style={calNavBtn}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{MONTHS[month]} {year}</span>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))} style={calNavBtn}>›</button>
          <button onClick={() => setCalMode('daily')} style={{ ...calNavBtn, marginLeft: 'auto' }}>Day</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flex: 1 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ padding: '4px 8px', fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>{d}</div>
          ))}
          {cells.map((day, i) => (
            <div key={i} style={{
              padding: '4px 8px', minHeight: 64, borderRadius: 2,
              backgroundColor: day ? 'var(--card)' : 'transparent',
              border: day ? '1px solid var(--border)' : 'none',
            }}>
              {day && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{day}</span>
                  {(recordsByDay[day] ?? []).map(r => {
                    const label = primaryField && r.values[primaryField.id] !== null ? String(r.values[primaryField.id]) : `#${r.sequence}`
                    return (
                      <div key={r.id} style={{ fontSize: 10, padding: '1px 4px', marginTop: 2, borderRadius: 2, backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Daily view
  const hours = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div className="flex flex-col flex-1 overflow-auto" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={() => setCalDate(new Date(calDate.getTime() - 86400000))} style={calNavBtn}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
          {DAYS_SHORT[calDate.getDay()]}, {MONTH_SHORT[calDate.getMonth()]} {calDate.getDate()} {calDate.getFullYear()}
        </span>
        <button onClick={() => setCalDate(new Date(calDate.getTime() + 86400000))} style={calNavBtn}>›</button>
        <button onClick={() => setCalMode('monthly')} style={{ ...calNavBtn, marginLeft: 'auto' }}>Month</button>
      </div>
      {hours.map(h => (
        <div key={h} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 40, fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>{String(h).padStart(2, '0')}:00</span>
          <div style={{ flex: 1 }}/>
        </div>
      ))}
    </div>
  )
}

const calNavBtn: React.CSSProperties = {
  fontSize: 14, padding: '3px 10px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', backgroundColor: 'transparent',
  color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit',
}

function PlaceholderView({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
      {label}
    </div>
  )
}
