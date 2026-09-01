// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — DevLog: Floating in-app log panel
// contextBridge objects are frozen — we log via a global event bus instead.
// Usage: import { ipc } from '../lib/ipc' — use ipc.cabinet.*, ipc.field.* etc.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react'

export type LogLevel = 'info' | 'success' | 'error' | 'warn'

export interface LogEntry {
  id: number
  timestamp: string
  level: LogLevel
  channel: string
  message: string
  data?: unknown
}

// ── Singleton event bus ───────────────────────────────────────────────────────

let nextId = 1
const listeners: Array<(entry: LogEntry) => void> = []

export function devLog(level: LogLevel, channel: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      fractionalSecondDigits: 3,
    }),
    level, channel, message, data,
  }
  listeners.forEach(fn => fn(entry))
  // Also log to console for terminal visibility
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.channel}]`
  if (level === 'error') console.error(prefix, message, data ?? '')
  else console.log(prefix, message, data ?? '')
}

export function useDevLogListener(onEntry: (entry: LogEntry) => void) {
  useEffect(() => {
    listeners.push(onEntry)
    return () => {
      const idx = listeners.indexOf(onEntry)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  }, [onEntry])
}

// ── Level colours ─────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<LogLevel, { fg: string; badge: string; badgeFg: string }> = {
  info:    { fg: '#A6ABB7', badge: '#393D46', badgeFg: '#A6ABB7' },
  success: { fg: '#4DE491', badge: '#052312', badgeFg: '#4DE491' },
  error:   { fg: '#F07070', badge: '#3A0610', badgeFg: '#F07070' },
  warn:    { fg: '#F7B750', badge: '#281A04', badgeFg: '#F7B750' },
}

interface DevLogProps { onClose: () => void }

export default function DevLog({ onClose }: DevLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const [pos, setPos] = useState({ x: 40, y: 80 })
  const [size, setSize] = useState({ w: 600, h: 380 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)

  const addEntry = useCallback((entry: LogEntry) => {
    setEntries(prev => [...prev.slice(-499), entry])
  }, [])

  useDevLogListener(addEntry)

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, autoScroll])

  function onHeaderMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    setDragging(true)
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => setPos({
      x: Math.max(0, e.clientX - dragOffset.current.x),
      y: Math.max(0, e.clientY - dragOffset.current.y),
    })
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  function onResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    setResizing(true)
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
  }

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: MouseEvent) => setSize({
      w: Math.max(360, resizeStart.current.w + e.clientX - resizeStart.current.x),
      h: Math.max(200, resizeStart.current.h + e.clientY - resizeStart.current.y),
    })
    const onUp = () => setResizing(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [resizing])

  function copyAll() {
    const text = filteredEntries.map(e => {
      const data = e.data !== undefined ? ' ' + JSON.stringify(e.data) : ''
      return `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.channel}] ${e.message}${data}`
    }).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const filteredEntries = filter === 'all' ? entries : entries.filter(e => e.level === filter)
  const counts = {
    all: entries.length,
    info: entries.filter(e => e.level === 'info').length,
    success: entries.filter(e => e.level === 'success').length,
    error: entries.filter(e => e.level === 'error').length,
    warn: entries.filter(e => e.level === 'warn').length,
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 9, padding: '1px 6px', borderRadius: 2,
    border: `1px solid ${active ? '#3757EB' : '#393D46'}`,
    backgroundColor: active ? '#1A2A4A' : 'transparent',
    color: active ? '#83A8F7' : '#656C7B',
    cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h,
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      backgroundColor: '#0F1117', border: '1px solid #393D46', borderRadius: 4,
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 11,
      userSelect: dragging ? 'none' : 'auto',
    }}>
      {/* Header */}
      <div onMouseDown={onHeaderMouseDown} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
        borderBottom: '1px solid #393D46', backgroundColor: '#1A1D24',
        borderRadius: '4px 4px 0 0', cursor: dragging ? 'grabbing' : 'grab', flexShrink: 0,
      }}>
        <span style={{ color: '#4DE491', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em' }}>DEVLOG</span>
        <span style={{ color: '#656C7B', fontSize: 10 }}>{counts.all}</span>
        {counts.error > 0 && (
          <span style={{ color: '#F07070', fontSize: 10 }}>· {counts.error} error{counts.error !== 1 ? 's' : ''}</span>
        )}
        <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
          {(['all', 'info', 'success', 'error', 'warn'] as const).map(l => (
            <button key={l} onClick={() => setFilter(l)} style={chipStyle(filter === l)}>
              {l}{l !== 'all' ? ` (${counts[l]})` : ''}
            </button>
          ))}
        </div>
        <button onClick={() => setAutoScroll(a => !a)} style={chipStyle(autoScroll)} title="Auto-scroll">↓</button>
        <button
          onClick={copyAll}
          style={{ ...chipStyle(false), color: copied ? '#4DE491' : '#656C7B', borderColor: copied ? '#052312' : '#393D46' }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
        <button onClick={() => setEntries([])} style={chipStyle(false)}>clear</button>
        <button onClick={onClose} style={{ ...chipStyle(false), fontSize: 12, padding: '0 5px' }}>✕</button>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {filteredEntries.length === 0 ? (
          <div style={{ color: '#393D46', padding: '20px 12px', textAlign: 'center', fontSize: 11 }}>
            No entries — use <span style={{ color: '#3757EB' }}>ipc.*</span> helpers to make logged IPC calls.
          </div>
        ) : filteredEntries.map(entry => {
          const s = LEVEL_STYLE[entry.level]
          return (
            <div key={entry.id} style={{
              padding: '2px 8px', borderBottom: '1px solid #1A1D24',
              display: 'flex', gap: 6, alignItems: 'flex-start',
            }}>
              <span style={{ color: '#393D46', flexShrink: 0, fontSize: 10, marginTop: 1 }}>{entry.timestamp}</span>
              <span style={{
                flexShrink: 0, fontSize: 9, padding: '1px 4px', borderRadius: 2,
                backgroundColor: s.badge, color: s.badgeFg, fontWeight: 600, marginTop: 1,
              }}>{entry.level.toUpperCase()}</span>
              <span style={{ color: '#3757EB', flexShrink: 0, fontSize: 10, marginTop: 1 }}>{entry.channel}</span>
              <span style={{ color: s.fg, wordBreak: 'break-all', flex: 1 }}>
                {entry.message}
                {entry.data !== undefined && (
                  <span style={{ color: '#656C7B', marginLeft: 4 }}>
                    {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}
                  </span>
                )}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Resize handle */}
      <div onMouseDown={onResizeMouseDown} style={{
        position: 'absolute', right: 0, bottom: 0, width: 14, height: 14,
        cursor: 'nwse-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 8 8" style={{ width: 8, height: 8 }}>
          <path d="M2 6L6 2M4 6L6 4" stroke="#393D46" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}
