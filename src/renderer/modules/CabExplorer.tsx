import { useState, useEffect, useCallback } from 'react'
import type { CabinetInfo, RecentCabinetInfo } from '../../main/ipcChannels'
import { ipcCabinet, ipcRecent, ipcDialog } from '../lib/ipc'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DisplayCabinet {
  path: string
  name: string
  lastOpenedAt: string
  isActive: boolean
  isOpen: boolean
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CabExplorer() {
  const [recents, setRecents] = useState<DisplayCabinet[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)
  const [newCabModal, setNewCabModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [recentResult, currentResult] = await Promise.all([
        ipcRecent.list(),
        ipcCabinet.current(),
      ])

      if (!recentResult.ok) throw new Error(recentResult.error)

      const currentPath = currentResult.ok && currentResult.data
        ? currentResult.data.path
        : null

      setActivePath(currentPath)
      setRecents(recentResult.data.map(r => ({
        path: r.path,
        name: r.name,
        lastOpenedAt: r.lastOpenedAt,
        isActive: r.path === currentPath,
        isOpen: r.path === currentPath,
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleOpenFile() {
    setError(null)
    const dialogResult = await ipcDialog.openFile()
    if (!dialogResult.ok || !dialogResult.data) return
    const result = await ipcCabinet.open(dialogResult.data)
    if (!result.ok) { setError(result.error); return }
    setActivePath(result.data.path)
    await refresh()
  }

  async function handleOpenRecent(path: string) {
    setError(null)
    const result = await ipcCabinet.open(path)
    if (!result.ok) {
      setError(result.error)
      if (result.error.includes('not found')) {
        await ipcRecent.remove(path)
        await refresh()
      }
      return
    }
    setActivePath(result.data.path)
    await refresh()
  }

  async function handleClone(sourcePath: string, sourceName: string) {
    setError(null)
    const dialogResult = await ipcDialog.saveFile(`${sourceName}-copy.cabinet`)
    if (!dialogResult.ok || !dialogResult.data) return
    const result = await ipcCabinet.clone({ sourcePath, destPath: dialogResult.data })
    if (!result.ok) { setError(result.error); return }
    await refresh()
  }

  async function handleDelete(path: string, name: string) {
    setError(null)
    const confirmed = window.confirm(
      `Permanently delete "${name}"?\n\nThis will delete the cabinet file from disk. This action cannot be undone.`
    )
    if (!confirmed) return
    const result = await ipcCabinet.delete(path)
    if (!result.ok) { setError(result.error); return }
    if (activePath === path) setActivePath(null)
    await refresh()
  }

  async function handleRemoveRecent(path: string) {
    await ipcRecent.remove(path)
    await refresh()
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', backgroundColor: 'var(--background)', position: 'relative' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0 px-4" style={{ height: 44, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${recents.length} cabinet${recents.length !== 1 ? 's' : ''}`}
        </span>
        {error && <span style={{ fontSize: 11, color: '#BD2A49', flex: 1, textAlign: 'center' }}>{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <ToolbarButton label="Open File…" onClick={handleOpenFile} />
          <ToolbarButton label="New Cabinet" primary onClick={() => setNewCabModal(true)} />
        </div>
      </div>

      {/* Cabinet grid */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Loading…</span>
        </div>
      ) : recents.length === 0 ? (
        <EmptyState onOpenFile={handleOpenFile} onNew={() => setNewCabModal(true)} />
      ) : (
        <div className="flex-1 overflow-auto p-4" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
          gap: 12, alignContent: 'start',
        }}>
          {recents.map(cab => (
            <CabinetCard
              key={cab.path}
              cabinet={cab}
              isHovered={hoveredPath === cab.path}
              hoveredAction={hoveredPath === cab.path ? hoveredAction : null}
              onMouseEnter={() => setHoveredPath(cab.path)}
              onMouseLeave={() => { setHoveredPath(null); setHoveredAction(null) }}
              onActionEnter={(a) => setHoveredAction(a)}
              onActionLeave={() => setHoveredAction(null)}
              onClick={() => handleOpenRecent(cab.path)}
              onClone={(e) => { e.stopPropagation(); handleClone(cab.path, cab.name) }}
              onDelete={(e) => { e.stopPropagation(); handleDelete(cab.path, cab.name) }}
              onRemove={(e) => { e.stopPropagation(); handleRemoveRecent(cab.path) }}
            />
          ))}
        </div>
      )}

      {newCabModal && (
        <NewCabinetModal
          onClose={() => setNewCabModal(false)}
          onCreate={async (path, name) => {
            setError(null)
            const result = await ipcCabinet.create({ path, name })
            if (!result.ok) { setError(result.error); return }
            setActivePath(result.data.path)
            setNewCabModal(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ onOpenFile, onNew }: { onOpenFile: () => void; onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div style={{ color: 'var(--muted-foreground)' }}>
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 48, height: 48 }}>
          <rect x="6" y="8" width="36" height="32" rx="2" />
          <path d="M6 16h36" /><path d="M16 28h16M16 33h10" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500 }}>No cabinets yet</p>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Create a new cabinet or open an existing one</p>
      <div className="flex gap-2">
        <ToolbarButton label="Open File…" onClick={onOpenFile} />
        <ToolbarButton label="New Cabinet" primary onClick={onNew} />
      </div>
    </div>
  )
}

function CabinetCard({ cabinet, isHovered, hoveredAction, onMouseEnter, onMouseLeave, onActionEnter, onActionLeave, onClick, onClone, onDelete, onRemove }: {
  cabinet: DisplayCabinet; isHovered: boolean; hoveredAction: string | null
  onMouseEnter: () => void; onMouseLeave: () => void
  onActionEnter: (a: string) => void; onActionLeave: () => void
  onClick: () => void; onClone: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void; onRemove: (e: React.MouseEvent) => void
}) {
  const isActive = cabinet.isOpen
  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} style={{
      backgroundColor: 'var(--card)', border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: 16, cursor: 'pointer',
      transition: 'border-color 0.1s', position: 'relative',
    }}>
      {isActive && (
        <span className="absolute top-3 right-3 font-mono" style={{ fontSize: 9, color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.05em' }}>OPEN</span>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center shrink-0" style={{
          width: 36, height: 36, borderRadius: 'var(--radius)',
          backgroundColor: isActive ? 'var(--primary)' : 'var(--secondary)',
          color: isActive ? 'var(--primary-foreground)' : 'var(--secondary-foreground)',
        }}>
          <CabinetIcon />
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{cabinet.name}</p>
          <p className="font-mono truncate" style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{cabinet.path}</p>
        </div>
      </div>
      <div className="flex items-center gap-3" style={{ marginBottom: isHovered ? 12 : 0 }}>
        <span className="ml-auto" style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{formatRelativeTime(cabinet.lastOpenedAt)}</span>
      </div>
      {isHovered && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
          <div className="flex items-center gap-1">
            {[{ label: 'Clone', handler: onClone }, { label: 'Remove', handler: onRemove }].map(({ label, handler }) => (
              <ActionButton key={label} label={label} isHovered={hoveredAction === label} destructive={false}
                onMouseEnter={() => onActionEnter(label)} onMouseLeave={onActionLeave} onClick={handler} />
            ))}
            <ActionButton label="Delete" isHovered={hoveredAction === 'Delete'} destructive
              onMouseEnter={() => onActionEnter('Delete')} onMouseLeave={onActionLeave} onClick={onDelete} />
          </div>
        </div>
      )}
    </div>
  )
}

function NewCabinetModal({ onClose, onCreate }: { onClose: () => void; onCreate: (path: string, name?: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [saving, setSaving] = useState(false)

  async function pickPath() {
    const defaultName = name.trim() ? `${name.trim().replace(/\s+/g, '-').toLowerCase()}.cabinet` : 'new-cabinet.cabinet'
    const result = await ipcDialog.saveFile(defaultName)
    if (result.ok && result.data) setPath(result.data)
  }

  async function handleCreate() {
    if (!path) return
    setSaving(true)
    await onCreate(path, name.trim() || undefined)
    setSaving(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 201, width: 420, backgroundColor: 'var(--card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
      }}>
        <div className="flex items-center gap-3 px-5" style={{ height: 52, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>New Cabinet</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12 }}>
              <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4" style={{ padding: '20px 20px 8px' }}>
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>
              Cabinet name <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input type="text" placeholder="e.g. Film Collection" value={name} onChange={e => setName(e.target.value)}
              style={inputStyle} autoFocus />
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>If left blank, the name is derived from the filename.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>
              Save location <span style={{ color: '#BD2A49' }}>*</span>
            </label>
            <div className="flex gap-2">
              <input type="text" placeholder="Choose a path…" value={path} readOnly onClick={pickPath}
                style={{ ...inputStyle, flex: 1, cursor: 'pointer' }} />
              <button onClick={pickPath} style={secondaryBtnStyle}>Browse…</button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--secondary)', borderRadius: '0 0 var(--radius) var(--radius)' }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={handleCreate} disabled={!path || saving} style={{ ...primaryBtnStyle, opacity: !path || saving ? 0.5 : 1, cursor: !path || saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Creating…' : 'Create Cabinet'}
          </button>
        </div>
      </div>
    </>
  )
}

function ToolbarButton({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius)',
      border: `1px solid ${primary ? 'var(--primary)' : 'var(--border)'}`,
      backgroundColor: primary ? 'var(--primary)' : 'transparent',
      color: primary ? 'var(--primary-foreground)' : 'var(--foreground)',
      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    }}>{label}</button>
  )
}

function ActionButton({ label, isHovered, destructive, onMouseEnter, onMouseLeave, onClick }: {
  label: string; isHovered: boolean; destructive: boolean
  onMouseEnter: () => void; onMouseLeave: () => void; onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} style={{
      fontSize: 11, padding: '3px 8px', borderRadius: 2,
      border: `1px solid ${isHovered && destructive ? '#BD2A49' : 'var(--border)'}`,
      backgroundColor: isHovered ? (destructive ? '#3A0610' : 'var(--secondary)') : 'transparent',
      color: isHovered && destructive ? '#BD2A49' : 'var(--secondary-foreground)',
      cursor: 'pointer', fontFamily: 'inherit', transition: 'background-color 0.1s',
    }}>{label}</button>
  )
}

function CabinetIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 6h12" /><path d="M5 9.5h6M5 11.5h3.5" strokeLinecap="round" />
    </svg>
  )
}

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(isoString).toLocaleDateString()
  } catch { return '' }
}

const inputStyle: React.CSSProperties = {
  fontSize: 12, padding: '6px 10px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', backgroundColor: 'var(--background)',
  color: 'var(--foreground)', fontFamily: 'inherit', outline: 'none', width: '100%',
}
const secondaryBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', backgroundColor: 'transparent',
  color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'inherit',
}
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius)',
  border: 'none', backgroundColor: 'var(--primary)',
  color: 'var(--primary-foreground)', fontFamily: 'inherit', fontWeight: 500,
}
