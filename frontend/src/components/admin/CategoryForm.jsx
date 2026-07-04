import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

const DEPARTMENT_LABELS = {
  cucina:     'Cucina',
  pizzeria:   'Pizzeria',
  bevande:    'Bevande',
  dessert:    'Dessert',
  amari:      'Amari',
  vini_casa:  'Vini casa',
  carta_vini: 'Carta vini',
  bar:        'Bar',
}

export default function CategoryForm({ category, department, onClose, onSave }) {
  const [form, setForm] = useState({
    name: category?.name ?? '',
    department: category?.department ?? department,
    sort_order: category?.sort_order ?? 0,
  })
  const [error, setError] = useState('')

  const saveMut = useMutation({
    mutationFn: () => category?.id ? adminApi.updateCategory(category.id, form) : adminApi.createCategory(form),
    onSuccess: onSave,
    onError: (e) => setError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  const F = inputStyle

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 420, padding: 24, borderRadius: 12,
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{category?.id ? 'Modifica portata' : 'Nuova portata'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nome</label>
          <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={F} />
        </div>

        <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Reparto</label>
            <div style={{ ...F, color: 'var(--color-text-secondary)' }}>
              {DEPARTMENT_LABELS[form.department] ?? form.department}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Ordine</label>
            <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} style={F} />
          </div>
        </div>

        {error && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
          }}>Annulla</button>
          <button onClick={() => saveMut.mutate()} disabled={!form.name.trim() || saveMut.isPending} style={{
            flex: 2, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            opacity: (!form.name.trim() || saveMut.isPending) ? 0.7 : 1
          }}>{saveMut.isPending ? 'Salvataggio...' : category?.id ? 'Salva modifiche' : 'Crea portata'}</button>
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
