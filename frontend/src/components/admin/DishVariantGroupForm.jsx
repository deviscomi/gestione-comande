import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'

const EMPTY_OPTION = { name: '', price_add: '0.00' }

export default function DishVariantGroupForm({ group, department, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', is_required: false, options: [{ ...EMPTY_OPTION }] })
  const [error, setError] = useState('')

  useEffect(() => {
    if (group?.id) {
      setForm({
        name: group.name,
        is_required: group.is_required,
        options: (group.options ?? []).map(o => ({ id: o.id, name: o.name, price_add: o.price_add })),
      })
    }
  }, [group])

  const saveMut = useMutation({
    mutationFn: () => group?.id ? menuApi.updateDishVariantGroup(group.id, form) : menuApi.createDishVariantGroup({ ...form, department }),
    onSuccess: onSave,
    onError: (e) => setError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  function updateOption(idx, field, value) {
    setForm(p => ({
      ...p,
      options: p.options.map((o, i) => i === idx ? { ...o, [field]: value } : o)
    }))
  }

  function addOption() {
    setForm(p => ({ ...p, options: [...p.options, { ...EMPTY_OPTION }] }))
  }

  function removeOption(idx) {
    setForm(p => ({ ...p, options: p.options.filter((_, i) => i !== idx) }))
  }

  const F = inputStyle
  const validOptions = form.options.filter(o => o.name.trim())
  const canSave = form.name.trim() && validOptions.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24,
        borderRadius: 12, background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{group?.id ? 'Modifica gruppo variante' : 'Nuovo gruppo variante'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nome gruppo</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="es. Porzione" style={F} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_required} onChange={e => setForm(p => ({ ...p, is_required: e.target.checked }))} />
            Obbligatorio (il cameriere deve scegliere un'opzione)
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={labelStyle}>Opzioni</div>
          {form.options.map((opt, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                value={opt.name}
                onChange={e => updateOption(idx, 'name', e.target.value)}
                placeholder="es. Abbondante"
                style={{ ...F, flex: 2 }}
              />
              <input
                type="number" step="0.10" min="0"
                value={opt.price_add}
                onChange={e => updateOption(idx, 'price_add', e.target.value)}
                style={{ ...F, flex: 1 }}
              />
              <button onClick={() => removeOption(idx)} style={{
                background: 'transparent', border: '1px solid var(--color-border-danger)',
                color: 'var(--color-text-danger)', borderRadius: 6, fontSize: 11, padding: '6px 10px'
              }}>×</button>
            </div>
          ))}
          <button onClick={addOption} style={{
            fontSize: 12, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0'
          }}>+ Aggiungi opzione</button>
        </div>

        {error && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
          }}>Annulla</button>
          <button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending} style={{
            flex: 2, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: (!canSave || saveMut.isPending) ? 0.7 : 1
          }}>{saveMut.isPending ? 'Salvataggio...' : group?.id ? 'Salva modifiche' : 'Crea gruppo'}</button>
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
