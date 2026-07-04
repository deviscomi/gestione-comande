import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'
import { usePizzaPrice } from '../../hooks/usePizzaPrice'
import { UscitaSelector } from './DishConfigurator'

export default function PizzaConfigurator({ pizzaId, onAdd, onClose }) {
  const { data: pizza } = useQuery({
    queryKey: ['pizza', pizzaId],
    queryFn: () => menuApi.getPizza(pizzaId).then(r => r.data),
  })

  const { data: allVariants = [] } = useQuery({
    queryKey: ['pizza-variants-active'],
    queryFn: () => menuApi.getPizzaVariants({ is_active: 1 }).then(r => r.data.data),
  })

  const [base, setBase]               = useState('M')

  useEffect(() => {
    if (pizza) setBase(pizza.default_base || 'M')
  }, [pizza])

  const [quantity, setQuantity]       = useState(1)
  const [selectedVariants, setSelectedVariants] = useState([])
  const [ingredients, setIngredients] = useState({})
  const [additions, setAdditions]     = useState([])
  const [cut, setCut]                 = useState('intero')
  const [cooking, setCooking]         = useState('normale')
  const [notes, setNotes]             = useState('')
  const [uscita, setUscita]           = useState(1)


  const totalPrice = usePizzaPrice(pizza, { selectedVariants, ingredients, additions })

  function buildModifications() {
    const mods = []

    selectedVariants.forEach(code => {
      const v = allVariants.find(v => v.code === code)
      if (v) mods.push({ mod_type: 'variant', mod_value: code, price_change: parseFloat(v.price_add ?? 0) })
    })

    // Base salsa (pizza_base): solo se diversa dal default della pizza
    if (base !== (pizza?.default_base || 'M')) {
      mods.push({ mod_type: 'pizza_base', mod_value: base, price_change: 0 })
    }

    // Ingredienti default modificati
    pizza?.default_ingredients?.forEach(ing => {
      const st = ingredients[ing.id] ?? 'default'
      if (st === 'removed') {
        mods.push({ mod_type: 'ingredient_remove', mod_value: ing.name, price_change: -parseFloat(ing.price_remove ?? 0) })
      } else if (st === 'less') {
        mods.push({ mod_type: 'ingredient_portion', mod_value: `poco ${ing.name}`, price_change: 0 })
      } else if (st === 'more') {
        mods.push({ mod_type: 'ingredient_portion', mod_value: `abbondante ${ing.name}`, price_change: 0 })
      }
    })

    // Aggiunte
    additions.forEach(({ ingredient }) => {
      mods.push({ mod_type: 'ingredient_add', mod_value: ingredient.name, price_change: parseFloat(ingredient.price_add ?? 0) })
    })

    // Taglio: solo se non default (intero)
    if (cut !== 'intero') {
      mods.push({ mod_type: 'pizza_cut', mod_value: cut, price_change: 0 })
    }

    // Cottura: solo se non default (normale)
    if (cooking !== 'normale') {
      mods.push({ mod_type: 'cooking', mod_value: cooking, price_change: 0 })
    }

    return mods
  }

  if (!pizza) return null

  const bases = ['M', "Rose'", 'R', 'B', 'S']

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 0
    }}>
      <div style={{
        background: 'var(--color-background-primary)',
        borderRadius: '0 0 16px 16px',
        padding: 16, width: '100%', maxWidth: 520,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,.2)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{pizza.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>base € {pizza.base_price}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--color-text-secondary)', padding: 0 }}>×</button>
        </div>

        <Row label="Quantità">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={qtyBtnStyle}>−</button>
          <span style={{ fontSize: 16, fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{quantity}</span>
          <button onClick={() => setQuantity(q => Math.min(20, q + 1))} style={qtyBtnStyle}>+</button>
        </Row>

        <Row label="Base">
          {bases.map(b => <Chip key={b} active={base === b} onClick={() => setBase(b)}>{b}</Chip>)}
        </Row>

        {allVariants.length > 0 && (
          <Row label="Varianti">
            {allVariants.map(v => (
              <Chip
                key={v.code}
                active={selectedVariants.includes(v.code)}
                onClick={() =>
                  setSelectedVariants(prev =>
                    prev.includes(v.code)
                      ? prev.filter(c => c !== v.code)
                      : [...prev, v.code]
                  )
                }
              >
                {v.name}
                {parseFloat(v.price_add) > 0 && (
                  <span style={{ fontSize: 10 }}> +€{v.price_add}</span>
                )}
              </Chip>
            ))}
          </Row>
        )}

        {/* Ingredienti di default */}
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6, fontWeight: 600 }}>Ingredienti</div>
        {pizza.default_ingredients?.map(ing => {
          const st = ingredients[ing.id] ?? 'default'
          const removed = st === 'removed'
          return (
            <div key={ing.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 2px', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: 12
            }}>
              <span style={{ color: removed ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', flex: 1 }}>
                {removed ? <s>{ing.name}</s> : ing.name}
              </span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[['−', 'less'], ['●', 'default'], ['+', 'more']].map(([lbl, val]) => (
                  <button key={val} onClick={() => setIngredients(p => ({ ...p, [ing.id]: val }))} style={{
                    width: 24, height: 24, borderRadius: 4, fontSize: 13,
                    border: '1px solid var(--color-border-secondary)',
                    background: st === val ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                    color: st === val ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                  }}>{lbl}</button>
                ))}
                <button onClick={() => setIngredients(p => ({ ...p, [ing.id]: 'removed' }))} style={{
                  width: 24, height: 24, borderRadius: 4, fontSize: 14,
                  border: '1px solid var(--color-border-danger)',
                  color: 'var(--color-text-danger)',
                  background: st === 'removed' ? 'var(--color-background-danger)' : 'var(--color-background-secondary)',
                }}>×</button>
              </div>
            </div>
          )
        })}

        {/* Aggiunte disponibili */}
        {pizza.available_additions?.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 10, marginBottom: 6, fontWeight: 600 }}>Aggiunte</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pizza.available_additions.map(ing => {
                const added = additions.find(a => a.ingredient.id === ing.id)
                return (
                  <button key={ing.id} onClick={() => {
                    if (added) setAdditions(p => p.filter(a => a.ingredient.id !== ing.id))
                    else setAdditions(p => [...p, { ingredient: ing }])
                  }} style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11,
                    border: '1px solid var(--color-border-secondary)',
                    background: added ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                    color: added ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                  }}>
                    {ing.name} +€{ing.price_add}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <Row label="Taglio" style={{ marginTop: 12 }}>
          {['intero', 'spicchi', "meta'"].map(t => (
            <Chip key={t} active={cut === t} onClick={() => setCut(t)}>{t}</Chip>
          ))}
        </Row>

        <Row label="Cottura">
          {['poco cotta', 'normale', 'ben cotta'].map(c => (
            <Chip key={c} active={cooking === c} onClick={() => setCooking(c)}>{c}</Chip>
          ))}
        </Row>

        {/* Uscita */}
        <UscitaSelector value={uscita} onChange={setUscita} />

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Note</div>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note pizza..."
            style={{
              width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 8,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-info)' }}>€ {totalPrice}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
            }}>Annulla</button>
            <button onClick={() => onAdd({ quantity, modifications: buildModifications(), notes, uscita })} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none'
            }}>Aggiungi</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const qtyBtnStyle = {
  width: 30, height: 30, borderRadius: 6, fontSize: 18, lineHeight: 1,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)', cursor: 'pointer',
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 12, fontSize: 11,
      border: '1px solid var(--color-border-secondary)',
      background: active ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
      color: active ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
    }}>{children}</button>
  )
}

function Row({ label, children, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8, ...style }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 70 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}
