import { useState, useEffect, useRef, useCallback } from 'react'
import type { FieldInfo, FieldType } from '../../main/ipcChannels'
import TypeBadge from '../components/TypeBadge'
import { ipcField } from '../lib/ipc'

// ── Type picker data ──────────────────────────────────────────────────────────

type TypeGroup = {
  label: string
  types: { value: FieldType; label: string }[]
}

const TYPE_GROUPS: TypeGroup[] = [
  { label: 'Text', types: [
    { value: 'text', label: 'Single-line text' },
    { value: 'multiline', label: 'Multi-line text' },
    { value: 'url', label: 'URL' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
  ]},
  { label: 'Numbers', types: [
    { value: 'integer', label: 'Integer' },
    { value: 'decimal', label: 'Decimal' },
    { value: 'currency', label: 'Currency' },
    { value: 'rating', label: 'Rating' },
    { value: 'percentage', label: 'Percentage' },
  ]},
  { label: 'Date & Time', types: [
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'datetime', label: 'Date / Time' },
    { value: 'duration', label: 'Duration' },
  ]},
  { label: 'Boolean', types: [
    { value: 'yesno', label: 'Yes / No' },
  ]},
  { label: 'Selection', types: [
    { value: 'choice', label: 'Single choice' },
    { value: 'multichoice', label: 'Multiple choice' },
    { value: 'tags', label: 'Tags' },
  ]},
  { label: 'Files', types: [
    { value: 'linked-file', label: 'Linked file' },
    { value: 'embedded-file', label: 'Embedded file' },
  ]},
  { label: 'Advanced', types: [
    { value: 'lookup', label: 'Lookup' },
    { value: 'formula', label: 'Formula' },
  ]},
]

const ALL_TYPES = TYPE_GROUPS.flatMap(g => g.types)

// ── Draft type for new fields (not yet saved) ─────────────────────────────────

type FieldDraft = {
  name: string
  type: FieldType
  required: boolean
  isPrimary: boolean
  description: string
  defaultValue: string
  options: Record<string, string | number | boolean | string[]>
}

interface ContextMenuState {
  x: number
  y: number
  fieldId: string
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CabDesigner() {
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [recycled, setRecycled] = useState<FieldInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recycleOpen, setRecycleOpen] = useState(false)
  const [draft, setDraft] = useState<FieldDraft | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below'>('below')
  const [error, setError] = useState<string | null>(null)
  const [noCabinet, setNoCabinet] = useState(false)
  const [saving, setSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Load fields on mount ───────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const currentResult = await window.cabinet.current()
      if (!currentResult.ok || !currentResult.data) {
        setNoCabinet(true)
        setFields([])
        setRecycled([])
        return
      }
      setNoCabinet(false)
      const [activeResult, recycledResult] = await Promise.all([
        ipcField.list(),
        ipcField.listRecycled(),
      ])
      if (!activeResult.ok) throw new Error(activeResult.error)
      if (!recycledResult.ok) throw new Error(recycledResult.error)
      setFields(activeResult.data)
      setRecycled(recycledResult.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ── Context menu close handlers ────────────────────────────────────────────

  useEffect(() => {
    if (!contextMenu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

  // ── Derived state ──────────────────────────────────────────────────────────

  const selectedField = selectedId ? fields.find(f => f.id === selectedId) ?? null : null

  // ── New field draft ────────────────────────────────────────────────────────

  function startNewField() {
    setDraft({
      name: '',
      type: 'text',
      required: false,
      isPrimary: false,
      description: '',
      defaultValue: '',
      options: {},
    })
    setSelectedId(null)
    setContextMenu(null)
  }

  function updateDraft(patch: Partial<FieldDraft>) {
    setDraft(prev => prev ? { ...prev, ...patch } : null)
  }

  async function saveDraft() {
    if (!draft || !draft.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const result = await ipcField.create({
        name: draft.name.trim(),
        type: draft.type,
        required: draft.required,
        isPrimary: draft.isPrimary,
        description: draft.description,
        defaultValue: draft.defaultValue,
        options: draft.options,
      })
      if (!result.ok) throw new Error(result.error)
      await refresh()
      setSelectedId(result.data.id)
      setDraft(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function cancelDraft() {
    setDraft(null)
    setSelectedId(fields[0]?.id ?? null)
  }

  // ── Edit existing field ────────────────────────────────────────────────────

  async function updateField(id: string, patch: Partial<FieldDraft>) {
    setError(null)
    try {
      const result = await ipcField.update({
        id,
        ...patch,
        options: patch.options !== undefined ? patch.options : undefined,
      })
      if (!result.ok) throw new Error(result.error)
      setFields(prev => prev.map(f => f.id === id ? result.data : f))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      // Refresh to get canonical state on error
      await refresh()
    }
  }

  // ── Recycle ────────────────────────────────────────────────────────────────

  async function recycleField(id: string) {
    setError(null)
    setContextMenu(null)
    try {
      const result = await ipcField.recycle(id)
      if (!result.ok) throw new Error(result.error)
      await refresh()
      if (selectedId === id) setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // ── Restore ────────────────────────────────────────────────────────────────

  async function restoreField(id: string) {
    setError(null)
    try {
      const result = await ipcField.restore(id)
      if (!result.ok) throw new Error(result.error)
      await refresh()
      setSelectedId(result.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // ── Duplicate ──────────────────────────────────────────────────────────────

  async function duplicateField(id: string) {
    setError(null)
    setContextMenu(null)
    try {
      const result = await ipcField.duplicate(id)
      if (!result.ok) throw new Error(result.error)
      await refresh()
      setSelectedId(result.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // ── Move up / down ─────────────────────────────────────────────────────────

  async function moveField(id: string, dir: 'up' | 'down') {
    setContextMenu(null)
    const idx = fields.findIndex(f => f.id === id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === fields.length - 1) return

    const reordered = [...fields]
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    setFields(reordered) // optimistic update

    setError(null)
    try {
      const result = await ipcField.reorder({ orderedIds: reordered.map(f => f.id) })
      if (!result.ok) throw new Error(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      await refresh() // rollback on error
    }
  }

  // ── Set primary display field ──────────────────────────────────────────────

  async function setPrimaryField(id: string) {
    setContextMenu(null)
    setError(null)
    try {
      const result = await ipcField.update({ id, isPrimary: true })
      if (!result.ok) throw new Error(result.error)
      // Clear primary on all other fields locally (server did it atomically)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  function handleDragStart(id: string) { setDraggedId(id) }

  function handleDragOver(id: string, e: React.DragEvent, el: HTMLElement) {
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverId(id)
    setDragOverPos(e.clientY < midY ? 'above' : 'below')
  }

  async function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null); setDragOverId(null)
      return
    }
    const from = fields.findIndex(f => f.id === draggedId)
    const to = fields.findIndex(f => f.id === targetId)
    if (from === -1 || to === -1) { setDraggedId(null); setDragOverId(null); return }

    const next = [...fields]
    const [item] = next.splice(from, 1)
    const insertAt = dragOverPos === 'above'
      ? (from < to ? to - 1 : to)
      : (from < to ? to : to + 1)
    next.splice(insertAt, 0, item)

    setFields(next) // optimistic
    setDraggedId(null)
    setDragOverId(null)

    setError(null)
    try {
      const result = await ipcField.reorder({ orderedIds: next.map(f => f.id) })
      if (!result.ok) throw new Error(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      await refresh()
    }
  }

  function handleDragEnd() { setDraggedId(null); setDragOverId(null) }

  function openContextMenu(fieldId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, fieldId })
  }

  // ── Derived context menu helpers ───────────────────────────────────────────

  const contextField = contextMenu ? fields.find(f => f.id === contextMenu.fieldId) : null
  const contextIdx = contextMenu ? fields.findIndex(f => f.id === contextMenu.fieldId) : -1

  // ── Render ─────────────────────────────────────────────────────────────────

  if (noCabinet) {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Open a cabinet to manage its fields</p>
      </div>
    )
  }

  return (
    <div className="flex" style={{ height: '100%', backgroundColor: 'var(--background)', position: 'relative' }}>

      {/* ── Field list ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col shrink-0"
        style={{ width: 240, borderRight: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
      >
        {/* List toolbar */}
        <div
          className="flex items-center shrink-0 px-3"
          style={{ height: 44, borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Fields</span>
          <span
            className="font-mono ml-2"
            style={{ fontSize: 10, color: 'var(--muted-foreground)', backgroundColor: 'var(--secondary)', padding: '1px 5px', borderRadius: 2 }}
          >
            {fields.length}
          </span>
          {error && (
            <span style={{ fontSize: 10, color: '#BD2A49', marginLeft: 6, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Error
            </span>
          )}
          <button
            onClick={startNewField}
            className="ml-auto flex items-center gap-1"
            style={{ fontSize: 12, color: 'var(--primary)', fontFamily: 'inherit', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="2">
              <path d="M6 1v10M1 6h10" strokeLinecap="round" />
            </svg>
            Add
          </button>
        </div>

        {/* Active field list */}
        <div className="flex-1 overflow-y-auto py-1">
          {fields.length === 0 && !draft && (
            <p className="px-3 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              No fields yet — click Add to create one
            </p>
          )}
          {draft && (
            <div
              className="flex items-center gap-2 px-3"
              style={{
                height: 34,
                backgroundColor: 'var(--secondary)',
                borderLeft: '2px solid var(--primary)',
              }}
            >
              <TypeBadge type={draft.type} />
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                {draft.name || 'New field…'}
              </span>
            </div>
          )}
          {fields.map((field, i) => (
            <FieldRow
              key={field.id}
              field={field}
              index={i}
              isSelected={!draft && selectedId === field.id}
              isDragging={draggedId === field.id}
              isDragOver={dragOverId === field.id}
              dragOverPos={dragOverPos}
              onSelect={() => { setSelectedId(field.id); setDraft(null) }}
              onContextMenu={e => openContextMenu(field.id, e)}
              onDragStart={() => handleDragStart(field.id)}
              onDragOver={(e, el) => handleDragOver(field.id, e, el)}
              onDrop={() => handleDrop(field.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>

        {/* Recycled section */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setRecycleOpen(v => !v)}
            className="flex items-center gap-2 w-full px-3"
            style={{ height: 36, fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'inherit', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3h8M4 3V2h4v1M3 3l1 8h4l1-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Recycled
            <span className="font-mono" style={{ fontSize: 10, backgroundColor: 'var(--secondary)', padding: '1px 5px', borderRadius: 2 }}>
              {recycled.length}
            </span>
            <svg
              viewBox="0 0 10 10" fill="none" className="ml-auto w-2.5 h-2.5" stroke="currentColor" strokeWidth="1.5"
              style={{ transform: recycleOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            >
              <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {recycleOpen && (
            <div className="pb-1">
              {recycled.length === 0 && (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>Empty</p>
              )}
              {recycled.map(field => (
                <div key={field.id} className="flex items-center gap-2 px-3 py-1.5" style={{ opacity: 0.6 }}>
                  <TypeBadge type={field.type} />
                  <span className="text-xs truncate flex-1" style={{ color: 'var(--muted-foreground)' }}>{field.name}</span>
                  <button
                    onClick={() => restoreField(field.id)}
                    className="text-xs shrink-0"
                    style={{ color: 'var(--primary)', fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Field editor ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {draft ? (
          // ── New field draft editor ────────────────────────────────────────
          <>
            <div
              className="flex items-center shrink-0 px-5 gap-2"
              style={{ height: 44, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>New Field</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={cancelDraft} style={secondaryBtnStyle}>Cancel</button>
                <button
                  onClick={saveDraft}
                  disabled={!draft.name.trim() || saving}
                  style={{
                    ...primaryBtnStyle,
                    opacity: !draft.name.trim() || saving ? 0.5 : 1,
                    cursor: !draft.name.trim() || saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Field'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
              {error && (
                <p style={{ fontSize: 12, color: '#BD2A49', marginBottom: 16 }}>{error}</p>
              )}
              <FieldEditorForm
                name={draft.name}
                type={draft.type}
                required={draft.required}
                isPrimary={draft.isPrimary}
                description={draft.description}
                defaultValue={draft.defaultValue}
                options={draft.options}
                isNew
                onChange={patch => updateDraft(patch)}
                onRecycle={null}
              />
            </div>
          </>
        ) : selectedField ? (
          // ── Existing field editor ─────────────────────────────────────────
          <>
            <div
              className="flex items-center shrink-0 px-5"
              style={{ height: 44, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                {selectedField.name}
              </span>
              <TypeBadge type={selectedField.type} />
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
              {error && (
                <p style={{ fontSize: 12, color: '#BD2A49', marginBottom: 16 }}>{error}</p>
              )}
              <FieldEditorForm
                name={selectedField.name}
                type={selectedField.type}
                required={selectedField.required}
                isPrimary={selectedField.isPrimary}
                description={selectedField.description}
                defaultValue={selectedField.defaultValue}
                options={selectedField.options}
                isNew={false}
                onChange={patch => updateField(selectedField.id, patch)}
                onRecycle={() => recycleField(selectedField.id)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Select a field to edit</p>
          </div>
        )}
      </div>

      {/* ── Context menu ───────────────────────────────────────────────────── */}
      {contextMenu && contextField && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 100,
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            minWidth: 180,
            padding: '3px 0',
          }}
        >
          <ContextMenuHeader label={contextField.name} type={contextField.type} />
          <ContextDivider />
          <ContextItem label="Move Up" icon={<ArrowUpIcon />} disabled={contextIdx === 0} onClick={() => moveField(contextMenu.fieldId, 'up')} />
          <ContextItem label="Move Down" icon={<ArrowDownIcon />} disabled={contextIdx === fields.length - 1} onClick={() => moveField(contextMenu.fieldId, 'down')} />
          <ContextDivider />
          <ContextItem label="Duplicate" icon={<DuplicateIcon />} onClick={() => duplicateField(contextMenu.fieldId)} />
          {contextField.type === 'text' && !contextField.isPrimary && (
            <ContextItem label="Set as Primary Display" icon={<StarIcon />} onClick={() => setPrimaryField(contextMenu.fieldId)} />
          )}
          <ContextItem label="Edit in Panel" icon={<EditIcon />} onClick={() => { setSelectedId(contextMenu.fieldId); setDraft(null); setContextMenu(null) }} />
          <ContextDivider />
          <ContextItem label="Recycle" icon={<RecycleIcon />} destructive onClick={() => recycleField(contextMenu.fieldId)} />
        </div>
      )}
    </div>
  )
}

// ── Field editor form (shared between new + existing) ─────────────────────────

function FieldEditorForm({
  name, type, required, isPrimary, description, defaultValue, options,
  isNew, onChange, onRecycle,
}: {
  name: string
  type: FieldType
  required: boolean
  isPrimary: boolean
  description: string
  defaultValue: string
  options: Record<string, string | number | boolean | string[]>
  isNew: boolean
  onChange: (patch: Partial<FieldDraft>) => void
  onRecycle: (() => void) | null
}) {
  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 440 }}>
      <FormField label="Name" required>
        <input
          type="text" value={name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Field name" style={inputStyle}
        />
      </FormField>

      <FormField label="Type">
        <TypeSelect value={type} onChange={v => onChange({ type: v })} />
      </FormField>

      <FormField label="Description">
        <input
          type="text" value={description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Optional description" style={inputStyle}
        />
      </FormField>

      <FormField label="Default value">
        <input
          type="text" value={defaultValue}
          onChange={e => onChange({ defaultValue: e.target.value })}
          placeholder="Leave blank for none" style={inputStyle}
        />
      </FormField>

      <div className="flex flex-col gap-3">
        <ToggleField
          label="Required"
          hint="Blocks saving if empty"
          checked={required}
          onChange={v => onChange({ required: v })}
        />
        <ToggleField
          label="Primary display field"
          hint="Only one text field may be primary"
          checked={isPrimary}
          disabled={type !== 'text'}
          onChange={v => onChange({ isPrimary: v })}
        />
      </div>

      {/* Type-specific options */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 20 }}>
          Format & Options
        </p>
        <div className="flex flex-col gap-5">
          <FieldOptionsEditor
            type={type}
            options={options}
            onChange={opts => onChange({ options: opts })}
          />
        </div>
      </div>

      {!isNew && onRecycle && (
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <button onClick={onRecycle} className="text-xs" style={{ color: '#BD2A49', fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Recycle this field
          </button>
        </div>
      )}
    </div>
  )
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({
  field, isSelected, isDragging, isDragOver, dragOverPos,
  onSelect, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  field: FieldInfo
  index: number
  isSelected: boolean
  isDragging: boolean
  isDragOver: boolean
  dragOverPos: 'above' | 'below'
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent, el: HTMLElement) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ position: 'relative' }}>
      {isDragOver && dragOverPos === 'above' && (
        <div style={{ height: 2, backgroundColor: 'var(--primary)', margin: '0 8px', borderRadius: 1 }} />
      )}
      <div
        ref={rowRef}
        draggable
        onClick={onSelect}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragStart={onDragStart}
        onDragOver={e => rowRef.current && onDragOver(e, rowRef.current)}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className="flex items-center gap-2 px-3"
        style={{
          height: 34, cursor: 'pointer',
          backgroundColor: isSelected ? 'var(--secondary)' : hovered ? 'var(--muted)' : 'transparent',
          borderLeft: `2px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
          opacity: isDragging ? 0.4 : 1,
          transition: 'opacity 0.1s',
          userSelect: 'none',
        }}
      >
        <div style={{ cursor: 'grab', color: hovered ? 'var(--secondary-foreground)' : 'var(--border)', flexShrink: 0 }}>
          <svg viewBox="0 0 8 12" fill="none" className="w-2 h-3">
            <circle cx="2" cy="2" r="1" fill="currentColor" />
            <circle cx="6" cy="2" r="1" fill="currentColor" />
            <circle cx="2" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="2" cy="10" r="1" fill="currentColor" />
            <circle cx="6" cy="10" r="1" fill="currentColor" />
          </svg>
        </div>
        <TypeBadge type={field.type} />
        <span
          className="flex-1 text-xs truncate"
          style={{ color: isSelected ? 'var(--foreground)' : 'var(--secondary-foreground)', fontWeight: isSelected ? 500 : 400 }}
        >
          {field.name}
        </span>
        {field.isPrimary && (
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }}>
            <path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.2 3.22 9.55l.53-3.1L1.5 4.25l3.1-.45L6 1z" fill="currentColor" />
          </svg>
        )}
        {field.required && (
          <span style={{ fontSize: 10, color: '#BD2A49', fontWeight: 700 }}>*</span>
        )}
      </div>
      {isDragOver && dragOverPos === 'below' && (
        <div style={{ height: 2, backgroundColor: 'var(--primary)', margin: '0 8px', borderRadius: 1 }} />
      )}
    </div>
  )
}

// ── Context menu components ───────────────────────────────────────────────────

function ContextMenuHeader({ label, type }: { label: string; type: FieldType }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <TypeBadge type={type} />
      <span className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{label}</span>
    </div>
  )
}

function ContextDivider() {
  return <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '3px 0' }} />
}

function ContextItem({ label, icon, destructive, disabled, onClick }: {
  label: string; icon: React.ReactNode; destructive?: boolean; disabled?: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = disabled ? 'var(--muted-foreground)' : destructive ? '#BD2A49' : 'var(--foreground)'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 12px', fontSize: 12, color,
        backgroundColor: hovered && !disabled ? 'var(--secondary)' : 'transparent',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.45 : 1, textAlign: 'left',
      }}
    >
      <span style={{ color: disabled ? 'var(--muted-foreground)' : destructive ? '#BD2A49' : 'var(--muted-foreground)' }}>
        {icon}
      </span>
      {label}
    </button>
  )
}

// ── Form primitives ───────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
        {required && <span style={{ color: '#BD2A49', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function ToggleField({ label, hint, checked, disabled, onChange }: {
  label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3" style={{ opacity: disabled ? 0.4 : 1 }}>
      <button
        role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 32, height: 18, borderRadius: 9, border: 'none',
          backgroundColor: checked ? 'var(--primary)' : 'var(--secondary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative', flexShrink: 0, transition: 'background-color 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          backgroundColor: '#FFFFFF', transition: 'left 0.15s',
        }} />
      </button>
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
        <p style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{hint}</p>
      </div>
    </div>
  )
}

function TypeSelect({ value, onChange }: { value: FieldType; onChange: (v: FieldType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = ALL_TYPES.find(t => t.value === value)!

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '5px 10px', borderRadius: 'var(--radius)',
          border: `1px solid ${open ? 'var(--primary)' : 'var(--border)'}`,
          backgroundColor: 'var(--background)', color: 'var(--foreground)',
          fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <TypeBadge type={value} />
        <span style={{ flex: 1 }}>{current.label}</span>
        <svg
          viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ width: 10, height: 10, color: 'var(--muted-foreground)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          padding: '4px 0', maxHeight: 360, overflowY: 'auto',
        }}>
          {TYPE_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '3px 0' }} />}
              <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
                {group.label}
              </div>
              {group.types.map(t => {
                const active = t.value === value
                return (
                  <button
                    key={t.value}
                    onClick={() => { onChange(t.value); setOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '5px 10px', border: 'none',
                      backgroundColor: active ? 'var(--secondary)' : 'transparent',
                      color: active ? 'var(--foreground)' : 'var(--secondary-foreground)',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 500 : 400,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--muted)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                  >
                    <TypeBadge type={t.value} />
                    <span style={{ flex: 1 }}>{t.label}</span>
                    {active && (
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 10, height: 10, color: 'var(--primary)', flexShrink: 0 }}>
                        <path d="M1.5 5l3 3 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '6px 10px',
  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
  backgroundColor: 'var(--background)', color: 'var(--foreground)',
  fontFamily: 'inherit', outline: 'none',
}

const primaryBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius)',
  border: 'none', backgroundColor: 'var(--primary)',
  color: 'var(--primary-foreground)', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', backgroundColor: 'transparent',
  color: 'var(--foreground)', fontFamily: 'inherit', cursor: 'pointer',
}

// ── Options helpers ───────────────────────────────────────────────────────────

function OptSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function OptRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12 }}>{children}</div>
}

function ChoicesEditor({ choices, onChange, noun = 'option' }: {
  choices: string[]; onChange: (v: string[]) => void; noun?: string
}) {
  const [draftText, setDraftText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const t = draftText.trim()
    if (!t || choices.includes(t)) return
    onChange([...choices, t])
    setDraftText('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      {choices.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {choices.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                backgroundColor: 'var(--background)',
                borderBottom: i < choices.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 12, color: 'var(--foreground)' }}>{c}</span>
              <button
                onClick={() => onChange(choices.filter((_, j) => j !== i))}
                style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', lineHeight: 1 }}
              >
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 10, height: 10 }}>
                  <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef} type="text" value={draftText}
          onChange={e => setDraftText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={`Add ${noun}…`} style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={add} disabled={!draftText.trim()}
          style={{
            padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap',
            backgroundColor: draftText.trim() ? 'var(--secondary)' : 'transparent',
            color: draftText.trim() ? 'var(--foreground)' : 'var(--muted-foreground)',
            cursor: draftText.trim() ? 'pointer' : 'default',
          }}
        >Add</button>
      </div>
    </div>
  )
}

// ── Field options editor ──────────────────────────────────────────────────────

function FieldOptionsEditor({ type, options, onChange }: {
  type: FieldType
  options: Record<string, string | number | boolean | string[]>
  onChange: (opts: Record<string, string | number | boolean | string[]>) => void
}) {
  function set(key: string, val: string | number | boolean | string[]) {
    onChange({ ...options, [key]: val })
  }
  const s = (k: string, d = '') => (options[k] as string) ?? d
  const n = (k: string, d: number) => (options[k] as number) ?? d
  const b = (k: string, d = false) => Boolean(options[k] !== undefined ? options[k] : d)
  const a = (k: string): string[] => Array.isArray(options[k]) ? (options[k] as string[]) : []

  if (type === 'text') return (<>
    <FormField label="Max length">
      <input type="number" min={1} value={s('maxLength')} onChange={e => set('maxLength', e.target.value)} placeholder="Unlimited" style={inputStyle} />
    </FormField>
    <FormField label="Validation">
      <OptSelect value={s('validation', 'none')} onChange={v => set('validation', v)} options={[
        { value: 'none', label: 'None' },
        { value: 'alphanumeric', label: 'Alphanumeric only' },
        { value: 'pattern', label: 'Custom pattern (regex)' },
      ]} />
    </FormField>
    {s('validation') === 'pattern' && (
      <FormField label="Pattern">
        <input type="text" value={s('pattern')} onChange={e => set('pattern', e.target.value)} placeholder="^[A-Z].*" style={inputStyle} />
      </FormField>
    )}
    <FormField label="Transform">
      <OptSelect value={s('transform', 'none')} onChange={v => set('transform', v)} options={[
        { value: 'none', label: 'None' },
        { value: 'uppercase', label: 'UPPERCASE' },
        { value: 'lowercase', label: 'lowercase' },
        { value: 'titlecase', label: 'Title Case' },
      ]} />
    </FormField>
  </>)

  if (type === 'multiline') return (<>
    <FormField label="Max length">
      <input type="number" min={1} value={s('maxLength')} onChange={e => set('maxLength', e.target.value)} placeholder="Unlimited" style={inputStyle} />
    </FormField>
    <FormField label="Min rows">
      <input type="number" min={2} max={20} value={n('minRows', 3)} onChange={e => set('minRows', Number(e.target.value))} style={inputStyle} />
    </FormField>
  </>)

  if (type === 'url') return (<>
    <FormField label="Allowed protocol">
      <OptSelect value={s('protocol', 'any')} onChange={v => set('protocol', v)} options={[
        { value: 'any', label: 'Any' },
        { value: 'https', label: 'HTTPS only' },
        { value: 'http-https', label: 'HTTP or HTTPS' },
      ]} />
    </FormField>
    <ToggleField label="Open in new tab" hint="Default behaviour when clicking the URL" checked={b('newTab', true)} onChange={v => set('newTab', v)} />
  </>)

  if (type === 'email') return (<>
    <ToggleField label="Allow multiple addresses" hint="Comma-separated list of emails" checked={b('allowMultiple')} onChange={v => set('allowMultiple', v)} />
    <ToggleField label="Validate on save" hint="Reject malformed addresses" checked={b('validate', true)} onChange={v => set('validate', v)} />
  </>)

  if (type === 'phone') return (<>
    <FormField label="Format">
      <OptSelect value={s('format', 'free')} onChange={v => set('format', v)} options={[
        { value: 'free', label: 'Free text' },
        { value: 'national', label: 'National  (555) 123-4567' },
        { value: 'e164', label: 'E.164  +15551234567' },
      ]} />
    </FormField>
    <FormField label="Default country code">
      <input type="text" value={s('countryCode', '+1')} onChange={e => set('countryCode', e.target.value)} placeholder="+1" style={inputStyle} />
    </FormField>
  </>)

  if (type === 'integer') return (<>
    <OptRow>
      <FormField label="Min value"><input type="number" value={s('min')} onChange={e => set('min', e.target.value)} placeholder="None" style={inputStyle} /></FormField>
      <FormField label="Max value"><input type="number" value={s('max')} onChange={e => set('max', e.target.value)} placeholder="None" style={inputStyle} /></FormField>
    </OptRow>
    <FormField label="Step">
      <input type="number" min={1} value={n('step', 1)} onChange={e => set('step', Number(e.target.value))} style={inputStyle} />
    </FormField>
  </>)

  if (type === 'decimal') return (<>
    <OptRow>
      <FormField label="Min value"><input type="number" value={s('min')} onChange={e => set('min', e.target.value)} placeholder="None" style={inputStyle} /></FormField>
      <FormField label="Max value"><input type="number" value={s('max')} onChange={e => set('max', e.target.value)} placeholder="None" style={inputStyle} /></FormField>
    </OptRow>
    <FormField label="Decimal places">
      <OptSelect value={s('decimalPlaces', '2')} onChange={v => set('decimalPlaces', v)} options={['0','1','2','3','4','5','6','7','8'].map(v => ({ value: v, label: v }))} />
    </FormField>
  </>)

  if (type === 'currency') return (<>
    <FormField label="Currency">
      <OptSelect value={s('currencyCode', 'USD')} onChange={v => set('currencyCode', v)} options={[
        { value: 'USD', label: 'USD — US Dollar ($)' },
        { value: 'EUR', label: 'EUR — Euro (€)' },
        { value: 'GBP', label: 'GBP — British Pound (£)' },
        { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
        { value: 'CAD', label: 'CAD — Canadian Dollar (CA$)' },
        { value: 'ILS', label: 'ILS — Israeli Shekel (₪)' },
      ]} />
    </FormField>
    <FormField label="Symbol position">
      <OptSelect value={s('symbolPosition', 'prefix')} onChange={v => set('symbolPosition', v)} options={[
        { value: 'prefix', label: 'Before amount  ($100)' },
        { value: 'suffix', label: 'After amount  (100$)' },
      ]} />
    </FormField>
    <FormField label="Decimal places">
      <OptSelect value={s('decimalPlaces', '2')} onChange={v => set('decimalPlaces', v)} options={['0','1','2','3'].map(v => ({ value: v, label: v }))} />
    </FormField>
  </>)

  if (type === 'rating') return (<>
    <FormField label="Scale">
      <OptSelect value={s('maxStars', '5')} onChange={v => set('maxStars', v)} options={[
        { value: '3', label: '1 – 3 stars' },
        { value: '5', label: '1 – 5 stars' },
        { value: '10', label: '1 – 10 stars' },
      ]} />
    </FormField>
    <ToggleField label="Allow half stars" hint="Enables 0.5-star increments" checked={b('halfStars')} onChange={v => set('halfStars', v)} />
  </>)

  if (type === 'percentage') return (<>
    <OptRow>
      <FormField label="Min %"><input type="number" value={n('min', 0)} onChange={e => set('min', Number(e.target.value))} style={inputStyle} /></FormField>
      <FormField label="Max %"><input type="number" value={n('max', 100)} onChange={e => set('max', Number(e.target.value))} style={inputStyle} /></FormField>
    </OptRow>
    <FormField label="Decimal places">
      <OptSelect value={s('decimalPlaces', '0')} onChange={v => set('decimalPlaces', v)} options={['0','1','2'].map(v => ({ value: v, label: v }))} />
    </FormField>
    <ToggleField label="Show progress bar" hint="Visual bar displayed in record view" checked={b('showBar', true)} onChange={v => set('showBar', v)} />
  </>)

  if (type === 'date') return (<>
    <FormField label="Display format">
      <OptSelect value={s('dateFormat', 'YYYY-MM-DD')} onChange={v => set('dateFormat', v)} options={[
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD  (ISO)' },
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY  (US)' },
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY  (EU)' },
        { value: 'DD MMM YYYY', label: 'DD MMM YYYY  (01 Jan 2026)' },
        { value: 'MMMM D, YYYY', label: 'January 1, 2026' },
      ]} />
    </FormField>
    <OptRow>
      <FormField label="Min date"><input type="date" value={s('minDate')} onChange={e => set('minDate', e.target.value)} style={inputStyle} /></FormField>
      <FormField label="Max date"><input type="date" value={s('maxDate')} onChange={e => set('maxDate', e.target.value)} style={inputStyle} /></FormField>
    </OptRow>
  </>)

  if (type === 'time') return (<>
    <FormField label="Format">
      <OptSelect value={s('timeFormat', '24h')} onChange={v => set('timeFormat', v)} options={[
        { value: '24h', label: '24-hour  (14:30)' },
        { value: '12h', label: '12-hour  (2:30 PM)' },
      ]} />
    </FormField>
    <FormField label="Minute step">
      <OptSelect value={s('minuteStep', '1')} onChange={v => set('minuteStep', v)} options={[
        { value: '1', label: 'Every minute' }, { value: '5', label: 'Every 5 minutes' },
        { value: '10', label: 'Every 10 minutes' }, { value: '15', label: 'Every 15 minutes' },
        { value: '30', label: 'Every 30 minutes' },
      ]} />
    </FormField>
  </>)

  if (type === 'datetime') return (<>
    <FormField label="Date format">
      <OptSelect value={s('dateFormat', 'YYYY-MM-DD')} onChange={v => set('dateFormat', v)} options={[
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }, { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
      ]} />
    </FormField>
    <FormField label="Time format">
      <OptSelect value={s('timeFormat', '24h')} onChange={v => set('timeFormat', v)} options={[
        { value: '24h', label: '24-hour' }, { value: '12h', label: '12-hour  (AM/PM)' },
      ]} />
    </FormField>
    <FormField label="Timezone">
      <OptSelect value={s('timezone', 'local')} onChange={v => set('timezone', v)} options={[
        { value: 'local', label: 'Device local time' }, { value: 'utc', label: 'UTC' },
      ]} />
    </FormField>
  </>)

  if (type === 'duration') return (<>
    <FormField label="Format">
      <OptSelect value={s('durationFormat', 'hh:mm:ss')} onChange={v => set('durationFormat', v)} options={[
        { value: 'hh:mm:ss', label: 'hh:mm:ss  (01:30:00)' }, { value: 'hh:mm', label: 'hh:mm  (01:30)' },
        { value: 'mm:ss', label: 'mm:ss  (90:00)' }, { value: 'decimal-hours', label: 'Decimal hours  (1.5)' },
        { value: 'decimal-minutes', label: 'Decimal minutes  (90)' },
      ]} />
    </FormField>
    <FormField label="Max duration (hours)">
      <input type="number" min={1} value={s('maxHours')} onChange={e => set('maxHours', e.target.value)} placeholder="Unlimited" style={inputStyle} />
    </FormField>
  </>)

  if (type === 'yesno') return (<>
    <OptRow>
      <FormField label="True label"><input type="text" value={s('trueLabel', 'Yes')} onChange={e => set('trueLabel', e.target.value)} placeholder="Yes" style={inputStyle} /></FormField>
      <FormField label="False label"><input type="text" value={s('falseLabel', 'No')} onChange={e => set('falseLabel', e.target.value)} placeholder="No" style={inputStyle} /></FormField>
    </OptRow>
    <FormField label="Display as">
      <OptSelect value={s('displayAs', 'toggle')} onChange={v => set('displayAs', v)} options={[
        { value: 'toggle', label: 'Toggle switch' }, { value: 'checkbox', label: 'Checkbox' },
        { value: 'radio', label: 'Radio buttons' },
      ]} />
    </FormField>
  </>)

  if (type === 'choice') return (<>
    <FormField label="Options">
      <ChoicesEditor choices={a('choices')} onChange={v => set('choices', v)} />
    </FormField>
    <ToggleField label="Allow custom input" hint="User can type a value not in the list" checked={b('allowCustom')} onChange={v => set('allowCustom', v)} />
  </>)

  if (type === 'multichoice') return (<>
    <FormField label="Options">
      <ChoicesEditor choices={a('choices')} onChange={v => set('choices', v)} />
    </FormField>
    <OptRow>
      <FormField label="Min selections"><input type="number" min={0} value={s('minSelect')} onChange={e => set('minSelect', e.target.value)} placeholder="None" style={inputStyle} /></FormField>
      <FormField label="Max selections"><input type="number" min={1} value={s('maxSelect')} onChange={e => set('maxSelect', e.target.value)} placeholder="None" style={inputStyle} /></FormField>
    </OptRow>
  </>)

  if (type === 'tags') return (<>
    <FormField label="Input mode">
      <OptSelect value={s('mode', 'freeform')} onChange={v => set('mode', v)} options={[
        { value: 'freeform', label: 'Free-form  (any text)' },
        { value: 'predefined', label: 'Predefined list only' },
        { value: 'both', label: 'Predefined + free-form' },
      ]} />
    </FormField>
    {(s('mode', 'freeform') === 'predefined' || s('mode', 'freeform') === 'both') && (
      <FormField label="Predefined tags">
        <ChoicesEditor choices={a('predefinedTags')} onChange={v => set('predefinedTags', v)} noun="tag" />
      </FormField>
    )}
    <FormField label="Max tags">
      <input type="number" min={1} value={s('maxTags')} onChange={e => set('maxTags', e.target.value)} placeholder="Unlimited" style={inputStyle} />
    </FormField>
  </>)

  if (type === 'linked-file' || type === 'embedded-file') return (<>
    <FormField label="Allowed extensions">
      <input type="text" value={s('allowedExts')} onChange={e => set('allowedExts', e.target.value)} placeholder="jpg, png, pdf  (blank = any)" style={inputStyle} />
    </FormField>
    <FormField label="Max file size (MB)">
      <input type="number" min={1} value={s('maxSizeMB')} onChange={e => set('maxSizeMB', e.target.value)} placeholder="No limit" style={inputStyle} />
    </FormField>
    {type === 'linked-file' && (
      <ToggleField label="Verify file exists on open" hint="Check that the linked path is accessible" checked={b('verifyOnOpen')} onChange={v => set('verifyOnOpen', v)} />
    )}
  </>)

  if (type === 'lookup') return (<>
    <FormField label="Source cabinet">
      <input type="text" value={s('sourceCabinet')} onChange={e => set('sourceCabinet', e.target.value)} placeholder="Cabinet name or path" style={inputStyle} />
    </FormField>
    <FormField label="Display field">
      <input type="text" value={s('sourceField')} onChange={e => set('sourceField', e.target.value)} placeholder="Field name to display" style={inputStyle} />
    </FormField>
    <ToggleField label="Allow multiple lookups" hint="Link to more than one record" checked={b('multiLookup')} onChange={v => set('multiLookup', v)} />
  </>)

  if (type === 'formula') return (<>
    <FormField label="Expression">
      <textarea
        value={s('expression')} onChange={e => set('expression', e.target.value)}
        placeholder={"{Year} - 1900\n{Rating} * 10"} rows={3}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
      />
    </FormField>
    <FormField label="Output type">
      <OptSelect value={s('outputType', 'text')} onChange={v => set('outputType', v)} options={[
        { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' },
        { value: 'boolean', label: 'Yes / No' }, { value: 'date', label: 'Date' },
      ]} />
    </FormField>
    <ToggleField label="Recalculate on every save" hint="Formula runs each time the record is saved" checked={b('recalcOnSave', true)} onChange={v => set('recalcOnSave', v)} />
  </>)

  return null
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ArrowUpIcon() {
  return <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5"><path d="M6 10V2M2.5 5.5L6 2l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function ArrowDownIcon() {
  return <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v8M2.5 6.5L6 10l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function DuplicateIcon() {
  return <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="7" height="7" rx="1" /><path d="M2 8V2h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function StarIcon() {
  return <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5"><path d="M6 1l1.2 2.4 2.7.4-1.95 1.9.46 2.7L6 7.2 3.59 8.44l.46-2.7L2.1 3.84l2.7-.4L6 1z" /></svg>
}
function EditIcon() {
  return <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5"><path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function RecycleIcon() {
  return <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h8M4 3V2h4v1M3 3l1 8h4l1-8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
