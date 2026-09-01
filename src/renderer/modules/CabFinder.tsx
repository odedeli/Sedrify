import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { FieldInfo, RecordInfo } from '../../main/ipcChannels'
import TypeBadge from '../components/TypeBadge'
import { ipcField, ipcRecord } from '../lib/ipc'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecordHit {
  record: RecordInfo
  matchingField: FieldInfo
  matchedValue: string
}

interface FieldHit {
  field: FieldInfo
}

const RECENT_KEY = 'sedrify_finder_recent'
const MAX_RECENT = 8

// ── Highlight helper ──────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: '#3757EB33', color: 'var(--primary)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CabFinder() {
  const [query, setQuery] = useState('')
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [records, setRecords] = useState<RecordInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [noCabinet, setNoCabinet] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
  })
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Keyboard shortcut: / to focus ─────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Load data ──────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true)
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
      if (fieldsResult.ok) setFields(fieldsResult.data)
      if (recordsResult.ok) setRecords(recordsResult.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ── Search results ─────────────────────────────────────────────────────────

  const primaryField = useMemo(() => fields.find(f => f.isPrimary), [fields])

  const { recordHits, fieldHits } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { recordHits: [], fieldHits: [] }

    // Record hits — search all field values
    const recordHits: RecordHit[] = []
    for (const record of records) {
      for (const field of fields) {
        const value = record.values[field.id]
        if (value === null || value === undefined) continue
        const str = String(value).toLowerCase()
        if (str.includes(q)) {
          recordHits.push({ record, matchingField: field, matchedValue: String(value) })
          break // one hit per record
        }
      }
    }

    // Field hits — search field names
    const fieldHits: FieldHit[] = fields
      .filter(f => f.name.toLowerCase().includes(q))
      .map(f => ({ field: f }))

    return { recordHits, fieldHits }
  }, [query, records, fields])

  const totalResults = recordHits.length + fieldHits.length

  // ── Save recent search ─────────────────────────────────────────────────────

  function saveRecent(q: string) {
    if (!q.trim()) return
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, MAX_RECENT)
    setRecentSearches(updated)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
  }

  function clearRecent() {
    setRecentSearches([])
    try { localStorage.removeItem(RECENT_KEY) } catch { /* ignore */ }
  }

  // ── No cabinet ─────────────────────────────────────────────────────────────

  if (noCabinet) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40 }}>
          <circle cx="22" cy="22" r="14"/><path d="M32 32L42 42" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: 13 }}>No cabinet open — open one in Cab Explorer</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', backgroundColor: 'var(--background)' }}>

      {/* Search bar */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) saveRecent(query.trim()) }}
            placeholder="Search records and fields… (press / to focus)"
            autoFocus
            style={{
              width: '100%', fontSize: 13, padding: '8px 36px 8px 32px',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              backgroundColor: 'var(--background)', color: 'var(--foreground)',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--muted-foreground)',
              cursor: 'pointer', fontSize: 12, padding: 2,
            }}>✕</button>
          )}
        </div>

        {query.trim() && (
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8 }}>
            {loading ? 'Searching…' : `${totalResults} result${totalResults !== 1 ? 's' : ''} — ${recordHits.length} record${recordHits.length !== 1 ? 's' : ''}, ${fieldHits.length} field${fieldHits.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 20px' }}>

        {/* Empty query — show recent searches */}
        {!query.trim() && (
          <div>
            {recentSearches.length > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>RECENT</span>
                  <button onClick={clearRecent} style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recentSearches.map(s => (
                    <button key={s} onClick={() => setQuery(s)} style={{
                      fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)', backgroundColor: 'var(--secondary)',
                      color: 'var(--secondary-foreground)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>{s}</button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)' }}>
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36, margin: '0 auto 12px', display: 'block' }}>
                  <circle cx="22" cy="22" r="14"/><path d="M32 32L42 42" strokeLinecap="round"/>
                </svg>
                <p style={{ fontSize: 13 }}>Search across all records and fields</p>
                <p style={{ fontSize: 11, marginTop: 6 }}>Press <kbd style={{ fontSize: 10, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3, backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}>/</kbd> to focus · <kbd style={{ fontSize: 10, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3, backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}>Esc</kbd> to clear</p>
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {query.trim() && totalResults === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)' }}>
            <p style={{ fontSize: 13 }}>No results for "{query}"</p>
            <p style={{ fontSize: 11, marginTop: 6 }}>Try a different search term</p>
          </div>
        )}

        {/* Record hits */}
        {recordHits.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.05em', marginBottom: 8 }}>
              RECORDS <span style={{ fontWeight: 400, marginLeft: 4 }}>({recordHits.length})</span>
            </p>
            {recordHits.map(({ record, matchingField, matchedValue }) => {
              const title = primaryField
                ? (record.values[primaryField.id] !== null ? String(record.values[primaryField.id]) : '—')
                : `Record #${record.sequence}`
              const isMatchingPrimary = primaryField?.id === matchingField.id

              return (
                <div key={record.id} style={{
                  padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', backgroundColor: 'var(--card)',
                  marginBottom: 6, cursor: 'default',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMatchingPrimary ? 0 : 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>#{record.sequence}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {isMatchingPrimary ? highlight(title, query) : title}
                    </span>
                  </div>
                  {!isMatchingPrimary && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <TypeBadge type={matchingField.type} size="xs" />
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{matchingField.name}:</span>
                      <span style={{ fontSize: 11, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {highlight(matchedValue, query)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Field hits */}
        {fieldHits.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.05em', marginBottom: 8 }}>
              FIELDS <span style={{ fontWeight: 400, marginLeft: 4 }}>({fieldHits.length})</span>
            </p>
            {fieldHits.map(({ field }) => (
              <div key={field.id} style={{
                padding: '8px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', backgroundColor: 'var(--card)',
                marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <TypeBadge type={field.type} size="xs" />
                <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                  {highlight(field.name, query)}
                </span>
                {field.isPrimary && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, border: '1px solid var(--primary)', color: 'var(--primary)', marginLeft: 'auto' }}>PRIMARY</span>
                )}
                {field.required && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, border: '1px solid var(--muted-foreground)', color: 'var(--muted-foreground)' }}>REQUIRED</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
