import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { menuApi } from '../../api/endpoints/menu'
import { ordersApi } from '../../api/endpoints/orders'
import { useModuleStore } from '../../store/useModuleStore'
import PizzaConfigurator from './PizzaConfigurator'
import DishConfigurator from './DishConfigurator'
import WineConfigurator from './WineConfigurator'

const WINE_TAB = '__carta_vini__'

export default function MenuPanel({ orderId, onItemAdded }) {
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedWineCat, setSelectedWineCat] = useState(null)
  const [pizzaConfig, setPizzaConfig] = useState(null)
  const [dishConfig,  setDishConfig]  = useState(null)   // dish aperto nel configuratore
  const [wineConfig,  setWineConfig]  = useState(null)   // vino aperto nel configuratore

  const pizzeriaEnabled = useModuleStore(s => s.modules['pizzeria'] === true)

  // Calendario servizio oggi — filtra i reparti attivi
  const { data: schedule } = useQuery({
    queryKey: ['schedule-today'],
    queryFn: () => ordersApi.getScheduleToday().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: allCategories } = useQuery({
    queryKey: ['categories', { is_active: true }],
    queryFn: () => menuApi.getCategories({ is_active: true }).then(r => r.data.data),
  })

  // Filtra le categorie in base ai reparti attivi oggi e ai moduli licenza
  // Le categorie "carta_vini" non compaiono qui: hanno un tab fisso dedicato
  const BAR_DEPARTMENTS = ['bar', 'bevande', 'dessert', 'amari', 'vini_casa', 'carta_vini']

  const categories = allCategories?.filter(cat => {
    if (cat.department === 'carta_vini') return false
    if (cat.department === 'pizzeria' && !pizzeriaEnabled) return false
    if (!schedule) return true
    const depts = schedule.departments ?? {}
    if (cat.department === 'pizzeria') return depts.pizzeria !== false
    if (BAR_DEPARTMENTS.includes(cat.department)) return depts.bar !== false
    // cucina → reparto cucina
    return depts.cucina !== false
  })

  const { data: dishes } = useQuery({
    queryKey: ['dishes', selectedCat],
    queryFn: () => menuApi.getDishes({ category_id: selectedCat, is_active: true }).then(r => r.data.data),
    enabled: !!selectedCat && selectedCat !== WINE_TAB,
  })

  // isPizzaCategory calcolato prima della query per usarlo come `enabled` (unica sorgente di verità)
  const isPizzaCategory = allCategories?.find(c => c.id === selectedCat)?.department === 'pizzeria' ?? false

  const { data: pizzas, isPending: pizzasPending, isError: pizzasError } = useQuery({
    queryKey: ['pizzas', { is_active: true }],
    queryFn: () => menuApi.getPizzas({ is_active: true }).then(r => r.data?.data ?? []),
    enabled: isPizzaCategory,
  })

  // Carta dei Vini — sotto-categorie (Rosso/Rosato/Bianco/custom) e vini della sotto-categoria scelta
  const { data: wineCategories } = useQuery({
    queryKey: ['categories-wine', { is_active: true }],
    queryFn: () => menuApi.getCategories({ department: 'carta_vini', is_active: true }).then(r => r.data.data),
    enabled: selectedCat === WINE_TAB,
  })

  const { data: wines } = useQuery({
    queryKey: ['wines', selectedWineCat],
    queryFn: () => menuApi.getWines({ category_id: selectedWineCat, is_active: true }).then(r => r.data.data),
    enabled: !!selectedWineCat,
  })

  const addItemMut = useMutation({
    mutationFn: (data) => ordersApi.addOrderItem(orderId, data),
    onSuccess: onItemAdded,
    onError: (err) => alert(err.response?.data?.message ?? 'Errore aggiunta articolo'),
  })

  function handleDishAdd({ quantity, modifications, notes, uscita }) {
    addItemMut.mutate({
      item_type: 'dish',
      dish_id: dishConfig.id,
      quantity,
      notes,
      modifications,
      uscita: uscita ?? 1,
    })
    setDishConfig(null)
  }

  function handlePizzaAdd({ pizzaId, quantity, modifications, notes, uscita }) {
    addItemMut.mutate({ item_type: 'pizza', pizza_id: pizzaId, quantity: quantity ?? 1, modifications, notes, uscita: uscita ?? 1 })
    setPizzaConfig(null)
  }

  function handleWineAdd({ quantity, notes, uscita }) {
    addItemMut.mutate({
      item_type: 'wine',
      wine_id: wineConfig.id,
      quantity,
      notes,
      uscita: uscita ?? 1,
    })
    setWineConfig(null)
  }

  const barClosed = schedule?.departments?.bar === false

  // Se la categoria selezionata non è più visibile (reparto chiuso), deseleziona
  // Il tab "Carta dei Vini" segue la chiusura del reparto Bar
  const catVisible = (selectedCat === WINE_TAB && !barClosed) || !selectedCat || categories?.some(c => c.id === selectedCat)
  const activeCat = catVisible ? selectedCat : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Avviso reparti chiusi */}
      {schedule && (() => {
        const closed = []
        if (schedule.departments?.cucina === false) closed.push('Cucina')
        if (pizzeriaEnabled && schedule.departments?.pizzeria === false) closed.push('Pizzeria')
        if (schedule.departments?.bar === false) closed.push('Bar')
        if (closed.length === 0) return null
        return (
          <div style={{
            padding: '4px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--color-background-warning)',
            color: 'var(--color-text-warning)',
            borderBottom: '1px solid var(--color-border-warning)',
            flexShrink: 0
          }}>
            ⚠ Reparto chiuso oggi: {closed.join(', ')}
          </div>
        )
      })()}

      {/* Categorie */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 10px', overflowX: 'auto',
        borderBottom: '1px solid var(--color-border-tertiary)',
        background: 'var(--color-background-secondary)', flexShrink: 0
      }}>
        {categories?.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{
            padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 500,
            whiteSpace: 'nowrap', border: '1px solid var(--color-border-secondary)',
            background: activeCat === cat.id ? 'var(--color-background-info)' : 'var(--color-background-primary)',
            color: activeCat === cat.id ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
          }}>{cat.name}</button>
        ))}
        {categories?.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', padding: '4px 0' }}>
            Nessuna categoria disponibile oggi
          </span>
        )}
        {/* Tab fisso, separato dalle categorie normali — segue la chiusura del reparto Bar */}
        {!barClosed && (
          <button onClick={() => { setSelectedCat(WINE_TAB); setSelectedWineCat(null) }} style={{
            padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 500,
            whiteSpace: 'nowrap', border: '1px solid var(--color-border-secondary)',
            background: activeCat === WINE_TAB ? 'var(--color-background-info)' : 'var(--color-background-primary)',
            color: activeCat === WINE_TAB ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
          }}>🍷 Carta dei Vini</button>
        )}
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {!activeCat && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            Seleziona una categoria
          </div>
        )}

        {/* Pizze */}
        {isPizzaCategory && (
          pizzasPending
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Caricamento...</div>
            : pizzasError
              ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-danger)', fontSize: 13 }}>Errore caricamento pizze — riprova</div>
              : pizzas?.length === 0
                ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessuna pizza disponibile — aggiungile dal backoffice</div>
                : pizzas?.map(pizza => (
                    <button key={pizza.id} onClick={() => setPizzaConfig(pizza.id)} style={{
                      width: '100%', padding: '9px 12px', marginBottom: 6, borderRadius: 8, textAlign: 'left',
                      border: '1px solid var(--color-border-tertiary)',
                      background: 'var(--color-background-primary)', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span style={{ fontSize: 13 }}>{pizza.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-info)', fontWeight: 600 }}>
                        &euro; {Number(pizza.base_price).toFixed(2)}
                      </span>
                    </button>
                  ))
        )}

        {/* Carta dei Vini — sotto-categorie + vini */}
        {activeCat === WINE_TAB && (
          <>
            <div style={{
              display: 'flex', gap: 6, padding: '0 0 8px', overflowX: 'auto',
            }}>
              {wineCategories?.map(wc => (
                <button key={wc.id} onClick={() => setSelectedWineCat(wc.id)} style={{
                  padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 500,
                  whiteSpace: 'nowrap', border: '1px solid var(--color-border-secondary)',
                  background: selectedWineCat === wc.id ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                  color: selectedWineCat === wc.id ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                }}>{wc.name}</button>
              ))}
              {wineCategories?.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', padding: '4px 0' }}>
                  Nessuna categoria vino disponibile
                </span>
              )}
            </div>

            {!selectedWineCat && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                Seleziona una categoria di vino
              </div>
            )}

            {selectedWineCat && (
              wines?.length === 0
                ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun vino disponibile</div>
                : wines?.map(wine => (
                    <button key={wine.id} onClick={() => setWineConfig(wine)} style={{
                      width: '100%', padding: '9px 12px', marginBottom: 6, borderRadius: 8, textAlign: 'left',
                      border: '1px solid var(--color-border-tertiary)',
                      background: 'var(--color-background-primary)', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      opacity: addItemMut.isPending ? 0.7 : 1
                    }}>
                      <span style={{ fontSize: 13 }}>
                        {wine.name}
                        {(wine.producer || wine.vintage_year) && (
                          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                            {' '}— {[wine.producer, wine.vintage_year].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-info)', fontWeight: 600 }}>
                        &euro; {Number(wine.price).toFixed(2)}
                      </span>
                    </button>
                  ))
            )}
          </>
        )}

        {/* Piatti */}
        {!isPizzaCategory && activeCat && activeCat !== WINE_TAB && (
          dishes?.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun piatto disponibile</div>
            : dishes?.map(dish => (
                <button key={dish.id} onClick={() => setDishConfig(dish)} style={{
                  width: '100%', padding: '9px 12px', marginBottom: 6, borderRadius: 8, textAlign: 'left',
                  border: '1px solid var(--color-border-tertiary)',
                  background: 'var(--color-background-primary)', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  opacity: addItemMut.isPending ? 0.7 : 1
                }}>
                  <span style={{ fontSize: 13 }}>{dish.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-info)', fontWeight: 600 }}>
                    &euro; {Number(dish.price).toFixed(2)}
                  </span>
                </button>
              ))
        )}
      </div>

      {pizzaConfig && (
        <PizzaConfigurator
          pizzaId={pizzaConfig}
          onAdd={(cfg) => handlePizzaAdd({ pizzaId: pizzaConfig, ...cfg })}
          onClose={() => setPizzaConfig(null)}
        />
      )}

      {dishConfig && (
        <DishConfigurator
          dish={dishConfig}
          category={categories?.find(c => c.id === selectedCat)}
          onAdd={handleDishAdd}
          onClose={() => setDishConfig(null)}
        />
      )}

      {wineConfig && (
        <WineConfigurator
          wine={wineConfig}
          onAdd={handleWineAdd}
          onClose={() => setWineConfig(null)}
        />
      )}
    </div>
  )
}
