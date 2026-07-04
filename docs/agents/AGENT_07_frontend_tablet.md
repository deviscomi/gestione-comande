# AGENT 07 — Frontend Tablet: Interfaccia Cameriere (PWA)

**Dipendenze:** AGENT_01 completato. API di AGENT_03 + 04 + 05 disponibili.
**Output atteso:** PWA completa e funzionante su tablet Android — flusso PIN→Tavoli→Ordine→Invio.

---

## Obiettivo

Implementare l'intera interfaccia operativa del cameriere:
- PIN lock con timeout inattività
- Lista tavoli con zone, status, bis/tris
- Pagina tavolo con storico e totale
- Schermata ordine split 50/50
- Pannello varianti piatti e PizzaConfigurator
- Invio con conferma e gestione errori stampa
- WebSocket per aggiornamenti in tempo reale
- Offline queue con Service Worker

---

## Struttura file da creare

```
src/
├── pages/tablet/
│   ├── Login.jsx
│   ├── PinLock.jsx
│   ├── TableList.jsx
│   ├── TableDetail.jsx
│   └── OrderScreen.jsx
├── components/tablet/
│   ├── TableCard.jsx
│   ├── ZoneSection.jsx
│   ├── FuoriToggle.jsx
│   ├── MenuPanel.jsx
│   ├── CategoryList.jsx
│   ├── DishItem.jsx
│   ├── OrderSummary.jsx
│   ├── OrderItem.jsx
│   ├── ItemVariantDrawer.jsx
│   ├── PizzaConfigurator.jsx
│   ├── ConfirmSendDialog.jsx
│   ├── PrintErrorToast.jsx
│   ├── BottomNavBar.jsx
│   └── SendButton.jsx
├── store/
│   ├── useAuthStore.js
│   ├── useTableStore.js
│   ├── useOrderStore.js
│   ├── useSettingsStore.js
│   └── usePrintStore.js
├── hooks/
│   ├── usePinLock.js
│   ├── useWebSocket.js
│   ├── useOfflineQueue.js
│   └── usePizzaPrice.js
└── App.jsx (routing)
```

---

## App.jsx — Routing

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import PinLock from './pages/tablet/PinLock'
import Login from './pages/tablet/Login'
import TableList from './pages/tablet/TableList'
import TableDetail from './pages/tablet/TableDetail'
import OrderScreen from './pages/tablet/OrderScreen'

function ProtectedRoute({ children }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" />
  if (user?.role === 'admin') return <Navigate to="/admin" />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <PinLock /> {/* overlay globale */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><TableList /></ProtectedRoute>} />
        <Route path="/tables/:id" element={<ProtectedRoute><TableDetail /></ProtectedRoute>} />
        <Route path="/tables/:id/order" element={<ProtectedRoute><OrderScreen /></ProtectedRoute>} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  )
}
```

---

## PinLock.jsx — Logica completa

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useAuthStore } from '../../store/useAuthStore'

export default function PinLock() {
  const [locked, setLocked] = useState(false)
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const timerRef = useRef(null)
  const { pin, timeout } = useSettingsStore()
  const { token } = useAuthStore()

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setLocked(true), timeout * 1000)
  }, [timeout])

  useEffect(() => {
    if (!token) return
    resetTimer()
    const events = ['touchstart', 'click', 'keydown', 'scroll']
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }))
    return () => {
      clearTimeout(timerRef.current)
      events.forEach(e => document.removeEventListener(e, resetTimer))
    }
  }, [token, resetTimer])

  // Forza blocco su ForceLogout WebSocket (gestito in useWebSocket hook)
  useEffect(() => {
    window.addEventListener('force-lock', () => setLocked(true))
    return () => window.removeEventListener('force-lock', () => {})
  }, [])

  function handleDigit(d) {
    const next = input + d
    setInput(next)
    if (next.length === pin.length) {
      if (next === pin) {
        setLocked(false)
        setInput('')
        resetTimer()
      } else {
        setShake(true)
        setTimeout(() => { setShake(false); setInput('') }, 600)
      }
    }
  }

  if (!locked || !token) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--color-background-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Inserisci il PIN per sbloccare
      </p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {Array.from({ length: pin.length }).map((_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < input.length
              ? 'var(--color-text-info)'
              : 'var(--color-border-secondary)',
            transition: '.15s'
          }} />
        ))}
      </div>
      <div className={shake ? 'pin-shake' : ''} style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: 190
      }}>
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
          <button key={i}
            onClick={() => typeof d === 'number' ? handleDigit(String(d)) : d === '⌫' && setInput(p => p.slice(0,-1))}
            style={{
              padding: '12px 0', fontSize: 18, fontWeight: 500,
              borderRadius: 8, border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)',
              opacity: d === '' ? 0 : 1, pointerEvents: d === '' ? 'none' : 'auto'
            }}
          >{d}</button>
        ))}
      </div>
    </div>
  )
}
```

---

## TableList.jsx — Lista tavoli con zone

```jsx
import { useQuery } from '@tanstack/react-query'
import api from '../../api/axios'
import ZoneSection from '../../components/tablet/ZoneSection'
import BottomNavBar from '../../components/tablet/BottomNavBar'
import FuoriToggle from '../../components/tablet/FuoriToggle'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useWebSocket } from '../../hooks/useWebSocket'

export default function TableList() {
  const { data: zones, refetch } = useQuery({
    queryKey: ['zones-with-tables'],
    queryFn: () => api.get('/zones').then(r => r.data.data),
    refetchInterval: 30000, // fallback polling
  })

  const { data: schedule } = useQuery({
    queryKey: ['schedule-today'],
    queryFn: () => api.get('/service-schedule/today').then(r => r.data),
  })

  // WebSocket: aggiorna quando un tavolo cambia status
  useWebSocket('tables', (event) => refetch())

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* TopBar */}
      <div style={{
        padding: '8px 16px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontWeight: 500 }}>Tavoli</span>
        <FuoriToggle zones={zones} onToggle={refetch} />
      </div>

      {/* Zone list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {zones?.map(zone => (
          <ZoneSection key={zone.id} zone={zone} onUpdate={refetch} />
        ))}
      </div>

      <BottomNavBar active="tables" />
    </div>
  )
}
```

---

## OrderScreen.jsx — Split 50/50

```jsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../api/axios'
import MenuPanel from '../../components/tablet/MenuPanel'
import OrderSummary from '../../components/tablet/OrderSummary'
import ConfirmSendDialog from '../../components/tablet/ConfirmSendDialog'
import PrintErrorToast from '../../components/tablet/PrintErrorToast'
import BottomNavBar from '../../components/tablet/BottomNavBar'
import echo from '../../echo'

export default function OrderScreen() {
  const { id } = useParams()
  const [showConfirm, setShowConfirm] = useState(false)
  const [printErrors, setPrintErrors] = useState([])
  const [allSpicchi, setAllSpicchi] = useState(false)

  const { data: order, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then(r => r.data),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/send`),
    onSuccess: (res) => {
      setShowConfirm(false)
      refetch()
      // Ascolta print jobs
      res.data.print_jobs.forEach(job => {
        echo.private(`print-jobs.${job.id}`)
          .listen('PrintJobStatusChanged', (e) => {
            if (e.status === 'failed') {
              setPrintErrors(prev => [...prev, e])
            }
          })
      })
    }
  })

  const pendingItems = order?.items?.filter(i => i.status === 'pending') ?? []
  const hasPizzasPending = pendingItems.some(i => i.item_type === 'pizza')

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* TopBar */}
      <div style={{
        padding: '8px 12px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <button onClick={() => history.back()}>←</button>
        <span style={{ fontWeight: 500 }}>Tav {order?.table?.number} — Ordine</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          #{order?.order_number}
        </span>
      </div>

      {/* Split panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <MenuPanel orderId={id} onItemAdded={refetch} style={{ width: '50%', borderRight: '1px solid var(--color-border-tertiary)' }} />
        <OrderSummary order={order} style={{ width: '50%' }} />
      </div>

      {/* Send bar */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          {pendingItems.length} articoli da inviare
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {hasPizzasPending && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <input type="checkbox" checked={allSpicchi}
                onChange={e => setAllSpicchi(e.target.checked)} />
              Tutte a spicchi
            </label>
          )}
          <button
            disabled={pendingItems.length === 0 || sendMutation.isPending}
            onClick={() => setShowConfirm(true)}
            style={{
              padding: '6px 18px', borderRadius: 8,
              background: 'var(--color-background-info)',
              color: 'var(--color-text-info)',
              border: '1px solid var(--color-border-info)',
              fontWeight: 500, fontSize: 13
            }}
          >
            {sendMutation.isPending ? 'Invio...' : 'Invia'}
          </button>
        </div>
      </div>

      <BottomNavBar active="order" total={order?.total} />

      {/* Dialogs */}
      {showConfirm && (
        <ConfirmSendDialog
          order={order}
          pendingCount={pendingItems.length}
          onConfirm={() => sendMutation.mutate()}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {printErrors.map(err => (
        <PrintErrorToast key={err.job_id} error={err}
          onDismiss={() => setPrintErrors(p => p.filter(e => e.job_id !== err.job_id))} />
      ))}
    </div>
  )
}
```

---

## PizzaConfigurator.jsx — Configuratore pizza

```jsx
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/axios'

export default function PizzaConfigurator({ pizzaId, onAdd, onClose }) {
  const { data: pizza } = useQuery({
    queryKey: ['pizza', pizzaId],
    queryFn: () => api.get(`/pizzas/${pizzaId}`).then(r => r.data),
  })

  const [base, setBase] = useState('M')
  const [dough, setDough] = useState(null)
  const [mozzarella, setMozzarella] = useState(null)
  const [ingredients, setIngredients] = useState({}) // { id: 'less' | 'default' | 'more' | 'removed' }
  const [additions, setAdditions] = useState([]) // [{ ingredient, portion }]
  const [cut, setCut] = useState('intero')
  const [notes, setNotes] = useState('')

  // Calcolo prezzo live
  const totalPrice = useMemo(() => {
    if (!pizza) return 0
    let price = parseFloat(pizza.base_price)

    // Varianti
    if (dough) price += parseFloat(pizza.variants.find(v => v.code === dough)?.price_add ?? 0)
    if (mozzarella) price += parseFloat(pizza.variants.find(v => v.code === mozzarella)?.price_add ?? 0)

    // Rimozioni ingredienti default
    pizza.default_ingredients.forEach(ing => {
      if (ingredients[ing.id] === 'removed') {
        price -= parseFloat(ing.price_remove)
      }
    })

    // Aggiunte
    additions.forEach(({ ingredient }) => {
      price += parseFloat(ingredient.price_add)
    })

    return Math.max(0, price).toFixed(2)
  }, [pizza, dough, mozzarella, ingredients, additions])

  function buildModifications() {
    const mods = []
    if (base !== 'M') mods.push({ mod_type: 'pizza_base', mod_value: base, price_change: 0 })
    if (dough) {
      const v = pizza.variants.find(v => v.code === dough)
      mods.push({ mod_type: 'pizza_dough', mod_value: dough, price_change: parseFloat(v.price_add) })
    }
    if (mozzarella) {
      const v = pizza.variants.find(v => v.code === mozzarella)
      mods.push({ mod_type: 'pizza_mozzarella', mod_value: mozzarella, price_change: parseFloat(v.price_add) })
    }
    pizza?.default_ingredients.forEach(ing => {
      const state = ingredients[ing.id]
      if (state === 'removed') mods.push({ mod_type: 'ingredient_remove', mod_value: String(ing.id), price_change: -parseFloat(ing.price_remove) })
      if (state === 'less') mods.push({ mod_type: 'ingredient_portion', mod_value: `less:${ing.id}`, price_change: 0 })
      if (state === 'more') mods.push({ mod_type: 'ingredient_portion', mod_value: `more:${ing.id}`, price_change: 0 })
    })
    additions.forEach(({ ingredient }) => {
      mods.push({ mod_type: 'ingredient_add', mod_value: String(ingredient.id), price_change: parseFloat(ingredient.price_add) })
    })
    if (cut !== 'intero') mods.push({ mod_type: 'pizza_cut', mod_value: cut, price_change: 0 })
    return mods
  }

  if (!pizza) return <div>Caricamento...</div>

  const bases = ['M', "Rose'", 'R', 'B', 'S']
  const doughVariants = pizza.variants.filter(v => ['CERE','DOPP'].includes(v.code))
  const mozVariants = pizza.variants.filter(v => v.code === 'NO LATT.')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--color-background-primary)',
        borderRadius: '0 0 12px 12px',
        padding: 16, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{pizza.name}</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>€ {pizza.base_price}</span>
        </div>

        {/* Base */}
        <FieldRow label="Base">
          {bases.map(b => (
            <Chip key={b} active={base === b} onClick={() => setBase(b)}>{b}</Chip>
          ))}
        </FieldRow>

        {/* Impasto */}
        <FieldRow label="Impasto">
          <Chip active={!dough} onClick={() => setDough(null)}>Normale</Chip>
          {doughVariants.map(v => (
            <Chip key={v.code} active={dough === v.code} onClick={() => setDough(v.code)}>
              {v.code} (+€{v.price_add})
            </Chip>
          ))}
        </FieldRow>

        {/* Mozzarella */}
        <FieldRow label="Mozzarella">
          <Chip active={!mozzarella} onClick={() => setMozzarella(null)}>Normale</Chip>
          {mozVariants.map(v => (
            <Chip key={v.code} active={mozzarella === v.code} onClick={() => setMozzarella(v.code)}>
              {v.code} (+€{v.price_add})
            </Chip>
          ))}
        </FieldRow>

        {/* Ingredienti default */}
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Ingredienti</p>
        {pizza.default_ingredients.map(ing => (
          <div key={ing.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 0', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: 12
          }}>
            <span style={{ color: ingredients[ing.id] === 'removed' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)' }}>
              {ing.name}
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              {[['–', 'less'], ['●', 'default'], ['+', 'more']].map(([label, val]) => (
                <button key={val}
                  onClick={() => setIngredients(p => ({ ...p, [ing.id]: val }))}
                  style={{
                    width: 22, height: 22, borderRadius: 3, fontSize: 11,
                    border: '1px solid var(--color-border-secondary)',
                    background: (ingredients[ing.id] ?? 'default') === val
                      ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                    color: (ingredients[ing.id] ?? 'default') === val
                      ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                  }}
                >{label}</button>
              ))}
              <button onClick={() => setIngredients(p => ({ ...p, [ing.id]: 'removed' }))}
                style={{ width: 22, height: 22, borderRadius: 3, fontSize: 12,
                  border: '1px solid var(--color-border-danger)',
                  color: 'var(--color-text-danger)',
                  background: 'var(--color-background-secondary)'
                }}>×</button>
            </div>
          </div>
        ))}

        {/* Taglio */}
        <FieldRow label="Taglio" style={{ marginTop: 10 }}>
          {['intero','spicchi',"meta'"].map(t => (
            <Chip key={t} active={cut === t} onClick={() => setCut(t)}>{t}</Chip>
          ))}
        </FieldRow>

        {/* Note */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Note</p>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Note pizza..."
            style={{ width: '100%', padding: '5px 8px', fontSize: 12, borderRadius: 8 }} />
        </div>

        {/* Totale + azioni */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Totale: <strong>€ {totalPrice}</strong>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12 }}>Annulla</button>
            <button onClick={() => onAdd({ modifications: buildModifications(), notes, unit_price: totalPrice })}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: 'var(--color-background-info)', color: 'var(--color-text-info)',
                border: '1px solid var(--color-border-info)'
              }}>Aggiungi pizza</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 10, fontSize: 11,
      border: '1px solid var(--color-border-secondary)',
      background: active ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
      color: active ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
    }}>{children}</button>
  )
}

function FieldRow({ label, children, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, ...style }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 70 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  )
}
```

---

## useWebSocket.js — Hook WebSocket

```js
import { useEffect } from 'react'
import echo from '../echo'
import { useAuthStore } from '../store/useAuthStore'

export function useWebSocket(channel, callback) {
  const { user } = useAuthStore()
  useEffect(() => {
    if (!user) return
    const ch = echo.private(channel)
    ch.listen('.TableStatusChanged', callback)
    ch.listen('.OrderUpdated', callback)
    return () => ch.stopListening('.TableStatusChanged').stopListening('.OrderUpdated')
  }, [user, channel])
}
```

## useOfflineQueue.js — Coda offline

```js
import { openDB } from 'idb'
import api from '../api/axios'

const DB_NAME = 'comande-offline'
const STORE = 'pending-requests'

export async function queueRequest(request) {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) { db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }) }
  })
  await db.add(STORE, { ...request, timestamp: Date.now() })
}

export async function flushQueue() {
  const db = await openDB(DB_NAME, 1)
  const all = await db.getAll(STORE)
  for (const req of all) {
    try {
      await api({ method: req.method, url: req.url, data: req.data })
      await db.delete(STORE, req.id)
    } catch (e) {
      if (!e.response) break // ancora offline
    }
  }
}

// Chiamare flushQueue() quando la connessione torna online
window.addEventListener('online', flushQueue)
```

---

## Criteri di completamento

- [ ] PWA installabile su tablet Android (Lighthouse PWA score ≥ 90)
- [ ] PIN lock si attiva dopo 5 min inattività e si sblocca con PIN corretto
- [ ] Lista tavoli mostra zone, status colorati, coperti
- [ ] (+) crea Bis/Tris senza conferma; (-) chiede conferma
- [ ] Schermata ordine split 50/50 funzionante su tablet landscape
- [ ] `PizzaConfigurator` calcola prezzo in tempo reale
- [ ] `POST /send` con 0 coperti mostra messaggio errore
- [ ] PrintErrorToast compare su stampa fallita con pulsante ristampa
- [ ] Offline: ordine salvato in IndexedDB e inviato al reconnect
- [ ] WebSocket aggiorna status tavoli in tempo reale
