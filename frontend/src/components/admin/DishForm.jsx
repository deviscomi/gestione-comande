import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'

export default function DishForm({ dish, categories, department, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', description: '', price: '', category_id: '', is_active: true,
    ingredients: [], variant_group_ids: []
  })
  const [error, setError] = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')

  useEffect(() => {
    if (dish?.id) {
      menuApi.getDish(dish.id).then(r => {
        const d = r.data?.data ?? r.data
        setForm({
          name: d.name, description: d.description ?? '', price: d.price,
          category_id: d.category_id, is_active: d.is_active,
          ingredients: [
            ...(d.default_ingredients ?? []).map(i => ({ ingredient_id: i.id, is_default: true })),
            ...(d.available_additions ?? []).map(i => ({ ingredient_id: i.id, is_default: false })),
          ],
          variant_group_ids: (d.variant_groups ?? []).map(g => g.id),
        })
      })
    } else if (dish?.category_id) {
      setForm(f => ({ ...f, category_id: dish.category_id }))
    }
  }, [dish])

  const { data: allIngredients } = useQuery({
    queryKey: ['ingredients', department],
    queryFn: () => menuApi.getIngredients({ is_active: true, department }).then(r => r.data.data),
  })

  const { data: ingredientCategories } = useQuery({
    queryKey: ['ingredient-categories', department],
    queryFn: () => menuApi.getIngredientCategories({ is_active: true, department }).then(r => r.data.data),
  })

  const { data: variantGroups } = useQuery({
    queryKey: ['dish-variant-groups', department, 'active'],
    queryFn: () => menuApi.getDishVariantGroups({ is_active: true, department }).then(r => r.data.data),
  })

  const saveMut = useMutation({
    mutationFn: () => dish?.id ? menuApi.updateDish(dish.id, form) : menuApi.createDish(form),
    onSuccess: onSave,
    onError: (e) => setError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  function toggleIngredient(id, isDefault) {
    setForm(p => {
      const exists = p.ingredients.find(i => i.ingredient_id === id)
      if (exists) return { ...p, ingredients: p.ingredients.filter(i => i.ingredient_id !== id) }
      return { ...p, ingredients: [...p.ingredients, { ingredient_id: id, is_default: isDefault }] }
    })
  }

  function toggleVariantGroup(id) {
    setForm(p => ({
      ...p,
      variant_group_ids: p.variant_group_ids.includes(id)
        ? p.variant_group_ids.filter(g => g !== id)
        : [...p.variant_group_ids, id]
    }))
  }

  const selectedDefault   = form.ingredients.filter(i => i.is_default).map(i => i.ingredient_id)
  const selectedAdditions = form.ingredients.filter(i => !i.is_default).map(i => i.ingredient_id)

  const [openGroups, setOpenGroups] = useState({})
  function toggleGroup(key) {
    setOpenGroups(p => ({ ...p, [key]: !p[key] }))
  }

  function groupIngredients(list) {
    const sortedCategories = [...(ingredientCategories ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    const groups = sortedCategories
      .map(cat => ({ cat, items: list.filter(i => i.ingredient_category_id === cat.id) }))
      .filter(g => g.items.length > 0)
    const noCategory = list.filter(i => !i.ingredient_category_id)
    return { groups, noCategory }
  }

  function renderIngredientTags(list, selectedIds, isDefault) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {list.map(ing => {
          const sel = selectedIds.includes(ing.id)
          return (
            <button key={ing.id} type="button" onClick={() => toggleIngredient(ing.id, isDefault)} style={{
              padding: '6px 10px', minHeight: 36, borderRadius: 12, fontSize: 11,
              border: '1px solid var(--color-border-secondary)',
              background: sel ? (isDefault ? 'var(--color-background-success)' : 'var(--color-background-info)') : 'var(--color-background-secondary)',
              color: sel ? (isDefault ? 'var(--color-text-success)' : 'var(--color-text-info)') : 'var(--color-text-secondary)'
            }}>{ing.name}{!isDefault ? ` +€${ing.price_add}` : ''}</button>
          )
        })}
      </div>
    )
  }

  function renderIngredientSection(list, selectedIds, isDefault, sectionKey) {
    const search = ingredientSearch.trim().toLowerCase()
    if (search) {
      const filtered = list.filter(i => i.name.toLowerCase().includes(search))
      return renderIngredientTags(filtered, selectedIds, isDefault)
    }
    const { groups, noCategory } = groupIngredients(list)
    return (
      <div>
        {groups.map(({ cat, items }) => {
          const key = `${sectionKey}-${cat.id}`
          const open = !!openGroups[key]
          return (
            <div key={cat.id} style={{ marginBottom: 6 }}>
              <button type="button" onClick={() => toggleGroup(key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', minHeight: 36
              }}>
                <span>{open ? '▼' : '▶'}</span>{cat.name}
                <span style={{ fontSize: 10, opacity: 0.7 }}>({items.length})</span>
              </button>
              {open && renderIngredientTags(items, selectedIds, isDefault)}
            </div>
          )
        })}
        {noCategory.length > 0 && (() => {
          const key = `${sectionKey}-none`
          const open = !!openGroups[key]
          return (
            <div style={{ marginBottom: 6 }}>
              <button type="button" onClick={() => toggleGroup(key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                fontSize: 12, fontWeight: 600, fontStyle: 'italic', color: 'var(--color-text-tertiary)', minHeight: 36
              }}>
                <span>{open ? '▼' : '▶'}</span>Senza categoria
                <span style={{ fontSize: 10, opacity: 0.7 }}>({noCategory.length})</span>
              </button>
              {open && renderIngredientTags(noCategory, selectedIds, isDefault)}
            </div>
          )
        })()}
      </div>
    )
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
          <span style={{ fontWeight: 700, fontSize: 15 }}>{dish?.id ? 'Modifica piatto' : 'Nuovo piatto'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nome</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={F} />
        </div>

        <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Prezzo (€)</label>
            <input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} style={F} />
          </div>
          <div>
            <label style={labelStyle}>Categoria</label>
            <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} style={F}>
              <option value="">Seleziona...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Descrizione</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
            style={{ ...F, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            Piatto attivo (visibile nel menu)
          </label>
        </div>

        {allIngredients && (
          <>
            <div style={{ marginBottom: 12 }}>
              <input
                value={ingredientSearch}
                onChange={e => setIngredientSearch(e.target.value)}
                placeholder="Cerca ingrediente..."
                style={{ ...F, minHeight: 36 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Ingredienti di default</div>
              {renderIngredientSection(allIngredients, selectedDefault, true, 'default')}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Aggiunte disponibili</div>
              {renderIngredientSection(allIngredients.filter(i => !selectedDefault.includes(i.id)), selectedAdditions, false, 'additions')}
            </div>
          </>
        )}

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
          }}>{saveMut.isPending ? 'Salvataggio...' : dish?.id ? 'Salva modifiche' : 'Crea piatto'}</button>
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
