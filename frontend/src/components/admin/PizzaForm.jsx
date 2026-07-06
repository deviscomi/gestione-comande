import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'

export default function PizzaForm({ pizza, categories = [], onClose, onSave }) {
  const [form, setForm] = useState({ category_id: '', name: '', description: '', base_price: '', is_active: true, default_base: '', default_ingredients: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    if (pizza?.id) {
      menuApi.getPizza(pizza.id).then(r => {
        const d = r.data?.data ?? r.data
        setForm({ category_id: d.category_id ?? '', name: d.name, description: d.description ?? '', base_price: d.base_price, is_active: d.is_active, default_base: d.default_base ?? '', default_ingredients: d.default_ingredients?.map(i => i.id) ?? [] })
      })
    } else if (pizza?.category_id) {
      setForm(f => ({ ...f, category_id: pizza.category_id }))
    }
  }, [pizza])

  const { data: ingredients } = useQuery({
    queryKey: ['pizza-ingredients-active'],
    queryFn: () => menuApi.getPizzaIngredients({ is_active: true }).then(r => r.data.data),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = { ...form, default_base: form.default_base || null }
      return pizza?.id ? menuApi.updatePizza(pizza.id, payload) : menuApi.createPizza(payload)
    },
    onSuccess: onSave,
    onError: (e) => setError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  function toggleIng(id) {
    setForm(p => ({
      ...p,
      default_ingredients: p.default_ingredients.includes(id)
        ? p.default_ingredients.filter(i => i !== id)
        : [...p.default_ingredients, id]
    }))
  }

  const F = { width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24, borderRadius: 12, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{pizza?.id ? 'Modifica pizza' : 'Nuova pizza'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {[
          { key: 'name', label: 'Nome pizza' },
          { key: 'description', label: 'Descrizione', textarea: true },
          { key: 'base_price', label: 'Prezzo base (€)', type: 'number' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
            {f.textarea
              ? <textarea value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} rows={2} style={{ ...F, resize: 'vertical' }} />
              : <input type={f.type ?? 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={F} />
            }
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Categoria</label>
          <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} style={F}>
            <option value="">Seleziona...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Base di default</label>
          <select value={form.default_base} onChange={e => setForm(p => ({ ...p, default_base: e.target.value }))} style={F}>
            <option value="">Nessuna</option>
            {['M', "Rose'", 'R', 'B', 'S'].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            Pizza attiva (visibile nel menu)
          </label>
        </div>

        {ingredients && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, fontWeight: 500 }}>Ingredienti di default</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ingredients.map(ing => {
                const sel = form.default_ingredients.includes(ing.id)
                return (
                  <button key={ing.id} onClick={() => toggleIng(ing.id)} style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11,
                    border: '1px solid var(--color-border-secondary)',
                    background: sel ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
                    color: sel ? 'var(--color-text-success)' : 'var(--color-text-secondary)'
                  }}>{ing.name}</button>
                )
              })}
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }}>Annulla</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} style={{ flex: 2, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: saveMut.isPending ? 0.7 : 1 }}>
            {saveMut.isPending ? 'Salvataggio...' : pizza?.id ? 'Salva' : 'Crea pizza'}
          </button>
        </div>
      </div>
    </div>
  )
}
