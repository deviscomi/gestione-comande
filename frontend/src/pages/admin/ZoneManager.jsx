import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { zonesApi } from '../../api/endpoints/zones'

const arrowBtn = {
  width: 24, height: 20, fontSize: 11, border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)',
  cursor: 'pointer', borderRadius: 4, padding: 0, lineHeight: 1, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}

const iconBtn = {
  width: 28, height: 28, fontSize: 14, border: '1px solid var(--color-border-secondary)',
  background: 'transparent', color: 'var(--color-text-secondary)',
  cursor: 'pointer', borderRadius: 6, padding: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}

export default function ZoneManager() {
  const qc = useQueryClient()

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.getAll().then(r => r.data.data),
  })

  const [newName, setNewName] = useState('')
  const [newOutdoor, setNewOutdoor] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [desiredTables, setDesiredTables] = useState({})
  const [zoneErrors, setZoneErrors] = useState({})
  const [syncing, setSyncing] = useState({})

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['zones'] })
    qc.invalidateQueries({ queryKey: ['zones-admin'] })
  }

  function setZoneError(id, msg) {
    setZoneErrors(prev => ({ ...prev, [id]: msg }))
  }

  const createMut = useMutation({
    mutationFn: (data) => zonesApi.create(data),
    onSuccess: () => { setNewName(''); setNewOutdoor(false); setFormError(''); invalidate() },
    onError: (e) => setFormError(e.response?.data?.message ?? 'Errore nella creazione'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => zonesApi.update(id, data),
    onSuccess: () => { setEditingId(null); invalidate() },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => zonesApi.remove(id),
    onSuccess: invalidate,
    onError: (e) => {
      const msg = e.response?.data?.message ?? 'Impossibile eliminare la zona'
      // attach error to the zone — we don't have the id here, so we clear all then set via caller
      setFormError(msg)
    },
  })

  const toggleMut = useMutation({
    mutationFn: (id) => zonesApi.toggle(id),
    onSuccess: invalidate,
  })

  function startEdit(zone) {
    setEditingId(zone.id)
    setEditingName(zone.name)
  }

  function saveEdit(zone) {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== zone.name) {
      updateMut.mutate({ id: zone.id, data: { name: trimmed } })
    } else {
      setEditingId(null)
    }
  }

  async function moveZone(zone, direction) {
    const sorted = [...zones].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(z => z.id === zone.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    await Promise.all([
      zonesApi.update(zone.id, { sort_order: other.sort_order }),
      zonesApi.update(other.id, { sort_order: zone.sort_order }),
    ])
    invalidate()
  }

  async function syncTables(zone) {
    const mainTables = (zone.tables ?? [])
      .filter(t => !t.parent_table_id)
      .sort((a, b) => a.number - b.number)
    const currentCount = mainTables.length
    const desired = parseInt(desiredTables[zone.id] ?? String(currentCount), 10)

    if (isNaN(desired) || desired < 0) {
      setZoneError(zone.id, 'Numero non valido')
      return
    }
    if (desired === currentCount) {
      setZoneError(zone.id, '')
      return
    }

    setSyncing(prev => ({ ...prev, [zone.id]: true }))
    try {
      if (desired > currentCount) {
        const maxNumber = mainTables.length > 0 ? Math.max(...mainTables.map(t => t.number)) : 0
        for (let i = 1; i <= desired - currentCount; i++) {
          await zonesApi.createTable(zone.id, maxNumber + i)
        }
        setZoneError(zone.id, '')
        setDesiredTables(prev => { const n = { ...prev }; delete n[zone.id]; return n })
        invalidate()
      } else {
        const toRemove = mainTables.slice(desired)
        const occupied = toRemove.filter(t => t.status !== 'libero')
        const free = toRemove.filter(t => t.status === 'libero')

        if (occupied.length > 0) {
          setZoneError(zone.id,
            `Impossibile eliminare ${occupied.length} tavol${occupied.length === 1 ? 'o' : 'i'} occupat${occupied.length === 1 ? 'o' : 'i'}: ${occupied.map(t => `Tav ${t.number}`).join(', ')}`
          )
        } else {
          setZoneError(zone.id, '')
        }

        for (const table of free) {
          await zonesApi.deleteTable(table.id)
        }
        if (free.length > 0) {
          setDesiredTables(prev => { const n = { ...prev }; delete n[zone.id]; return n })
          invalidate()
        }
      }
    } finally {
      setSyncing(prev => ({ ...prev, [zone.id]: false }))
    }
  }

  function handleDelete(zone) {
    const mainTables = (zone.tables ?? []).filter(t => !t.parent_table_id)
    if (mainTables.length > 0) {
      setZoneError(zone.id, 'Impossibile eliminare: la zona ha tavoli attivi')
      return
    }
    if (!confirm(`Eliminare la zona "${zone.name}"?`)) return
    deleteMut.mutate(zone.id, {
      onError: (e) => setZoneError(zone.id, e.response?.data?.message ?? 'Impossibile eliminare la zona'),
    })
  }

  const sorted = [...zones].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--color-text-primary)' }}>
        Gestione Zone
      </h1>

      {/* Add zone form */}
      <div style={{
        background: 'var(--color-background-secondary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 12, padding: 16, marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-secondary)' }}>
          Aggiungi zona
        </h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={newName}
            onChange={e => { setNewName(e.target.value); setFormError('') }}
            onKeyDown={e => e.key === 'Enter' && newName.trim() && createMut.mutate({ name: newName.trim(), is_outdoor: newOutdoor })}
            placeholder="Nome zona"
            style={{
              flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={newOutdoor} onChange={e => setNewOutdoor(e.target.checked)} />
            Outdoor
          </label>
          <button
            onClick={() => newName.trim() && createMut.mutate({ name: newName.trim(), is_outdoor: newOutdoor })}
            disabled={!newName.trim() || createMut.isPending}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-background-info)', color: 'var(--color-text-info)',
              border: 'none', cursor: 'pointer', opacity: !newName.trim() || createMut.isPending ? 0.5 : 1,
            }}
          >
            {createMut.isPending ? '...' : 'Aggiungi'}
          </button>
        </div>
        {formError && (
          <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginTop: 8 }}>{formError}</div>
        )}
      </div>

      {isLoading && (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Caricamento...</div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          Nessuna zona configurata. Aggiungi la prima zona qui sopra.
        </div>
      )}

      {/* Zone cards */}
      {sorted.map((zone, idx) => {
        const mainTables = (zone.tables ?? []).filter(t => !t.parent_table_id)
        const currentCount = mainTables.length
        const desired = desiredTables[zone.id] ?? String(currentCount)
        const zoneError = zoneErrors[zone.id]
        const isSyncing = syncing[zone.id]

        return (
          <div key={zone.id} style={{
            background: 'var(--color-background-secondary)',
            border: '1px solid var(--color-border-tertiary)',
            borderRadius: 12, padding: 16, marginBottom: 12,
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {/* Up/Down */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  onClick={() => moveZone(zone, 'up')}
                  disabled={idx === 0}
                  style={{ ...arrowBtn, opacity: idx === 0 ? 0.3 : 1 }}
                  title="Sposta su"
                >↑</button>
                <button
                  onClick={() => moveZone(zone, 'down')}
                  disabled={idx === sorted.length - 1}
                  style={{ ...arrowBtn, opacity: idx === sorted.length - 1 ? 0.3 : 1 }}
                  title="Sposta giù"
                >↓</button>
              </div>

              {/* Name (editable inline) */}
              {editingId === zone.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={() => saveEdit(zone)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(zone)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 15, fontWeight: 600,
                    border: '1px solid var(--color-border-info)',
                    background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={() => startEdit(zone)}
                  style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'default' }}
                  title="Doppio clic per rinominare"
                >
                  {zone.name}
                </span>
              )}

              {/* Outdoor badge */}
              {zone.is_outdoor && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  background: 'var(--color-background-warning)', color: 'var(--color-text-warning)',
                }}>
                  Outdoor
                </span>
              )}

              {/* Edit button */}
              {editingId !== zone.id && (
                <button onClick={() => startEdit(zone)} style={iconBtn} title="Rinomina zona">✏</button>
              )}

              {/* Enabled toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={zone.is_enabled}
                  onChange={() => toggleMut.mutate(zone.id)}
                />
                {zone.is_enabled ? 'Attiva' : 'Disattivata'}
              </label>

              {/* Delete */}
              <button
                onClick={() => handleDelete(zone)}
                style={{ ...iconBtn, color: 'var(--color-text-danger)' }}
                title="Elimina zona"
              >🗑</button>
            </div>

            {/* Table count row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {currentCount} tavol{currentCount === 1 ? 'o' : 'i'} attivi
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Tavoli:</label>
                <input
                  type="number"
                  min={0}
                  value={desired}
                  onChange={e => {
                    setDesiredTables(prev => ({ ...prev, [zone.id]: e.target.value }))
                    setZoneError(zone.id, '')
                  }}
                  style={{
                    width: 64, padding: '4px 8px', borderRadius: 6, fontSize: 13,
                    border: '1px solid var(--color-border-secondary)',
                    background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
                  }}
                />
                <button
                  onClick={() => syncTables(zone)}
                  disabled={isSyncing}
                  style={{
                    padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: 'var(--color-background-info)', color: 'var(--color-text-info)',
                    border: 'none', cursor: 'pointer', opacity: isSyncing ? 0.6 : 1,
                  }}
                >
                  {isSyncing ? '...' : 'Applica'}
                </button>
              </div>
            </div>

            {zoneError && (
              <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginTop: 8 }}>
                {zoneError}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
