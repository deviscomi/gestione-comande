import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'

export default function WineForm({ wine, categoryId, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', producer: '', vintage_year: '', price: '', description: '',
    is_active: true, category_id: categoryId ?? '', variant_group_ids: [],
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (wine?.id) {
      menuApi.getWine(wine.id).then(r => {
        const w = r.data?.data ?? r.data
        setForm({
          name: w.name, producer: w.producer ?? '', vintage_year: w.vintage_year ?? '',
          price: w.price, description: w.description ?? '', is_active: w.is_active,
          category_id: w.category_id,
          variant_group_ids: (w.variant_groups ?? []).map(g => g.id),
        })
      })
    }
  }, [wine])

  const { data: variantGroups } = useQuery({
    queryKey: ['dish-variant-groups', 'vini', 'active'],
    queryFn: () => menuApi.getDishVariantGroups({ department: 'vini', is_active: true }).then(r => r.data.data),
  })

  const saveMut = useMutation({
    mutationFn: () => wine?.id ? menuApi.updateWine(wine.id, form) : menuApi.createWine(form),
    onSuccess: onSave,
    onError: (e) => setError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  function toggleVariantGroup(id) {
    setForm(p => ({
      ...p,
      variant_group_ids: p.variant_group_ids.includes(id)
        ? p.variant_group_ids.filter(g => g !== id)
        : [...p.variant_group_ids, id]
    }))
  }

  const F = inputStyle

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 500, maxHeight: '90vh', overflowY: 'auto', padding: 24,
        borderRadius: 12, background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{wine?.id ? 'Modifica vino' : 'Nuovo vino'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nome</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={F} />
        </div>

        <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Produttore</label>
            <input value={form.producer} onChange={e => setForm(p => ({ ...p, producer: e.target.value }))} style={F} />
          </div>
          <div>
            <label style={labelStyle}>Annata</label>
            <input type="number" value={form.vintage_year} onChange={e => setForm(p => ({ ...p, vintage_year: e.target.value }))} style={F} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Prezzo (€)</label>
          <input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} style={F} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Descrizione</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
            style={{ ...F, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            Vino attivo (visibile nel menu)
          </label>
        </div>

        {variantGroups?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Varianti associate</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {variantGroups.map(g => (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-primary)', minHeight: 28 }}>
                  <input type="checkbox" checked={form.variant_group_ids.includes(g.id)} onChange={() => toggleVariantGroup(g.id)} />
                  {g.name}
                  {g.is_required && <span style={{ fontSize: 10, color: 'var(--color-text-danger)' }}>(obbligatorio)</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
          }}>Annulla</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} style={{
            flex: 2, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: saveMut.isPending ? 0.7 : 1
          }}>{saveMut.isPending ? 'Salvataggio...' : wine?.id ? 'Salva modifiche' : 'Crea vino'}</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
}
const labelStyle = { fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4, fontWeight: 500 }
