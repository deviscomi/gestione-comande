import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { zonesApi } from '../../api/endpoints/zones'

const FIELD = {
  padding: '7px 10px', borderRadius: 6, fontSize: 13,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box',
}
const BTN = (variant = 'primary') => ({
  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', border: 'none',
  background: variant === 'danger'
    ? 'var(--color-background-danger)' : variant === 'secondary'
      ? 'var(--color-background-secondary)' : 'var(--color-background-info)',
  color: variant === 'secondary'
    ? 'var(--color-text-secondary)' : 'var(--color-text-inverse)',
})

function ZoneModal({ zone, onClose }) {
  const qc = useQueryClient()
  const isNew = !zone?.id
  const [form, setForm] = useState({
    name: zone?.name ?? '',
    is_outdoor: zone?.is_outdoor ?? false,
    sort_order: zone?.sort_order ?? 0,
  })

  const save = useMutation({
    mutationFn: () => isNew
      ? zonesApi.create(form)
      : zonesApi.update(zone.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-admin'] }); onClose() },
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-background-primary)', borderRadius: 10,
        padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 15 }}>
          {isNew ? 'Nuova zona' : `Modifica zona — ${zone.name}`}
        </h3>

        <label style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
          Nome zona
        </label>
        <input
          style={{ ...FIELD, marginBottom: 12 }}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="es. Sala interna"
        />

        <label style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
          Ordine visualizzazione
        </label>
        <input
          type="number" min={0} style={{ ...FIELD, marginBottom: 12 }}
          value={form.sort_order}
          onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox" checked={form.is_outdoor}
            onChange={e => setForm(f => ({ ...f, is_outdoor: e.target.checked }))}
          />
          Zona esterna (outdoor)
        </label>

        {save.isError && (
          <div style={{ marginBottom: 12, color: 'var(--color-text-danger)', fontSize: 12 }}>
            {save.error?.response?.data?.message ?? 'Errore salvataggio'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={BTN('secondary')} onClick={onClose}>Annulla</button>
          <button style={BTN()} onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
            {save.isPending ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddTableModal({ zone, onClose }) {
  const qc = useQueryClient()
  const [number, setNumber] = useState('')

  const add = useMutation({
    mutationFn: () => zonesApi.createTable(zone.id, parseInt(number)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-admin'] }); onClose() },
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-background-primary)', borderRadius: 10,
        padding: 24, width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>Aggiungi tavolo — {zone.name}</h3>
        <label style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
          Numero tavolo
        </label>
        <input
          type="number" min={1} style={{ ...FIELD, marginBottom: 16 }}
          value={number}
          onChange={e => setNumber(e.target.value)}
          placeholder="es. 10"
          autoFocus
        />
        {add.isError && (
          <div style={{ marginBottom: 12, color: 'var(--color-text-danger)', fontSize: 12 }}>
            {add.error?.response?.data?.message ?? 'Errore creazione tavolo'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={BTN('secondary')} onClick={onClose}>Annulla</button>
          <button style={BTN()} onClick={() => add.mutate()} disabled={!number || add.isPending}>
            {add.isPending ? 'Aggiunta…' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Zones() {
  const qc = useQueryClient()
  const [editZone, setEditZone] = useState(null)
  const [addTableZone, setAddTableZone] = useState(null)
  const [newZone, setNewZone] = useState(false)

  const { data: zones, isLoading, isError } = useQuery({
    queryKey: ['zones-admin'],
    queryFn: () => zonesApi.getAll().then(r => r.data.data),
  })

  const toggleZone = useMutation({
    mutationFn: (id) => zonesApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones-admin'] }),
  })

  const deleteZone = useMutation({
    mutationFn: (id) => zonesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones-admin'] }),
    onError: (err) => alert(err.response?.data?.message ?? 'Impossibile eliminare la zona'),
  })

  const deleteTable = useMutation({
    mutationFn: (id) => zonesApi.deleteTable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones-admin'] }),
    onError: (err) => alert(err.response?.data?.message ?? 'Impossibile eliminare il tavolo'),
  })

  function confirmDeleteZone(zone) {
    if (window.confirm(`Eliminare la zona "${zone.name}" e tutti i suoi tavoli liberi?`)) {
      deleteZone.mutate(zone.id)
    }
  }

  function confirmDeleteTable(table) {
    if (window.confirm(`Eliminare il tavolo ${table.number}?`)) {
      deleteTable.mutate(table.id)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Gestione Zone</h2>
        <button style={BTN()} onClick={() => setNewZone(true)}>+ Nuova zona</button>
      </div>

      {isLoading && (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Caricamento…</div>
      )}

      {isError && (
        <div style={{ color: 'var(--color-text-danger)', fontSize: 13 }}>
          Errore caricamento zone
        </div>
      )}

      {zones?.map(zone => (
        <div key={zone.id} style={{
          background: 'var(--color-background-secondary)',
          border: '1px solid var(--color-border-tertiary)',
          borderRadius: 10, marginBottom: 16, overflow: 'hidden',
          opacity: zone.is_enabled ? 1 : 0.6,
        }}>
          {/* Zone header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-tertiary)',
            background: 'var(--color-background-secondary)',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
              {zone.name}
              {zone.is_outdoor && (
                <span style={{
                  marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: 'var(--color-background-success)',
                  color: 'var(--color-text-success)', fontWeight: 600,
                }}>Outdoor</span>
              )}
              {!zone.is_enabled && (
                <span style={{
                  marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: 'var(--color-background-warning)',
                  color: 'var(--color-text-warning)', fontWeight: 600,
                }}>Disabilitata</span>
              )}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {zone.tables?.length ?? 0} tavoli · ordine {zone.sort_order}
            </span>
            <button style={BTN('secondary')} onClick={() => setAddTableZone(zone)}>+ Tavolo</button>
            <button style={BTN('secondary')} onClick={() => setEditZone(zone)}>Modifica</button>
            <button
              style={BTN(zone.is_enabled ? 'secondary' : 'primary')}
              onClick={() => toggleZone.mutate(zone.id)}
              disabled={toggleZone.isPending}
            >
              {zone.is_enabled ? 'Disabilita' : 'Abilita'}
            </button>
            <button style={BTN('danger')} onClick={() => confirmDeleteZone(zone)}>Elimina</button>
          </div>

          {/* Tables grid */}
          {zone.tables?.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              Nessun tavolo — usa "+ Tavolo" per aggiungerne uno
            </div>
          ) : (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8,
              padding: 12,
            }}>
              {zone.tables?.map(table => {
                const occupied = table.status !== 'libero'
                return (
                  <div key={table.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 7,
                    background: occupied ? 'var(--color-background-danger)' : 'var(--color-background-primary)',
                    border: `1px solid ${occupied ? 'var(--color-border-danger)' : 'var(--color-border-secondary)'}`,
                    fontSize: 12,
                  }}>
                    <span style={{ fontWeight: 600 }}>T{table.number}</span>
                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{table.status}</span>
                    {!occupied && (
                      <button
                        onClick={() => confirmDeleteTable(table)}
                        style={{
                          marginLeft: 2, background: 'none', border: 'none',
                          cursor: 'pointer', color: 'var(--color-text-danger)',
                          fontSize: 13, lineHeight: 1, padding: '0 2px',
                        }}
                        title="Elimina tavolo"
                      >×</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {zones?.length === 0 && !isLoading && (
        <div style={{
          padding: 40, textAlign: 'center',
          color: 'var(--color-text-tertiary)', fontSize: 14,
        }}>
          Nessuna zona configurata — creane una con il pulsante in alto
        </div>
      )}

      {(newZone || editZone) && (
        <ZoneModal
          zone={editZone ?? undefined}
          onClose={() => { setNewZone(false); setEditZone(null) }}
        />
      )}
      {addTableZone && (
        <AddTableModal
          zone={addTableZone}
          onClose={() => setAddTableZone(null)}
        />
      )}
    </div>
  )
}
