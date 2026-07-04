import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'
import { adminApi } from '../../api/endpoints/admin'
import { useAuthStore } from '../../store/useAuthStore'
import DishForm from '../../components/admin/DishForm'
import CategoryForm from '../../components/admin/CategoryForm'
import IngredientManager from '../../components/admin/IngredientManager'
import DishVariantGroupForm from '../../components/admin/DishVariantGroupForm'

const TABS = [
  { key: 'dishes',      label: 'Articoli Bar' },
  { key: 'ingredients', label: 'Ingredienti' },
  { key: 'variants',    label: 'Varianti' },
]

const BTN = { fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }

export default function MenuBar() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [tab, setTab] = useState('dishes')

  // Piatti
  const [editDish, setEditDish] = useState(null)
  const [expandedCat, setExpandedCat] = useState(null)

  // Portate (categorie)
  const [editCat, setEditCat] = useState(null) // null | 'new' | category

  // Varianti
  const [editVariantGroup, setEditVariantGroup] = useState(null) // null | 'new' | group

  const BAR_DEPARTMENTS = ['bar', 'bevande', 'dessert', 'amari']

  const { data: categories } = useQuery({
    queryKey: ['categories', 'bar'],
    queryFn: () => menuApi.getCategories({ department: BAR_DEPARTMENTS }).then(r => r.data.data),
  })

  const { data: dishes } = useQuery({
    queryKey: ['dishes', 'bar'],
    queryFn: () => menuApi.getDishes({ department: BAR_DEPARTMENTS }).then(r => r.data.data),
  })

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients', 'bar'],
    queryFn: () => menuApi.getIngredients({ department: 'bar' }).then(r => r.data.data),
  })

  const { data: variantGroups } = useQuery({
    queryKey: ['dish-variant-groups', 'bar'],
    queryFn: () => menuApi.getDishVariantGroups({ department: 'bar' }).then(r => r.data.data),
  })

  // ── Piatti ──────────────────────────────────────────────────────────────
  const toggleDishMut = useMutation({
    mutationFn: (id) => menuApi.toggleDish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dishes'] }),
  })
  const deleteDishMut = useMutation({
    mutationFn: (id) => menuApi.deleteDish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dishes'] }),
  })
  const toggleCatMut = useMutation({
    mutationFn: (id) => adminApi.toggleCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
  const deleteCatMut = useMutation({
    mutationFn: (id) => adminApi.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e) => alert(e.response?.data?.message ?? 'Impossibile eliminare la portata'),
  })

  // ── Varianti ────────────────────────────────────────────────────────────
  const toggleVariantGroupMut = useMutation({
    mutationFn: (id) => menuApi.toggleDishVariantGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dish-variant-groups', 'bar'] }),
  })
  const deleteVariantGroupMut = useMutation({
    mutationFn: (id) => menuApi.deleteDishVariantGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dish-variant-groups', 'bar'] }),
    onError: (e) => alert(e.response?.data?.message ?? 'Impossibile eliminare il gruppo variante'),
  })

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Menu Bar</h1>
        {tab === 'dishes' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && (
              <button onClick={() => setEditCat('new')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-secondary)' }}>
                + Nuova portata
              </button>
            )}
            <button onClick={() => setEditDish('new')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
              + Aggiungi articolo
            </button>
          </div>
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
            {t.key === 'ingredients' && ingredients && (
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>({ingredients.length})</span>
            )}
            {t.key === 'variants' && variantGroups && (
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>({variantGroups.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════ PIATTI ══════ */}
      {tab === 'dishes' && (
        <>
          {categories?.map(cat => {
            const catDishes = dishes?.filter(d => d.category_id === cat.id) ?? []
            const open = expandedCat === cat.id
            return (
              <div key={cat.id} style={{ marginBottom: 10, border: '1px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => setExpandedCat(open ? null : cat.id)}>
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {catDishes.filter(d => d.is_active).length}/{catDishes.length} attivi
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
                  <div>
                    {catDishes.map(dish => (
                      <div key={dish.id} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--color-border-tertiary)', background: dish.is_active ? 'var(--color-background-primary)' : 'var(--color-background-secondary)', opacity: dish.is_active ? 1 : 0.6 }}>
                        <span style={{ flex: 1, fontSize: 13 }}>{dish.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-info)' }}>
                          € {Number(dish.price).toFixed(2)}
                        </span>
                        <button onClick={() => toggleDishMut.mutate(dish.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: dish.is_active ? 'var(--color-background-success)' : 'var(--color-background-secondary)', color: dish.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)' }}>
                          {dish.is_active ? '✓' : '○'}
                        </button>
                        <button onClick={() => setEditDish(dish)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>
                          Modifica
                        </button>
                        <button onClick={() => { if (confirm(`Eliminare ${dish.name}?`)) deleteDishMut.mutate(dish.id) }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border-danger)', background: 'transparent', color: 'var(--color-text-danger)' }}>
                          Elimina
                        </button>
                      </div>
                    ))}
                    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border-tertiary)' }}>
                      <button onClick={() => setEditDish({ category_id: cat.id })} style={{ fontSize: 12, color: 'var(--color-text-info)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        + Aggiungi articolo a {cat.name}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ══════ INGREDIENTI ══════ */}
      {tab === 'ingredients' && <IngredientManager department="bar" />}

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

      {/* Modal articolo bar */}
      {editDish !== null && (
        <DishForm
          dish={editDish === 'new' ? null : editDish}
          categories={categories ?? []}
          department="bar"
          onClose={() => setEditDish(null)}
          onSave={() => { setEditDish(null); qc.invalidateQueries({ queryKey: ['dishes'] }) }}
        />
      )}

      {/* Modal portata (categoria) */}
      {editCat !== null && (
        <CategoryForm
          category={editCat === 'new' ? null : editCat}
          department="bar"
          onClose={() => setEditCat(null)}
          onSave={() => { setEditCat(null); qc.invalidateQueries({ queryKey: ['categories'] }) }}
        />
      )}

      {/* Modal gruppo variante */}
      {editVariantGroup !== null && (
        <DishVariantGroupForm
          group={editVariantGroup === 'new' ? null : editVariantGroup}
          department="bar"
          onClose={() => setEditVariantGroup(null)}
          onSave={() => { setEditVariantGroup(null); qc.invalidateQueries({ queryKey: ['dish-variant-groups', 'bar'] }) }}
        />
      )}
    </div>
  )
}
