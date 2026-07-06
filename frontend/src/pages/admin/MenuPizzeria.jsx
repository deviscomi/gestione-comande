import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'
import { adminApi } from '../../api/endpoints/admin'
import { useAuthStore } from '../../store/useAuthStore'
import PizzaForm from '../../components/admin/PizzaForm'
import CategoryForm from '../../components/admin/CategoryForm'

const ROW = { padding: '8px 14px', borderRadius: 8, marginBottom: 4, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', display: 'flex', alignItems: 'center', gap: 10 }
const BTN = { fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }
const INP = { padding: '6px 9px', borderRadius: 7, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }

const EMPTY_ING = { name: '', price_add: '0.00', price_remove: '0.00', is_active: true }
const EMPTY_VAR = { name: '', code: '', price_add: '0.00' }

export default function MenuPizzeria() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [tab, setTab] = useState('pizzas')

  // Pizze
  const [editPizza, setEditPizza] = useState(null)
  const [expandedCat, setExpandedCat] = useState(null)

  // Portate (categorie)
  const [editCat, setEditCat] = useState(null) // null | 'new' | category

  // Ingredienti
  const [editIng, setEditIng] = useState(null) // null | 'new' | {id,...}
  const [ingForm, setIngForm] = useState(EMPTY_ING)

  // Varianti
  const [showNewVar, setShowNewVar] = useState(false)
  const [varForm, setVarForm] = useState(EMPTY_VAR)

  const { data: categories }  = useQuery({ queryKey: ['categories', 'pizzeria'],   queryFn: () => menuApi.getCategories({ department: 'pizzeria' }).then(r => r.data.data) })
  const { data: pizzas }      = useQuery({ queryKey: ['pizzas-all'],           queryFn: () => menuApi.getPizzas().then(r => r.data.data) })
  const { data: ingredients } = useQuery({ queryKey: ['pizza-ingredients-all'], queryFn: () => menuApi.getPizzaIngredients().then(r => r.data.data) })
  const { data: variants }    = useQuery({ queryKey: ['pizza-variants-all'],    queryFn: () => menuApi.getPizzaVariants().then(r => r.data.data) })

  // Pizze
  const togglePizzaMut = useMutation({ mutationFn: id => menuApi.togglePizza(id),  onSuccess: () => qc.invalidateQueries({ queryKey: ['pizzas-all'] }) })
  const deletePizzaMut = useMutation({ mutationFn: id => menuApi.deletePizza(id),  onSuccess: () => qc.invalidateQueries({ queryKey: ['pizzas-all'] }) })

  // Portate (categorie)
  const toggleCatMut = useMutation({
    mutationFn: (id) => adminApi.toggleCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
  const deleteCatMut = useMutation({
    mutationFn: (id) => adminApi.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e) => alert(e.response?.data?.message ?? 'Impossibile eliminare la portata'),
  })

  // Ingredienti
  const inv = ['pizza-ingredients-all', 'pizza-ingredients-active']
  const onErr = (e) => alert(e.response?.data?.message ?? e.message ?? 'Errore server')

  const createIngMut = useMutation({
    mutationFn: d => menuApi.createPizzaIngredient(d),
    onSuccess: () => { inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setEditIng(null) },
    onError: onErr,
  })
  const updateIngMut = useMutation({
    mutationFn: ({ id, d }) => menuApi.updatePizzaIngredient(id, d),
    onSuccess: () => { inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setEditIng(null) },
    onError: onErr,
  })
  const toggleIngMut = useMutation({ mutationFn: id => menuApi.togglePizzaIngredient(id), onSuccess: () => inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })), onError: onErr })
  const deleteIngMut = useMutation({ mutationFn: id => menuApi.deletePizzaIngredient(id), onSuccess: () => inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })), onError: onErr })

  // Varianti
  const invV = ['pizza-variants-all']
  const createVarMut = useMutation({
    mutationFn: d => menuApi.createPizzaVariant(d),
    onSuccess: () => { invV.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setShowNewVar(false); setVarForm(EMPTY_VAR) },
    onError: onErr,
  })
  const toggleVarMut = useMutation({ mutationFn: id => menuApi.togglePizzaVariant(id),  onSuccess: () => invV.forEach(k => qc.invalidateQueries({ queryKey: [k] })), onError: onErr })
  const deleteVarMut = useMutation({ mutationFn: id => menuApi.deletePizzaVariant(id),  onSuccess: () => invV.forEach(k => qc.invalidateQueries({ queryKey: [k] })), onError: onErr })

  function startEditIng(ing) {
    setEditIng(ing)
    setIngForm({ name: ing.name, price_add: ing.price_add, price_remove: ing.price_remove })
  }

  function saveIng() {
    if (!ingForm.name.trim()) return
    if (editIng === 'new') createIngMut.mutate(ingForm)
    else updateIngMut.mutate({ id: editIng.id, d: ingForm })
  }

  // Riga singola pizza (riusata dentro le categorie e nel bucket "Senza categoria")
  function renderPizzaRow(pizza) {
    return (
      <div key={pizza.id} style={{ ...ROW, opacity: pizza.is_active ? 1 : 0.55, background: pizza.is_active ? 'var(--color-background-primary)' : 'var(--color-background-secondary)' }}>
        <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{pizza.name}</span>
        {pizza.default_base && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border-secondary)', borderRadius: 6, padding: '2px 7px' }}>base {pizza.default_base}</span>}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-info)' }}>&euro; {Number(pizza.base_price).toFixed(2)}</span>
        <button onClick={() => togglePizzaMut.mutate(pizza.id)} style={{ ...BTN, background: pizza.is_active ? 'var(--color-background-success)' : undefined, color: pizza.is_active ? 'var(--color-text-success)' : undefined }}>
          {pizza.is_active ? '✓ Attiva' : '○ Inattiva'}
        </button>
        <button onClick={() => setEditPizza(pizza)} style={BTN}>Modifica</button>
        <button onClick={() => { if (confirm(`Eliminare ${pizza.name}?`)) deletePizzaMut.mutate(pizza.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>Elimina</button>
      </div>
    )
  }

  // Pizze senza una categoria valida (es. categoria eliminata): non devono sparire
  const uncategorized = pizzas?.filter(p => !categories?.some(c => c.id === p.category_id)) ?? []

  const TABS = [
    { key: 'pizzas', label: 'Pizze' },
    { key: 'ingredients', label: 'Ingredienti' },
    { key: 'variants', label: 'Varianti' },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Menu Pizzeria</h1>
        {tab === 'pizzas' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && (
              <button onClick={() => setEditCat('new')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)' }}>
                + Nuova portata
              </button>
            )}
            <button onClick={() => setEditPizza('new')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
              + Aggiungi pizza
            </button>
          </div>
        )}
        {tab === 'ingredients' && (
          <button onClick={() => { setEditIng('new'); setIngForm(EMPTY_ING) }} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            + Aggiungi ingrediente
          </button>
        )}
        {tab === 'variants' && (
          <button onClick={() => { setShowNewVar(true); setVarForm(EMPTY_VAR) }} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            + Aggiungi variante
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border-secondary)', background: tab === t.key ? 'var(--color-background-info)' : 'var(--color-background-secondary)', color: tab === t.key ? 'var(--color-text-info)' : 'var(--color-text-secondary)' }}>
            {t.label}
            {t.key === 'ingredients' && ingredients && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>({ingredients.length})</span>}
            {t.key === 'variants' && variants && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>({variants.length})</span>}
          </button>
        ))}
      </div>

      {/* ══════ PIZZE ══════ */}
      {tab === 'pizzas' && (
        <>
          {categories?.length === 0 && uncategorized.length === 0 && (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Nessuna portata. Creane una con "+ Nuova portata", poi aggiungi le pizze.
            </p>
          )}

          {categories?.map(cat => {
            const catPizzas = pizzas?.filter(p => p.category_id === cat.id) ?? []
            const open = expandedCat === cat.id
            return (
              <div key={cat.id} style={{ marginBottom: 10, border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => setExpandedCat(open ? null : cat.id)}>
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {catPizzas.filter(p => p.is_active).length}/{catPizzas.length} attive
                  </span>
                  <button onClick={e => { e.stopPropagation(); toggleCatMut.mutate(cat.id) }} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    border: '1px solid var(--color-border-secondary)',
                    background: cat.is_active ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
                    color: cat.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)'
                  }}>{cat.is_active ? '✓ Attiva' : '○ Inattiva'}</button>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); setEditCat(cat) }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>
                      Modifica
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); if (confirm(`Eliminare la portata "${cat.name}"?`)) deleteCatMut.mutate(cat.id) }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-danger)', background: 'transparent', color: 'var(--color-text-danger)' }}>
                      Elimina
                    </button>
                  )}
                  <span>{open ? '▼' : '▶'}</span>
                </div>

                {open && (
                  <div style={{ padding: '8px 10px' }}>
                    {catPizzas.map(renderPizzaRow)}
                    <div style={{ padding: '4px 4px 2px' }}>
                      <button onClick={() => setEditPizza({ category_id: cat.id })} style={{ fontSize: 12, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        + Aggiungi pizza a {cat.name}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Bucket pizze senza categoria valida */}
          {uncategorized.length > 0 && (
            <div style={{ marginBottom: 10, border: '1px dashed var(--color-border-danger)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>Senza categoria</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-danger)' }}>{uncategorized.length} da riassegnare</span>
              </div>
              <div style={{ padding: '8px 10px' }}>
                {uncategorized.map(renderPizzaRow)}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════ INGREDIENTI ══════ */}
      {tab === 'ingredients' && (
        <>
          {/* Form add/edit */}
          {editIng !== null && (
            <div style={{ padding: 16, borderRadius: 10, marginBottom: 14, border: '2px solid var(--color-border-info)', background: 'var(--color-background-info)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-info)' }}>
                {editIng === 'new' ? 'Nuovo ingrediente' : `Modifica: ${editIng.name}`}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 160px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Nome ingrediente</label>
                  <input
                    autoFocus
                    value={ingForm.name}
                    onChange={e => setIngForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="es. Prosciutto cotto"
                    style={{ ...INP, width: '100%' }}
                  />
                </div>
                <div style={{ flex: '1 1 110px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Prezzo aggiunta (€)</label>
                  <input type="number" step="0.10" min="0" value={ingForm.price_add} onChange={e => setIngForm(p => ({ ...p, price_add: e.target.value }))} style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Prezzo rimozione (€)</label>
                  <input type="number" step="0.10" min="0" value={ingForm.price_remove} onChange={e => setIngForm(p => ({ ...p, price_remove: e.target.value }))} style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveIng} disabled={!ingForm.name.trim() || createIngMut.isPending || updateIngMut.isPending} style={{ padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
                    {editIng === 'new' ? 'Crea' : 'Salva'}
                  </button>
                  <button onClick={() => setEditIng(null)} style={BTN}>Annulla</button>
                </div>
              </div>
            </div>
          )}

          {/* Help text */}
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
            Il prezzo aggiunta si applica quando il cameriere aggiunge l'ingrediente a una pizza che non lo ha di default. Il prezzo rimozione è il credito per chi lo toglie.
          </p>

          {ingredients?.length === 0 && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun ingrediente ancora.</p>}
          {ingredients?.map(ing => (
            <div key={ing.id} style={{ ...ROW, opacity: ing.is_active ? 1 : 0.55 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{ing.name}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-success)', minWidth: 70 }}>+&euro; {Number(ing.price_add).toFixed(2)}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-danger)', minWidth: 70 }}>-&euro; {Number(ing.price_remove).toFixed(2)}</span>
              <button onClick={() => toggleIngMut.mutate(ing.id)} style={{ ...BTN, background: ing.is_active ? 'var(--color-background-success)' : undefined, color: ing.is_active ? 'var(--color-text-success)' : undefined }}>
                {ing.is_active ? '✓ Attivo' : '○ Inattivo'}
              </button>
              <button onClick={() => startEditIng(ing)} style={BTN}>Modifica</button>
              <button onClick={() => { if (confirm(`Eliminare ${ing.name}?`)) deleteIngMut.mutate(ing.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>Elimina</button>
            </div>
          ))}
        </>
      )}

      {/* ══════ VARIANTI IMPASTO ══════ */}
      {tab === 'variants' && (
        <>
          {/* Form nuova variante */}
          {showNewVar && (
            <div style={{ padding: 16, borderRadius: 10, marginBottom: 14, border: '2px solid var(--color-border-info)', background: 'var(--color-background-info)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-info)' }}>Nuova variante impasto</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 140px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Nome (es. Integrale)</label>
                  <input autoFocus value={varForm.name} onChange={e => setVarForm(p => ({ ...p, name: e.target.value }))} style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Codice stamp. (es. INT.)</label>
                  <input value={varForm.code} onChange={e => setVarForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="INT." style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Sovrapprezzo (€)</label>
                  <input type="number" step="0.10" min="0" value={varForm.price_add} onChange={e => setVarForm(p => ({ ...p, price_add: e.target.value }))} style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => createVarMut.mutate(varForm)} disabled={!varForm.name.trim() || !varForm.code.trim() || createVarMut.isPending} style={{ padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
                    Crea
                  </button>
                  <button onClick={() => setShowNewVar(false)} style={BTN}>Annulla</button>
                </div>
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
            Il codice comparirà sulla stampa pizzeria tra parentesi quadre (es. [CERE]). Il sovrapprezzo viene aggiunto al prezzo base della pizza.
          </p>

          {variants?.map(v => (
            <div key={v.id} style={{ ...ROW, opacity: v.is_active ? 1 : 0.55 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-tertiary)', minWidth: 60 }}>[{v.code}]</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{v.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-info)', minWidth: 60 }}>+&euro; {Number(v.price_add).toFixed(2)}</span>
              <button onClick={() => toggleVarMut.mutate(v.id)} style={{ ...BTN, background: v.is_active ? 'var(--color-background-success)' : undefined, color: v.is_active ? 'var(--color-text-success)' : undefined }}>
                {v.is_active ? '✓ Attiva' : '○ Inattiva'}
              </button>
              <button onClick={() => { if (confirm(`Eliminare la variante "${v.name}"?`)) deleteVarMut.mutate(v.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>
                Elimina
              </button>
            </div>
          ))}
        </>
      )}

      {/* Modal pizza */}
      {editPizza !== null && (
        <PizzaForm
          pizza={editPizza === 'new' ? null : editPizza}
          categories={categories ?? []}
          onClose={() => setEditPizza(null)}
          onSave={() => { setEditPizza(null); qc.invalidateQueries({ queryKey: ['pizzas-all'] }) }}
        />
      )}

      {/* Modal portata (categoria) */}
      {editCat !== null && (
        <CategoryForm
          category={editCat === 'new' ? null : editCat}
          department="pizzeria"
          onClose={() => setEditCat(null)}
          onSave={() => { setEditCat(null); qc.invalidateQueries({ queryKey: ['categories'] }) }}
        />
      )}
    </div>
  )
}
