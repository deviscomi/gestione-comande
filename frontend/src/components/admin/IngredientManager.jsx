import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'

const ROW = { padding: '8px 14px', borderRadius: 8, marginBottom: 4, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', display: 'flex', alignItems: 'center', gap: 10 }
const BTN = { fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', cursor: 'pointer', minHeight: 36 }
const INP = { padding: '6px 9px', borderRadius: 7, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }
const LABEL = { fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4, fontWeight: 500 }

const EMPTY_ING = { name: '', ingredient_category_id: '', price_add: '0.00', price_remove: '0.00', is_active: true }
const EMPTY_CAT = { name: '', sort_order: 0, is_active: true }

export default function IngredientManager({ department }) {
  const qc = useQueryClient()
  const [expandedCat, setExpandedCat] = useState(null) // id | 'none' | null

  const [editCat, setEditCat] = useState(null) // null | 'new' | category
  const [catForm, setCatForm] = useState(EMPTY_CAT)
  const [catError, setCatError] = useState('')

  const [editIng, setEditIng] = useState(null) // null | 'new' | ingredient
  const [ingForm, setIngForm] = useState(EMPTY_ING)
  const [ingError, setIngError] = useState('')

  const { data: categories } = useQuery({
    queryKey: ['ingredient-categories', department],
    queryFn: () => menuApi.getIngredientCategories({ department }).then(r => r.data.data),
  })

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients', department],
    queryFn: () => menuApi.getIngredients({ department }).then(r => r.data.data),
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['ingredient-categories', department] })
    qc.invalidateQueries({ queryKey: ['ingredients', department] })
  }

  // ── Categorie ──────────────────────────────────────────────────────────
  const toggleCatMut = useMutation({
    mutationFn: (id) => menuApi.toggleIngredientCategory(id),
    onSuccess: invalidateAll,
  })
  const deleteCatMut = useMutation({
    mutationFn: (id) => menuApi.deleteIngredientCategory(id),
    onSuccess: invalidateAll,
    onError: (e) => alert(e.response?.data?.message ?? 'Impossibile eliminare la categoria'),
  })
  const saveCatMut = useMutation({
    mutationFn: () => editCat?.id ? menuApi.updateIngredientCategory(editCat.id, catForm) : menuApi.createIngredientCategory({ ...catForm, department }),
    onSuccess: () => { invalidateAll(); setEditCat(null) },
    onError: (e) => setCatError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  function startEditCat(cat) {
    setEditCat(cat)
    setCatForm(cat === 'new' ? EMPTY_CAT : { name: cat.name, sort_order: cat.sort_order, is_active: cat.is_active })
    setCatError('')
  }

  // ── Ingredienti ────────────────────────────────────────────────────────
  const toggleIngMut = useMutation({
    mutationFn: (id) => menuApi.toggleIngredient(id),
    onSuccess: invalidateAll,
  })
  const deleteIngMut = useMutation({
    mutationFn: (id) => menuApi.deleteIngredient(id),
    onSuccess: invalidateAll,
    onError: (e) => alert(e.response?.data?.message ?? 'Impossibile eliminare l\'ingrediente'),
  })
  const saveIngMut = useMutation({
    mutationFn: () => editIng?.id ? menuApi.updateIngredient(editIng.id, ingForm) : menuApi.createIngredient({ ...ingForm, department }),
    onSuccess: () => { invalidateAll(); setEditIng(null) },
    onError: (e) => setIngError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  function startEditIng(ing, categoryId) {
    setEditIng(ing)
    setIngForm(ing === 'new'
      ? { ...EMPTY_ING, ingredient_category_id: categoryId ?? '' }
      : { name: ing.name, ingredient_category_id: ing.ingredient_category_id ?? '', price_add: ing.price_add, price_remove: ing.price_remove, is_active: ing.is_active })
    setIngError('')
  }

  const sortedCategories = [...(categories ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const noCatIngredients = ingredients?.filter(i => !i.ingredient_category_id) ?? []

  function renderIngredientsList(list, categoryId) {
    return (
      <div>
        {list.length === 0 && <p style={{ padding: '8px 14px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>Nessun ingrediente in questa categoria.</p>}
        {list.map(ing => (
          <div key={ing.id} style={{ ...ROW, opacity: ing.is_active ? 1 : 0.55 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{ing.name}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-success)', minWidth: 70 }}>+€ {Number(ing.price_add).toFixed(2)}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-danger)', minWidth: 70 }}>-€ {Number(ing.price_remove).toFixed(2)}</span>
            <button onClick={() => toggleIngMut.mutate(ing.id)} style={{ ...BTN, background: ing.is_active ? 'var(--color-background-success)' : undefined, color: ing.is_active ? 'var(--color-text-success)' : undefined }}>
              {ing.is_active ? '✓ Attivo' : '○ Inattivo'}
            </button>
            <button onClick={() => startEditIng(ing)} style={BTN}>Modifica</button>
            <button onClick={() => { if (confirm(`Eliminare "${ing.name}"?`)) deleteIngMut.mutate(ing.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>
              Elimina
            </button>
          </div>
        ))}
        <div style={{ padding: '8px 14px' }}>
          <button onClick={() => startEditIng('new', categoryId)} style={{ fontSize: 12, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer', minHeight: 36 }}>
            + Aggiungi ingrediente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => startEditCat('new')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)', minHeight: 36 }}>
          + Aggiungi categoria
        </button>
      </div>

      {sortedCategories.map(cat => {
        const catIngredients = ingredients?.filter(i => i.ingredient_category_id === cat.id) ?? []
        const open = expandedCat === cat.id
        return (
          <div key={cat.id} style={{ marginBottom: 10, border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => setExpandedCat(open ? null : cat.id)}>
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{cat.name}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {catIngredients.filter(i => i.is_active).length}/{catIngredients.length} attivi
              </span>
              <button onClick={e => { e.stopPropagation(); toggleCatMut.mutate(cat.id) }} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 6, minHeight: 36,
                border: '1px solid var(--color-border-secondary)',
                background: cat.is_active ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
                color: cat.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)'
              }}>{cat.is_active ? '✓ Attiva' : '○ Inattiva'}</button>
              <button onClick={e => { e.stopPropagation(); startEditCat(cat) }} style={{ ...BTN }}>
                Modifica
              </button>
              <button onClick={e => { e.stopPropagation(); if (confirm(`Eliminare la categoria "${cat.name}"?`)) deleteCatMut.mutate(cat.id) }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, minHeight: 36, border: '1px solid var(--color-border-danger)', background: 'transparent', color: 'var(--color-text-danger)' }}>
                Elimina
              </button>
              <span>{open ? '▼' : '▶'}</span>
            </div>
            {open && renderIngredientsList(catIngredients, cat.id)}
          </div>
        )
      })}

      {/* Senza categoria */}
      <div style={{ marginBottom: 10, border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => setExpandedCat(expandedCat === 'none' ? null : 'none')}>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>Senza categoria</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            {noCatIngredients.filter(i => i.is_active).length}/{noCatIngredients.length} attivi
          </span>
          <span>{expandedCat === 'none' ? '▼' : '▶'}</span>
        </div>
        {expandedCat === 'none' && renderIngredientsList(noCatIngredients, null)}
      </div>

      {/* Modale categoria */}
      {editCat !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 420, padding: 24, borderRadius: 12, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{editCat?.id ? 'Modifica categoria' : 'Nuova categoria'}</span>
              <button onClick={() => setEditCat(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={LABEL}>Nome</label>
              <input autoFocus value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} style={{ ...INP, width: '100%' }} />
            </div>
            <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Ordine</label>
                <input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: e.target.value }))} style={{ ...INP, width: '100%' }} />
              </div>
              <div>
                <label style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
                  <input type="checkbox" checked={catForm.is_active} onChange={e => setCatForm(p => ({ ...p, is_active: e.target.checked }))} />
                  Attiva
                </label>
              </div>
            </div>
            {catError && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{catError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditCat(null)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }}>Annulla</button>
              <button onClick={() => saveCatMut.mutate()} disabled={!catForm.name.trim() || saveCatMut.isPending} style={{ flex: 2, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: (!catForm.name.trim() || saveCatMut.isPending) ? 0.7 : 1 }}>
                {saveCatMut.isPending ? 'Salvataggio...' : editCat?.id ? 'Salva modifiche' : 'Crea categoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale ingrediente */}
      {editIng !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 460, padding: 24, borderRadius: 12, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{editIng?.id ? 'Modifica ingrediente' : 'Nuovo ingrediente'}</span>
              <button onClick={() => setEditIng(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={LABEL}>Nome</label>
              <input autoFocus value={ingForm.name} onChange={e => setIngForm(p => ({ ...p, name: e.target.value }))} style={{ ...INP, width: '100%' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={LABEL}>Categoria</label>
              <select value={ingForm.ingredient_category_id} onChange={e => setIngForm(p => ({ ...p, ingredient_category_id: e.target.value }))} style={{ ...INP, width: '100%' }}>
                <option value="">Senza categoria</option>
                {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Prezzo aggiunta (€)</label>
                <input type="number" step="0.10" min="0" value={ingForm.price_add} onChange={e => setIngForm(p => ({ ...p, price_add: e.target.value }))} style={{ ...INP, width: '100%' }} />
              </div>
              <div>
                <label style={LABEL}>Prezzo rimozione (€)</label>
                <input type="number" step="0.10" min="0" value={ingForm.price_remove} onChange={e => setIngForm(p => ({ ...p, price_remove: e.target.value }))} style={{ ...INP, width: '100%' }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={ingForm.is_active} onChange={e => setIngForm(p => ({ ...p, is_active: e.target.checked }))} />
                Ingrediente attivo
              </label>
            </div>
            {ingError && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{ingError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditIng(null)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }}>Annulla</button>
              <button onClick={() => saveIngMut.mutate()} disabled={!ingForm.name.trim() || saveIngMut.isPending} style={{ flex: 2, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: (!ingForm.name.trim() || saveIngMut.isPending) ? 0.7 : 1 }}>
                {saveIngMut.isPending ? 'Salvataggio...' : editIng?.id ? 'Salva modifiche' : 'Crea ingrediente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
