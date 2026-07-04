import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'

const WINE_QUANTITY_DEPARTMENTS = ['vini_casa']

export default function DishConfigurator({ dish, category, onAdd, onClose }) {
  const [quantity,     setQuantity]     = useState(1)
  const [variantSelections, setVariantSelections] = useState({}) // { [groupId]: optionId }
  const [selectedQuantity, setSelectedQuantity] = useState(null) // { id, name, price_add }
  const [notes,        setNotes]        = useState('')
  const [uscita,       setUscita]       = useState(1)
  // { [ingredientId]: 'poco' | null | 'abbondante' | 'removed' }  null = normale
  const [ingState, setIngState] = useState({})
  // { [ingredientId]: 'poco' | null | 'abbondante' }  null = porzione normale
  const [addState, setAddState] = useState({})


  // Fetch dettaglio piatto per avere default_ingredients
  const { data: fullDish } = useQuery({
    queryKey: ['dish-detail', dish?.id],
    queryFn: () => menuApi.getDish(dish.id).then(r => r.data?.data ?? r.data),
    enabled: !!dish?.id,
    staleTime: 5 * 60 * 1000,
  })

  const defaultIngredients = fullDish?.default_ingredients ?? []
  const availableAdditions = fullDish?.available_additions ?? []
  const variantGroups = (fullDish?.variant_groups ?? []).filter(g => g.is_active)

  const catName    = category?.name ?? ''
  const isWineQuantityCategory = WINE_QUANTITY_DEPARTMENTS.includes(category?.department)

  function selectVariant(group, option) {
    setVariantSelections(p => {
      const next = { ...p }
      if (!group.is_required && next[group.id] === option.id) {
        delete next[group.id]
      } else {
        next[group.id] = option.id
      }
      return next
    })
  }

  const { data: wineQuantities } = useQuery({
    queryKey: ['wine-quantities'],
    queryFn: () => menuApi.getWineQuantities().then(r => r.data?.data ?? []),
    enabled: isWineQuantityCategory,
    staleTime: 5 * 60 * 1000,
  })

  function setIng(id, state) {
    setIngState(p => ({ ...p, [id]: state }))
  }

  function toggleAdd(id, portion) {
    setAddState(p => {
      const isActive = p[id] === portion
      const next = { ...p }
      if (isActive) delete next[id]
      else next[id] = portion
      return next
    })
  }

  function buildModifications() {
    const mods = []
    variantGroups.forEach(group => {
      const optionId = variantSelections[group.id]
      if (!optionId) return
      const option = group.options?.find(o => o.id === optionId)
      if (!option) return
      mods.push({
        mod_type: 'variant_group',
        mod_value: `${group.name}: ${option.name}`,
        price_change: parseFloat(option.price_add ?? 0),
      })
    })
    if (selectedQuantity) mods.push({
      mod_type: 'wine_quantity',
      mod_value: selectedQuantity.name,
      price_change: parseFloat(selectedQuantity.price_add ?? 0),
    })

    defaultIngredients.forEach(ing => {
      const state = ingState[ing.id] ?? null
      if (state === 'poco') {
        mods.push({ mod_type: 'ingredient_portion', mod_value: `poco ${ing.name}`, price_change: 0 })
      } else if (state === 'abbondante') {
        mods.push({ mod_type: 'ingredient_portion', mod_value: `abbondante ${ing.name}`, price_change: 0 })
      } else if (state === 'removed') {
        mods.push({ mod_type: 'ingredient_remove', mod_value: ing.name, price_change: -parseFloat(ing.price_remove ?? 0) })
      }
    })

    Object.entries(addState).forEach(([idStr, portion]) => {
      const ing = availableAdditions.find(i => String(i.id) === idStr)
      if (!ing) return
      const label = portion === null ? ing.name : `${portion} ${ing.name}`
      mods.push({
        mod_type: 'ingredient_add',
        mod_value: label,
        price_change: parseFloat(ing.price_add ?? 0),
      })
    })

    return mods
  }

  // Sconto per ingredienti rimossi (price_remove sottratto)
  const removedDiscount = defaultIngredients
    .filter(ing => ingState[ing.id] === 'removed')
    .reduce((sum, ing) => sum - parseFloat(ing.price_remove ?? 0), 0)

  const additionsTotal = Object.entries(addState).reduce((sum, [idStr]) => {
    const ing = availableAdditions.find(i => String(i.id) === idStr)
    return sum + parseFloat(ing?.price_add ?? 0)
  }, 0)

  const wineQuantityAdd = parseFloat(selectedQuantity?.price_add ?? 0)

  const variantsTotal = variantGroups.reduce((sum, group) => {
    const optionId = variantSelections[group.id]
    const option = group.options?.find(o => o.id === optionId)
    return sum + parseFloat(option?.price_add ?? 0)
  }, 0)

  const totalPrice = ((parseFloat(dish?.price ?? 0) + removedDiscount + additionsTotal + wineQuantityAdd + variantsTotal) * quantity).toFixed(2)

  const missingRequiredVariant = variantGroups.some(g => g.is_required && !variantSelections[g.id])
  const addDisabled = (isWineQuantityCategory && !selectedQuantity) || missingRequiredVariant

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-background-primary)',
        borderRadius: '0 0 16px 16px',
        padding: 16, width: '100%', maxWidth: 520,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,.2)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{dish?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {catName}{catName ? ' · ' : ''}€ {Number(dish?.price ?? 0).toFixed(2)} cad.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22,
            color: 'var(--color-text-secondary)', padding: 0, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Quantità */}
        <Row label="Quantità">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={btnStyle}>−</button>
          <span style={{ fontSize: 16, fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{quantity}</span>
          <button onClick={() => setQuantity(q => Math.min(20, q + 1))} style={btnStyle}>+</button>
        </Row>

        {/* Gruppi di varianti dinamici (DishVariantGroup/DishVariantOption) */}
        {variantGroups.map(group => (
          <Row key={group.id} label={`${group.name}${group.is_required ? ' *' : ''}`}>
            {(group.options ?? []).filter(o => o.is_active).map(option => (
              <Chip
                key={option.id}
                active={variantSelections[group.id] === option.id}
                onClick={() => selectVariant(group, option)}
              >{option.name}{parseFloat(option.price_add ?? 0) > 0 ? ` +€${Number(option.price_add).toFixed(2)}` : ''}</Chip>
            ))}
          </Row>
        ))}

        {/* Formato — solo Vini della casa */}
        {isWineQuantityCategory && (
          <Row label="Formato">
            {(wineQuantities ?? []).filter(q => q.is_active).map(q => (
              <Chip
                key={q.id}
                active={selectedQuantity?.id === q.id}
                onClick={() => setSelectedQuantity(q)}
              >{q.name}{parseFloat(q.price_add) > 0 ? ` +€${Number(q.price_add).toFixed(2)}` : ''}</Chip>
            ))}
          </Row>
        )}

        {/* Ingredienti di default */}
        {defaultIngredients.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500,
              marginBottom: 6, marginTop: 4,
            }}>Ingredienti</div>

            {defaultIngredients.map(ing => {
              const state   = ingState[ing.id] ?? null
              const removed = state === 'removed'
              return (
                <div key={ing.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--color-border-tertiary)',
                }}>
                  <span style={{
                    fontSize: 12, flex: 1,
                    color: removed ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                    textDecoration: removed ? 'line-through' : 'none',
                  }}>{ing.name}</span>

                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {/* poco · ● · molto */}
                    {[['poco', 'poco'], ['●', null], ['molto', 'abbondante']].map(([label, val]) => (
                      <button
                        key={label}
                        disabled={removed}
                        onClick={() => setIng(ing.id, val)}
                        style={{
                          width: 36, height: 26, borderRadius: 5, fontSize: 10, fontWeight: 500,
                          border: '1px solid var(--color-border-secondary)',
                          background: !removed && state === val
                            ? 'var(--color-background-info)'
                            : 'var(--color-background-secondary)',
                          color: !removed && state === val
                            ? 'var(--color-text-info)'
                            : 'var(--color-text-secondary)',
                          cursor: removed ? 'default' : 'pointer',
                          opacity: removed ? 0.35 : 1,
                        }}
                      >{label}</button>
                    ))}

                    {/* × / ↩ — rimuovi/ripristina */}
                    <button
                      onClick={() => setIng(ing.id, removed ? null : 'removed')}
                      style={{
                        width: 26, height: 26, borderRadius: 5, fontSize: removed ? 13 : 14,
                        border: '1px solid var(--color-border-danger)',
                        background: removed
                          ? 'var(--color-background-danger)'
                          : 'var(--color-background-secondary)',
                        color: 'var(--color-text-danger)',
                        cursor: 'pointer',
                      }}
                    >{removed ? '↩' : '×'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Aggiunte disponibili */}
        {availableAdditions.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500,
              marginBottom: 6, marginTop: 4,
            }}>Aggiunte disponibili</div>

            {availableAdditions.map(ing => {
              const isSelected = ing.id in addState
              return (
                <div key={ing.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--color-border-tertiary)',
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                      {ing.name}
                    </span>
                    {parseFloat(ing.price_add ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
                        +€ {Number(ing.price_add).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[['poco', 'poco'], ['norm.', null], ['molto', 'abbondante']].map(([label, val]) => (
                      <button
                        key={label}
                        onClick={() => toggleAdd(String(ing.id), val)}
                        style={{
                          width: 36, height: 26, borderRadius: 5, fontSize: 10, fontWeight: 500,
                          border: '1px solid var(--color-border-secondary)',
                          background: isSelected && addState[ing.id] === val
                            ? 'var(--color-background-success)'
                            : 'var(--color-background-secondary)',
                          color: isSelected && addState[ing.id] === val
                            ? 'var(--color-text-success)'
                            : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Uscita */}
        <UscitaSelector value={uscita} onChange={setUscita} />

        {/* Note libere */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Note</div>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Note cucina…"
            style={{
              width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 8,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-info)' }}>
            € {totalPrice}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)', cursor: 'pointer',
            }}>Annulla</button>
            <button
              disabled={addDisabled}
              onClick={() => onAdd({ quantity, modifications: buildModifications(), notes: notes.trim() || null, uscita })}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', cursor: addDisabled ? 'default' : 'pointer',
                opacity: addDisabled ? 0.5 : 1,
              }}
            >Aggiungi</button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── UscitaSelector ─────────────────────────────────────────────────────────────

export function UscitaSelector({ value, onChange }) {
  const options = [1, 2, 3, 4, 5]

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 12,
    }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 70 }}>
        Uscita
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              width: 30, height: 30,
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              fontWeight: value === n ? 600 : 400,
              fontSize: 13,
              background: value === n
                ? 'var(--color-background-info)'
                : 'var(--color-background-secondary)',
              color: value === n
                ? 'var(--color-text-info)'
                : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >{n}</button>
        ))}
      </div>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

const btnStyle = {
  width: 30, height: 30, borderRadius: 6, fontSize: 18, lineHeight: 1,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)', cursor: 'pointer',
}

function Chip({ active, onClick, children, danger = false }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 12, fontSize: 11,
      border: '1px solid var(--color-border-secondary)',
      background: active
        ? (danger ? 'var(--color-background-danger)' : 'var(--color-background-info)')
        : 'var(--color-background-secondary)',
      color: active
        ? (danger ? 'var(--color-text-danger)' : 'var(--color-text-info)')
        : 'var(--color-text-secondary)',
      cursor: 'pointer',
    }}>{children}</button>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 70 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
    </div>
  )
}
