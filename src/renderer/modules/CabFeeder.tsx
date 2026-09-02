import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { FieldInfo, RecordInfo } from '../../main/ipcChannels'
import TypeBadge from '../components/TypeBadge'
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
    case 'rating': return `${value}/10`
    case 'percentage': return `${value}%`
    case 'duration': {
      const secs = Number(value)
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      if (h > 0) return `${h}h ${m}m`
      if (m > 0) return `${m}m ${s}s`
      return `${s}s`
    }
    case 'tags':
    case 'multichoice': {
      try {
        const arr = JSON.parse(String(value))
        if (Array.isArray(arr)) return arr.join(', ')
      } catch { /* fall through */ }
      return String(value)
    }
    default: return String(value)
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Main component ────────────────────────────────────────────────────────────

export default function CabFeeder() {
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
  // Kanban group-by field
  const [groupByFieldId, setGroupByFieldId] = useState<string | null>(null)
  const [groupByPanelOpen, setGroupByPanelOpen] = useState(false)
  // Calendar date field selector
  const [calFieldId, setCalFieldId] = useState<string | null>(null)
  const [pendingDraft, setPendingDraft] = useState<{ collectionId: string; values: Record<string, string | number | null> } | null>(null)

  // ── Load data ─────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const currentResult = await window.cabinet.current()
      if (!currentResult.ok || !currentResult.data) {
        setNoCabinet(true); setFields([]); setRecords([]); return
      }
      setNoCabinet(false)
      const [fieldsResult, recordsResult] = await Promise.all([
        ipcField.list(), ipcRecord.list(),
      ])
      if (!fieldsResult.ok) throw new Error(fieldsResult.error)
      if (!recordsResult.ok) throw new Error(recordsResult.error)
      setFields(fieldsResult.data)
      setRecords(recordsResult.data)
      setColWidths([36, ...fieldsResult.data.map(() => 160), 28])

      // Auto-select first choice field for kanban group-by if not set
      if (!groupByFieldId) {
        const choiceField = fieldsResult.data.find(f => f.type === 'choice' || f.type === 'multichoice')
        if (choiceField) setGroupByFieldId(choiceField.id)
      }
      // Auto-select first date field for calendar if not set
      if (!calFieldId) {
        const dateField = fieldsResult.data.find(f => f.type === 'date' || f.type === 'datetime')
        if (dateField) setCalFieldId(dateField.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [groupByFieldId, calFieldId])

  useEffect(() => { refresh() }, [refresh])

  // ── Filtered & sorted ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = (findMode ? findQuery : query).toLowerCase().trim()
    let result = q
      ? records.filter(r => fields.some(f => {
          const v = r.values[f.id]
          return v !== null && v !== undefined && String(v).toLowerCase().includes(q)
        }))
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

  async function handleNewRecord(prefillValues?: Record<string, string | number | null>) {
    const draftResult = await ipcRecord.draft()
    if (!draftResult.ok) { setError(draftResult.error); return }
    // Merge prefill values (e.g. kanban column value, calendar date)
    const values = { ...draftResult.data.values, ...prefillValues }
    // Open detail panel with draft — user fills required fields and clicks Save
    setPendingDraft({ collectionId: draftResult.data.collectionId, values })
    setSelectedId(null)
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
    if (field.type === 'integer' || field.type === 'yesno') value = cellDraft === '' ? null : parseInt(cellDraft, 10)
    else if (field.type === 'decimal') value = cellDraft === '' ? null : parseFloat(cellDraft)
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

  // ── Recycle ───────────────────────────────────────────────────────────────

  async function handleRecycle(id: string) {
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

  // ── Kanban: move card to column ───────────────────────────────────────────

  async function handleKanbanMove(recordId: string, newValue: string | null) {
    if (!groupByFieldId) return
    const result = await ipcRecord.update({ id: recordId, values: { [groupByFieldId]: newValue } })
    if (!result.ok) { setError(result.error); return }
    setRecords(prev => prev.map(r => r.id === recordId ? result.data : r))
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

  // ── No cabinet ────────────────────────────────────────────────────────────

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

  const seqWidth = colWidths[0] ?? 36
  const actionWidth = colWidths[colWidths.length - 1] ?? 28

  // ── Choice fields for kanban group-by selector ────────────────────────────
  const choiceFields = fields.filter(f => f.type === 'choice' || f.type === 'multichoice' || f.type === 'yesno')
  const dateFields = fields.filter(f => f.type === 'date' || f.type === 'datetime')

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

        {/* Kanban: group-by selector */}
        {viewMode === 'kanban' && choiceFields.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setGroupByPanelOpen(o => !o)} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
              border: `1px solid ${groupByFieldId ? 'var(--primary)' : 'var(--border)'}`,
              backgroundColor: groupByFieldId ? 'var(--secondary)' : 'transparent',
              color: groupByFieldId ? 'var(--primary)' : 'var(--muted-foreground)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Group by: {groupByFieldId ? (fields.find(f => f.id === groupByFieldId)?.name ?? '…') : 'none'}
            </button>
            {groupByPanelOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: 6, minWidth: 160,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}>
                {choiceFields.map(f => (
                  <button key={f.id} onClick={() => { setGroupByFieldId(f.id); setGroupByPanelOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', fontSize: 12,
                      padding: '5px 8px', border: 'none', borderRadius: 2,
                      backgroundColor: groupByFieldId === f.id ? 'var(--secondary)' : 'transparent',
                      color: groupByFieldId === f.id ? 'var(--primary)' : 'var(--foreground)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>{f.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar: date field selector */}
        {viewMode === 'calendar' && dateFields.length > 1 && (
          <select value={calFieldId ?? ''} onChange={e => setCalFieldId(e.target.value || null)}
            style={{
              fontSize: 11, padding: '3px 6px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', backgroundColor: 'var(--background)',
              color: 'var(--foreground)', fontFamily: 'inherit', cursor: 'pointer',
            }}>
            {dateFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}

        {/* Find */}
        <button onClick={() => setFindMode(f => !f)} style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
          border: `1px solid ${findMode ? 'var(--primary)' : 'var(--border)'}`,
          backgroundColor: findMode ? 'var(--secondary)' : 'transparent',
          color: findMode ? 'var(--primary)' : 'var(--muted-foreground)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Find</button>

        {findMode && (
          <input autoFocus value={findQuery} onChange={e => setFindQuery(e.target.value)}
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
        }}>Sort{sorts.length > 0 ? ` (${sorts.length})` : ''}</button>

        <div className="ml-auto flex items-center gap-2">
          {error && <span style={{ fontSize: 11, color: '#F07070' }}>{error}</span>}
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {loading ? '…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
          </span>
          <button onClick={openRecycleBin} title="Recycle Bin" style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', backgroundColor: 'transparent',
            color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'inherit',
          }}>🗑</button>
          <button onClick={() => handleNewRecord()} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius)',
            border: 'none', backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}>+ New</button>
        </div>
      </div>

      {/* Sort panel */}
      {sortPanelOpen && (
        <SortPanel fields={fields} sorts={sorts} onChange={setSorts} onClose={() => setSortPanelOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Loading…</span>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView
            records={filtered} fields={fields} colWidths={colWidths}
            seqWidth={seqWidth} actionWidth={actionWidth}
            selectedId={selectedId} editingCell={editingCell} cellDraft={cellDraft}
            onSelect={(id) => { setSelectedId(id); setDetailOpen(true) }}
            onResizeStart={onResizeStart}
            onCellClick={startCellEdit}
            onCellChange={setCellDraft}
            onCellBlur={commitCellEdit}
            onCellKeyDown={(e) => { if (e.key === 'Enter') commitCellEdit(); if (e.key === 'Escape') setEditingCell(null) }}
            onRecycle={handleRecycle}
          />
        ) : viewMode === 'kanban' ? (
          <KanbanView
            records={filtered} fields={fields}
            groupByFieldId={groupByFieldId}
            primaryField={fields.find(f => f.isPrimary) ?? null}
            onCardClick={(id) => { setSelectedId(id); setDetailOpen(true) }}
            onCardRecycle={handleRecycle}
            onCardMove={handleKanbanMove}
            onNewInColumn={(value) => handleNewRecord(groupByFieldId ? { [groupByFieldId]: value } : undefined)}
          />
        ) : (
          <CalendarView
            records={filtered} fields={fields}
            calDate={calDate} calMode={calMode}
            calFieldId={calFieldId}
            primaryField={fields.find(f => f.isPrimary) ?? null}
            setCalDate={setCalDate} setCalMode={setCalMode}
            onRecordClick={(id) => { setSelectedId(id); setDetailOpen(true) }}
            onNewRecord={(date) => handleNewRecord(calFieldId ? { [calFieldId]: date } : undefined)}
          />
        )}

        {/* Detail panel */}
        {detailOpen && selectedRecord && (
          <DetailPanel
            record={selectedRecord} fields={fields}
            onSave={handleDetailSave}
            onClose={() => setDetailOpen(false)}
            onRecycle={() => handleRecycle(selectedRecord.id)}
          />
        )}
      </div>

      {/* Recycle bin modal */}
      {recycleBinOpen && (
        <RecycleBinModal
          records={recycledRecords} fields={fields}
          onRestore={handleRestore}
          onDelete={handlePermanentDelete}
          onClose={() => setRecycleBinOpen(false)}
        />
      )}
    </div>
  )
}

// ── Grid view ─────────────────────────────────────────────────────────────────

function GridView({ records, fields, colWidths, seqWidth, actionWidth, selectedId, editingCell, cellDraft, onSelect, onResizeStart, onCellClick, onCellChange, onCellBlur, onCellKeyDown, onRecycle }: {
  records: RecordInfo[]; fields: FieldInfo[]; colWidths: number[]; seqWidth: number; actionWidth: number
  selectedId: string | null; editingCell: { recordId: string; fieldId: string } | null; cellDraft: string
  onSelect: (id: string) => void; onResizeStart: (e: React.MouseEvent, idx: number) => void
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
              <span style={{ color: 'var(--foreground)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            </div>
            <div onMouseDown={(e) => onResizeStart(e, i + 1)}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize' }}
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
          cursor: 'pointer', minHeight: 36,
        }} onClick={() => onSelect(record.id)}>
          <div style={{ width: seqWidth, minWidth: seqWidth, padding: '6px 8px', color: 'var(--muted-foreground)', flexShrink: 0 }}>
            {record.sequence}
          </div>
          {fields.map((f, i) => {
            const value = record.values[f.id] ?? null
            const isEditing = editingCell?.recordId === record.id && editingCell?.fieldId === f.id
            return (
              <div key={f.id} style={{ width: colWidths[i + 1] ?? 160, minWidth: 60, flexShrink: 0, padding: '2px 4px' }}
                onClick={e => { e.stopPropagation(); onCellClick(record.id, f.id, value) }}>
                {isEditing ? (
                  <input autoFocus value={cellDraft} onChange={e => onCellChange(e.target.value)}
                    onBlur={onCellBlur} onKeyDown={onCellKeyDown}
                    style={{
                      width: '100%', fontSize: 12, padding: '3px 4px',
                      border: '1px solid var(--primary)', borderRadius: 2,
                      backgroundColor: 'var(--background)', color: 'var(--foreground)',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                    onClick={e => e.stopPropagation()} />
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

// ── Kanban view ───────────────────────────────────────────────────────────────

interface KanbanViewProps {
  records: RecordInfo[]
  fields: FieldInfo[]
  groupByFieldId: string | null
  primaryField: FieldInfo | null
  onCardClick: (id: string) => void
  onCardRecycle: (id: string) => void
  onCardMove: (recordId: string, newValue: string | null) => void
  onNewInColumn: (value: string | null) => void
}

function KanbanView({ records, fields, groupByFieldId, primaryField, onCardClick, onCardRecycle, onCardMove, onNewInColumn }: KanbanViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const groupField = groupByFieldId ? fields.find(f => f.id === groupByFieldId) : null

  if (!groupField) {
    return (
      <div className="flex flex-1 items-center justify-center flex-col gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <p style={{ fontSize: 13 }}>Kanban requires a choice or yes/no field</p>
        <p style={{ fontSize: 11 }}>Add a choice field in Cab Designer, then select it with "Group by"</p>
      </div>
    )
  }

  // Build columns from distinct values in the group-by field + "No value" column
  const valueSet = new Set<string>()
  for (const r of records) {
    const v = r.values[groupField.id]
    if (v !== null && v !== undefined) valueSet.add(String(v))
  }

  // For yesno fields use fixed columns
  let columns: Array<{ value: string | null; label: string }> = []
  if (groupField.type === 'yesno') {
    columns = [
      { value: '1', label: 'Yes' },
      { value: '0', label: 'No' },
      { value: null, label: 'No value' },
    ]
  } else {
    columns = [
      ...Array.from(valueSet).map(v => ({ value: v, label: v })),
      { value: null, label: 'No value' },
    ]
  }

  function getColumnRecords(colValue: string | null): RecordInfo[] {
    return records.filter(r => {
      const v = r.values[groupField!.id]
      if (colValue === null) return v === null || v === undefined || v === ''
      return String(v) === colValue
    })
  }

  function handleDragStart(e: React.DragEvent, recordId: string) {
    setDraggedId(recordId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, colValue: string | null) {
    e.preventDefault()
    if (!draggedId) return
    onCardMove(draggedId, colValue)
    setDraggedId(null)
    setDragOverCol(null)
  }

  const getPrimaryLabel = (record: RecordInfo) => {
    if (!primaryField) return `#${record.sequence}`
    const v = record.values[primaryField.id]
    return v !== null && v !== undefined ? String(v) : `#${record.sequence}`
  }

  return (
    <div className="flex flex-1 overflow-x-auto overflow-y-hidden" style={{ padding: 12, gap: 10, display: 'flex', alignItems: 'flex-start' }}>
      {columns.map(col => {
        const colRecords = getColumnRecords(col.value)
        const isOver = dragOverCol === (col.value ?? '__null__')
        return (
          <div
            key={col.value ?? '__null__'}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.value ?? '__null__') }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col.value)}
            style={{
              width: 220, minWidth: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
              backgroundColor: isOver ? 'var(--secondary)' : 'var(--background)',
              border: `1px solid ${isOver ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', overflow: 'hidden',
              transition: 'border-color 0.1s, background-color 0.1s',
              maxHeight: '100%',
            }}
          >
            {/* Column header */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {col.label}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                {colRecords.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {colRecords.map(record => (
                <div
                  key={record.id}
                  draggable
                  onDragStart={e => handleDragStart(e, record.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => onCardClick(record.id)}
                  style={{
                    backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '8px 10px', cursor: 'pointer',
                    opacity: draggedId === record.id ? 0.4 : 1,
                    transition: 'opacity 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {getPrimaryLabel(record)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); onCardRecycle(record.id) }}
                      style={{ fontSize: 10, padding: '0 2px', border: 'none', background: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', flexShrink: 0 }}
                    >✕</button>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', marginTop: 4, display: 'block' }}>
                    #{record.sequence}
                  </span>
                  {/* Show up to 2 secondary field values */}
                  {fields.filter(f => !f.isPrimary && f.id !== groupByFieldId).slice(0, 2).map(f => {
                    const v = record.values[f.id]
                    if (v === null || v === undefined) return null
                    return (
                      <div key={f.id} style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3, display: 'flex', gap: 4 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}: {formatValue(f, v)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Add card button */}
              <button
                onClick={() => onNewInColumn(col.value)}
                style={{
                  width: '100%', padding: '6px 0', fontSize: 11, border: '1px dashed var(--border)',
                  borderRadius: 4, backgroundColor: 'transparent', color: 'var(--muted-foreground)',
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 2,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
              >
                + Add record
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────

interface CalendarViewProps {
  records: RecordInfo[]
  fields: FieldInfo[]
  calDate: Date
  calMode: 'monthly' | 'daily'
  calFieldId: string | null
  primaryField: FieldInfo | null
  setCalDate: (d: Date) => void
  setCalMode: (m: 'monthly' | 'daily') => void
  onRecordClick: (id: string) => void
  onNewRecord: (date: string) => void
}

function CalendarView({ records, fields, calDate, calMode, calFieldId, primaryField, setCalDate, setCalMode, onRecordClick, onNewRecord }: CalendarViewProps) {
  const dateField = calFieldId ? fields.find(f => f.id === calFieldId) : fields.find(f => f.type === 'date' || f.type === 'datetime')

  if (!dateField) {
    return (
      <div className="flex flex-1 items-center justify-center flex-col gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <p style={{ fontSize: 13 }}>Calendar requires a date field</p>
        <p style={{ fontSize: 11 }}>Add a date field in Cab Designer first</p>
      </div>
    )
  }

  const getPrimaryLabel = (record: RecordInfo) => {
    if (!primaryField) return `#${record.sequence}`
    const v = record.values[primaryField.id]
    return v !== null && v !== undefined ? String(v) : `#${record.sequence}`
  }

  if (calMode === 'monthly') {
    const year = calDate.getFullYear()
    const month = calDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)

    // Group records by day
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

    const today = new Date()
    const isToday = (day: number) =>
      today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

    return (
      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))} style={calNavBtn}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', minWidth: 140, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))} style={calNavBtn}>›</button>
          <button onClick={() => setCalDate(new Date())} style={{ ...calNavBtn, marginLeft: 8 }}>Today</button>
          <button onClick={() => setCalMode('daily')} style={{ ...calNavBtn, marginLeft: 'auto' }}>Day view</button>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flex: 1, overflow: 'hidden' }}>
          {/* Day headers */}
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ padding: '4px 8px', fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, textAlign: 'center' }}>{d}</div>
          ))}
          {/* Day cells */}
          {cells.map((day, i) => (
            <div key={i} style={{
              padding: '4px 6px', minHeight: 72,
              backgroundColor: day ? (isToday(day) ? 'rgba(55,87,235,0.08)' : 'var(--card)') : 'transparent',
              border: day ? `1px solid ${isToday(day) ? 'var(--primary)' : 'var(--border)'}` : 'none',
              borderRadius: 2, overflow: 'hidden', cursor: day ? 'pointer' : 'default',
            }}
              onClick={() => {
                if (!day) return
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                onNewRecord(dateStr)
              }}
            >
              {day && (
                <>
                  <span style={{ fontSize: 11, color: isToday(day) ? 'var(--primary)' : 'var(--muted-foreground)', fontWeight: isToday(day) ? 600 : 400 }}>
                    {day}
                  </span>
                  {(recordsByDay[day] ?? []).slice(0, 3).map(r => (
                    <div key={r.id}
                      onClick={e => { e.stopPropagation(); onRecordClick(r.id) }}
                      style={{
                        fontSize: 10, padding: '1px 4px', marginTop: 2, borderRadius: 2,
                        backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}>
                      {getPrimaryLabel(r)}
                    </div>
                  ))}
                  {(recordsByDay[day]?.length ?? 0) > 3 && (
                    <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 1 }}>
                      +{recordsByDay[day].length - 3} more
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Daily view
  const year = calDate.getFullYear()
  const month = calDate.getMonth()
  const day = calDate.getDate()

  // Group records by hour
  const recordsByHour: Record<number, RecordInfo[]> = {}
  for (const r of records) {
    const v = r.values[dateField.id]
    if (!v) continue
    const d = new Date(String(v))
    if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      const h = dateField.type === 'datetime' ? d.getHours() : 0
      if (!recordsByHour[h]) recordsByHour[h] = []
      recordsByHour[h].push(r)
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const todayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 0 }}>
        <button onClick={() => setCalDate(new Date(calDate.getTime() - 86400000))} style={calNavBtn}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', minWidth: 200, textAlign: 'center' }}>
          {DAYS_SHORT[calDate.getDay()]}, {MONTH_SHORT[month]} {day} {year}
        </span>
        <button onClick={() => setCalDate(new Date(calDate.getTime() + 86400000))} style={calNavBtn}>›</button>
        <button onClick={() => setCalDate(new Date())} style={{ ...calNavBtn, marginLeft: 8 }}>Today</button>
        <button onClick={() => setCalMode('monthly')} style={{ ...calNavBtn, marginLeft: 'auto' }}>Month view</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {hours.map(h => (
          <div key={h} style={{
            display: 'flex', gap: 12, padding: '4px 0',
            borderBottom: '1px solid var(--border)', minHeight: 40,
            cursor: 'pointer',
          }}
            onClick={() => onNewRecord(dateField.type === 'datetime'
              ? `${todayDateStr}T${String(h).padStart(2, '0')}:00`
              : todayDateStr
            )}
          >
            <span style={{ width: 44, fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0, paddingTop: 4 }}>
              {String(h).padStart(2, '0')}:00
            </span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' }}>
              {(recordsByHour[h] ?? []).map(r => (
                <div key={r.id}
                  onClick={e => { e.stopPropagation(); onRecordClick(r.id) }}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 2,
                    backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)',
                    cursor: 'pointer', maxWidth: 200,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                  {getPrimaryLabel(r)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const calNavBtn: React.CSSProperties = {
  fontSize: 14, padding: '3px 10px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', backgroundColor: 'transparent',
  color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit',
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ record, fields, isNew, onSave, onClose, onRecycle }: {
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
  const title = isNew ? 'New Record' : (primaryField ? (values[primaryField.id] !== null ? String(values[primaryField.id]) : '—') : `Record #${record.sequence}`)

  return (
    <div className="flex flex-col shrink-0" style={{ width: 280, borderLeft: '1px solid var(--border)', backgroundColor: 'var(--card)', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>Record #{record.sequence}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 14px' }}>
        {fields.map(field => (
          <div key={field.id} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>
              {field.name} {field.required && <span style={{ color: '#BD2A49' }}>*</span>}
            </label>
            <FieldInput field={field} value={values[field.id] ?? null} onChange={v => setValues(prev => ({ ...prev, [field.id]: v }))} />
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onRecycle} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'inherit' }}>Recycle</button>
        <div style={{ flex: 1 }}/>
        <button onClick={onClose} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={() => onSave(values)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 'var(--radius)', border: 'none', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>{isNew ? 'Create' : 'Save'}</button>
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
        <option value="">—</option><option value="1">Yes</option><option value="0">No</option>
      </select>
    )
  }
  if (field.type === 'multiline') {
    return <textarea value={value !== null ? String(value) : ''} onChange={e => onChange(e.target.value || null)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
  }
  if (field.type === 'tags' || field.type === 'multichoice') {
    return (
      <textarea
        value={value !== null ? (() => { try { const a = JSON.parse(String(value)); return Array.isArray(a) ? a.join('\n') : String(value) } catch { return String(value) } })() : ''}
        onChange={e => {
          const lines = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
          onChange(lines.length ? JSON.stringify(lines) : null)
        }}
        rows={3} placeholder="One per line"
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    )
  }

  const inputType = field.type === 'integer' || field.type === 'decimal' || field.type === 'currency' || field.type === 'rating' || field.type === 'percentage' || field.type === 'duration' ? 'number'
    : field.type === 'date' ? 'date'
    : field.type === 'datetime' ? 'datetime-local'
    : field.type === 'time' ? 'time'
    : field.type === 'email' ? 'email'
    : field.type === 'url' ? 'url'
    : field.type === 'phone' ? 'tel'
    : 'text'

  return (
    <input type={inputType}
      value={value !== null ? String(value) : ''}
      onChange={e => {
        const v = e.target.value
        if (v === '') { onChange(null); return }
        if (field.type === 'integer' || field.type === 'duration') onChange(parseInt(v, 10))
        else if (field.type === 'decimal' || field.type === 'currency' || field.type === 'rating' || field.type === 'percentage') onChange(parseFloat(v))
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
