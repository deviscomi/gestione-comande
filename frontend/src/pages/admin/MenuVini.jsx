import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'
import { adminApi } from '../../api/endpoints/admin'
import DishForm from '../../components/admin/DishForm'
import WineForm from '../../components/admin/WineForm'
import DishVariantGroupForm from '../../components/admin/DishVariantGroupForm'

const ROW = { padding: '8px 14px', borderRadius: 8, marginBottom: 4, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', display: 'flex', alignItems: 'center', gap: 10 }
const BTN = { fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }
const INP = { padding: '6px 9px', borderRadius: 7, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }

const EMPTY_QTY = { name: '', price_add: '0.00', sort_order: 0, is_active: true }
const EMPTY_CAT = { name: '', sort_order: 0 }

const TABS = [
  { key: 'bottiglia', label: 'Carta dei Vini' },
  { key: 'casa',      label: 'Vini della casa' },
  { key: 'formats',   label: 'Formati vino della casa' },
  { key: 'variants',  label: 'Varianti' },
]

export default function MenuVini() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('casa')

  // Piatti vino (Vini della casa)
  const [editDish, setEditDish] = useState(null)

  // Carta dei Vini
  const [expandedCat, setExpandedCat] = useState(null)
  const [editWine, setEditWine] = useState(null) // null | {category_id} | {id,...}
  const [editCat, setEditCat] = useState(null)   // null | 'new' | {id,...}
  const [catForm, setCatForm] = useState(EMPTY_CAT)

  // Formati vino
  const [editQty, setEditQty] = useState(null) // null | 'new' | {id,...}
  const [qtyForm, setQtyForm] = useState(EMPTY_QTY)

  // Varianti
  const [editVariantGroup, setEditVariantGroup] = useState(null) // null | 'new' | group

  const { data: categories } = useQuery({
    queryKey: ['categories', 'vini'],
    queryFn: () => menuApi.getCategories({ department: ['vini_casa', 'carta_vini'] }).then(r => r.data.data),
  })

  const { data: dishes } = useQuery({
    queryKey: ['dishes', 'vini_casa'],
    queryFn: () => menuApi.getDishes({ department: 'vini_casa' }).then(r => r.data.data),
  })

  const { data: wines } = useQuery({
    queryKey: ['wines-all'],
    queryFn: () => menuApi.getWines().then(r => r.data.data),
  })

  const { data: wineQuantities } = useQuery({
    queryKey: ['wine-quantities'],
    queryFn: () => menuApi.getWineQuantities().then(r => r.data.data),
  })

  const { data: variantGroups } = useQuery({
    queryKey: ['dish-variant-groups', 'vini'],
    queryFn: () => menuApi.getDishVariantGroups({ department: 'vini' }).then(r => r.data.data),
  })

  const onErr = (e) => alert(e.response?.data?.message ?? e.message ?? 'Errore server')

  const catCasa        = categories?.find(c => c.department === 'vini_casa')
  const catsBottiglia  = categories?.filter(c => c.department === 'carta_vini') ?? []
  const activeCat      = tab === 'casa' ? catCasa : null
  const catDishes      = activeCat ? (dishes?.filter(d => d.category_id === activeCat.id) ?? []) : []

  // ── Piatti vino ─────────────────────────────────────────────────────────
  const toggleDishMut = useMutation({
    mutationFn: (id) => menuApi.toggleDish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dishes'] }),
    onError: onErr,
  })
  const deleteDishMut = useMutation({
    mutationFn: (id) => menuApi.deleteDish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dishes'] }),
    onError: onErr,
  })

  // ── Carta dei Vini — vini ──────────────────────────────────────────────
  const toggleWineMut = useMutation({
    mutationFn: (id) => menuApi.toggleWine(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wines-all'] }),
    onError: onErr,
  })
  const deleteWineMut = useMutation({
    mutationFn: (id) => menuApi.deleteWine(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wines-all'] }),
    onError: onErr,
  })

  // ── Carta dei Vini — categorie ──────────────────────────────────────────
  const createCatMut = useMutation({
    mutationFn: (d) => adminApi.createCategory({ ...d, department: 'carta_vini', is_active: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditCat(null) },
    onError: onErr,
  })
  const updateCatMut = useMutation({
    mutationFn: ({ id, d }) => adminApi.updateCategory(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditCat(null) },
    onError: onErr,
  })
  const toggleCatMut = useMutation({
    mutationFn: (id) => adminApi.toggleCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: onErr,
  })
  const deleteCatMut = useMutation({
    mutationFn: (id) => adminApi.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: onErr,
  })

  function startEditCat(cat) {
    setEditCat(cat)
    setCatForm({ name: cat.name, sort_order: cat.sort_order })
  }

  function saveCat() {
    if (!catForm.name.trim()) return
    if (editCat === 'new') createCatMut.mutate(catForm)
    else updateCatMut.mutate({ id: editCat.id, d: catForm })
  }

  // ── Formati vino ────────────────────────────────────────────────────────
  const inv = ['wine-quantities']

  const createQtyMut = useMutation({
    mutationFn: d => menuApi.createWineQuantity(d),
    onSuccess: () => { inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setEditQty(null) },
    onError: onErr,
  })
  const updateQtyMut = useMutation({
    mutationFn: ({ id, d }) => menuApi.updateWineQuantity(id, d),
    onSuccess: () => { inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setEditQty(null) },
    onError: onErr,
  })
  const toggleQtyMut = useMutation({
    mutationFn: id => menuApi.toggleWineQuantity(id),
    onSuccess: () => inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })),
    onError: onErr,
  })
  const deleteQtyMut = useMutation({
    mutationFn: id => menuApi.deleteWineQuantity(id),
    onSuccess: () => inv.forEach(k => qc.invalidateQueries({ queryKey: [k] })),
    onError: onErr,
  })

  function startEditQty(q) {
    setEditQty(q)
    setQtyForm({ name: q.name, price_add: q.price_add, sort_order: q.sort_order })
  }

  function saveQty() {
    if (!qtyForm.name.trim()) return
    if (editQty === 'new') createQtyMut.mutate(qtyForm)
    else updateQtyMut.mutate({ id: editQty.id, d: qtyForm })
  }

  // ── Varianti ────────────────────────────────────────────────────────────
  const toggleVariantGroupMut = useMutation({
    mutationFn: (id) => menuApi.toggleDishVariantGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dish-variant-groups', 'vini'] }),
    onError: onErr,
  })
  const deleteVariantGroupMut = useMutation({
    mutationFn: (id) => menuApi.deleteDishVariantGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dish-variant-groups', 'vini'] }),
    onError: (e) => alert(e.response?.data?.message ?? 'Impossibile eliminare il gruppo variante'),
  })

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Menu Vini</h1>
        {tab === 'casa' && activeCat && (
          <button onClick={() => setEditDish({ category_id: activeCat.id })} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            + Aggiungi vino
          </button>
        )}
        {tab === 'bottiglia' && (
          <button onClick={() => { setEditCat('new'); setCatForm(EMPTY_CAT) }} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            + Aggiungi altra categoria
          </button>
        )}
        {tab === 'formats' && (
          <button onClick={() => { setEditQty('new'); setQtyForm(EMPTY_QTY) }} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            + Aggiungi formato
          </button>
        )}
        {tab === 'variants' && (
          <button onClick={() => setEditVariantGroup('new')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            + Nuovo gruppo variante
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border-secondary)', background: tab === t.key ? 'var(--color-background-info)' : 'var(--color-background-secondary)', color: tab === t.key ? 'var(--color-text-info)' : 'var(--color-text-secondary)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ VINI DELLA CASA ══════ */}
      {tab === 'casa' && (
        <>
          {!activeCat && (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Categoria non trovata — esegui il seeder delle categorie.
            </p>
          )}
          {activeCat && catDishes.length === 0 && (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun vino ancora.</p>
          )}
          {catDishes.map(dish => (
            <div key={dish.id} style={{ ...ROW, opacity: dish.is_active ? 1 : 0.6 }}>
              <span style={{ flex: 1, fontSize: 13 }}>{dish.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-info)' }}>
                € {Number(dish.price).toFixed(2)}
              </span>
              <button onClick={() => toggleDishMut.mutate(dish.id)} style={{ ...BTN, background: dish.is_active ? 'var(--color-background-success)' : undefined, color: dish.is_active ? 'var(--color-text-success)' : undefined }}>
                {dish.is_active ? '✓ Attivo' : '○ Inattivo'}
              </button>
              <button onClick={() => setEditDish(dish)} style={BTN}>Modifica</button>
              <button onClick={() => { if (confirm(`Eliminare ${dish.name}?`)) deleteDishMut.mutate(dish.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>
                Elimina
              </button>
            </div>
          ))}
        </>
      )}

      {/* ══════ CARTA DEI VINI — categorie ══════ */}
      {tab === 'bottiglia' && (
        <>
          {editCat !== null && (
            <div style={{ padding: 16, borderRadius: 10, marginBottom: 14, border: '2px solid var(--color-border-info)', background: 'var(--color-background-info)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-info)' }}>
                {editCat === 'new' ? 'Nuova categoria vini' : `Modifica categoria: ${editCat.name}`}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 160px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Nome categoria</label>
                  <input
                    autoFocus
                    value={catForm.name}
                    onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveCat()}
                    placeholder="es. Spumante"
                    style={{ ...INP, width: '100%' }}
                  />
                </div>
                <div style={{ flex: '1 1 90px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Ordine</label>
                  <input type="number" min="0" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: e.target.value }))} style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveCat} disabled={!catForm.name.trim() || createCatMut.isPending || updateCatMut.isPending} style={{ padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
                    {editCat === 'new' ? 'Crea' : 'Salva'}
                  </button>
                  <button onClick={() => setEditCat(null)} style={BTN}>Annulla</button>
                </div>
              </div>
            </div>
          )}

          {catsBottiglia.length === 0 && (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessuna categoria ancora — aggiungine una.</p>
          )}

          {catsBottiglia.map(cat => {
            const catWines = wines?.filter(w => w.category_id === cat.id) ?? []
            const open = expandedCat === cat.id
            return (
              <div key={cat.id} style={{ marginBottom: 10, border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => setExpandedCat(open ? null : cat.id)}>
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {catWines.filter(w => w.is_active).length}/{catWines.length} attivi
                  </span>
                  <button onClick={e => { e.stopPropagation(); toggleCatMut.mutate(cat.id) }} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    border: '1px solid var(--color-border-secondary)',
                    background: cat.is_active ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
                    color: cat.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)'
                  }}>{cat.is_active ? '✓ Attiva' : '○ Inattiva'}</button>
                  <button onClick={e => { e.stopPropagation(); startEditCat(cat) }} style={BTN}>Modifica</button>
                  <button onClick={e => { e.stopPropagation(); if (confirm(`Eliminare la categoria "${cat.name}"?`)) deleteCatMut.mutate(cat.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>
                    Elimina
                  </button>
                  <span>{open ? '▼' : '▶'}</span>
                </div>

                {open && (
                  <div>
                    {catWines.map(wine => (
                      <div key={wine.id} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--color-border-tertiary)', background: wine.is_active ? 'var(--color-background-primary)' : 'var(--color-background-secondary)', opacity: wine.is_active ? 1 : 0.6 }}>
                        <span style={{ flex: 1, fontSize: 13 }}>
                          {wine.name}
                          {(wine.producer || wine.vintage_year) && (
                            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                              {' '}— {[wine.producer, wine.vintage_year].filter(Boolean).join(' ')}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-info)' }}>
                          € {Number(wine.price).toFixed(2)}
                        </span>
                        <button onClick={() => toggleWineMut.mutate(wine.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: wine.is_active ? 'var(--color-background-success)' : 'var(--color-background-secondary)', color: wine.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)' }}>
                          {wine.is_active ? '✓' : '○'}
                        </button>
                        <button onClick={() => setEditWine(wine)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>
                          Modifica
                        </button>
                        <button onClick={() => { if (confirm(`Eliminare ${wine.name}?`)) deleteWineMut.mutate(wine.id) }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-danger)', background: 'transparent', color: 'var(--color-text-danger)' }}>
                          Elimina
                        </button>
                      </div>
                    ))}
                    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border-tertiary)' }}>
                      <button onClick={() => setEditWine({ category_id: cat.id })} style={{ fontSize: 12, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        + Aggiungi vino a {cat.name}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ══════ FORMATI VINO ══════ */}
      {tab === 'formats' && (
        <>
          {editQty !== null && (
            <div style={{ padding: 16, borderRadius: 10, marginBottom: 14, border: '2px solid var(--color-border-info)', background: 'var(--color-background-info)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-info)' }}>
                {editQty === 'new' ? 'Nuovo formato' : `Modifica: ${editQty.name}`}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 160px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Nome formato</label>
                  <input
                    autoFocus
                    value={qtyForm.name}
                    onChange={e => setQtyForm(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveQty()}
                    placeholder="es. Quartino"
                    style={{ ...INP, width: '100%' }}
                  />
                </div>
                <div style={{ flex: '1 1 110px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Sovrapprezzo (€)</label>
                  <input type="number" step="0.10" min="0" value={qtyForm.price_add} onChange={e => setQtyForm(p => ({ ...p, price_add: e.target.value }))} style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ flex: '1 1 90px' }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>Ordine</label>
                  <input type="number" min="0" value={qtyForm.sort_order} onChange={e => setQtyForm(p => ({ ...p, sort_order: e.target.value }))} style={{ ...INP, width: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveQty} disabled={!qtyForm.name.trim() || createQtyMut.isPending || updateQtyMut.isPending} style={{ padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
                    {editQty === 'new' ? 'Crea' : 'Salva'}
                  </button>
                  <button onClick={() => setEditQty(null)} style={BTN}>Annulla</button>
                </div>
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
            Il prezzo base del vino (calice) si imposta sul piatto. Il sovrapprezzo si somma per gli altri formati.
          </p>

          {wineQuantities?.length === 0 && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun formato ancora.</p>}

          {wineQuantities?.map(q => (
            <div key={q.id} style={{ ...ROW, opacity: q.is_active ? 1 : 0.55 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{q.name}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-success)', minWidth: 70 }}>+€ {Number(q.price_add).toFixed(2)}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', minWidth: 50 }}>#{q.sort_order}</span>
              <button onClick={() => toggleQtyMut.mutate(q.id)} style={{ ...BTN, background: q.is_active ? 'var(--color-background-success)' : undefined, color: q.is_active ? 'var(--color-text-success)' : undefined }}>
                {q.is_active ? '✓ Attivo' : '○ Inattivo'}
              </button>
              <button onClick={() => startEditQty(q)} style={BTN}>Modifica</button>
              <button onClick={() => { if (confirm(`Eliminare "${q.name}"?`)) deleteQtyMut.mutate(q.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>
                Elimina
              </button>
            </div>
          ))}
        </>
      )}

      {/* ══════ VARIANTI ══════ */}
      {tab === 'variants' && (
        <>
          {variantGroups?.length === 0 && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun gruppo variante ancora.</p>}
          {variantGroups?.map(group => (
            <div key={group.id} style={{ marginBottom: 10, padding: '10px 14px', border: '1px solid var(--color-border-tertiary)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, background: group.is_active ? 'var(--color-background-primary)' : 'var(--color-background-secondary)', opacity: group.is_active ? 1 : 0.6 }}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{group.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: group.is_required ? 'var(--color-background-danger)' : 'var(--color-background-secondary)',
                color: group.is_required ? 'var(--color-text-danger)' : 'var(--color-text-tertiary)'
              }}>{group.is_required ? 'Obbligatorio' : 'Opzionale'}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {group.options?.length ?? 0} opzioni
              </span>
              <button onClick={() => toggleVariantGroupMut.mutate(group.id)} style={{ ...BTN, background: group.is_active ? 'var(--color-background-success)' : undefined, color: group.is_active ? 'var(--color-text-success)' : undefined }}>
                {group.is_active ? '✓ Attivo' : '○ Inattivo'}
              </button>
              <button onClick={() => setEditVariantGroup(group)} style={BTN}>Modifica</button>
              <button onClick={() => { if (confirm(`Eliminare il gruppo "${group.name}"?`)) deleteVariantGroupMut.mutate(group.id) }} style={{ ...BTN, border: '1px solid var(--color-border-danger)', color: 'var(--color-text-danger)', background: 'transparent' }}>
                Elimina
              </button>
            </div>
          ))}
        </>
      )}

      {/* Modal vino della casa */}
      {editDish !== null && (
        <DishForm
          dish={editDish}
          categories={[catCasa].filter(Boolean)}
          department="vini"
          onClose={() => setEditDish(null)}
          onSave={() => { setEditDish(null); qc.invalidateQueries({ queryKey: ['dishes'] }) }}
        />
      )}

      {/* Modal vino carta dei vini */}
      {editWine !== null && (
        <WineForm
          wine={editWine}
          categoryId={editWine.category_id}
          onClose={() => setEditWine(null)}
          onSave={() => { setEditWine(null); qc.invalidateQueries({ queryKey: ['wines-all'] }) }}
        />
      )}

      {/* Modal gruppo variante */}
      {editVariantGroup !== null && (
        <DishVariantGroupForm
          group={editVariantGroup === 'new' ? null : editVariantGroup}
          department="vini"
          onClose={() => setEditVariantGroup(null)}
          onSave={() => { setEditVariantGroup(null); qc.invalidateQueries({ queryKey: ['dish-variant-groups', 'vini'] }) }}
        />
      )}
    </div>
  )
}
