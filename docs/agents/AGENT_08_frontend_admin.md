# AGENT 08 — Frontend Backoffice: Interfaccia Admin

**Dipendenze:** AGENT_01 + 02 + 03 + 04 + 05 + 06 completati.
**Output atteso:** Backoffice admin completo su desktop e tablet — dashboard, menu, stampanti, report, chiusura.

---

## Obiettivo

Implementare il pannello di controllo dell'amministratore:
- Dashboard real-time sala con WebSocket
- CRUD menu cucina e pizzeria
- Configurazione stampanti con test
- Service schedule per reparti
- Report con grafici e export PDF
- Procedura guidata chiusura giornaliera
- Gestione camerieri, impostazioni, log attività

---

## Struttura file

```
src/pages/admin/
├── AdminLayout.jsx        (sidebar + header)
├── Dashboard.jsx
├── MenuKitchen.jsx        (categorie + piatti + ingredienti)
├── MenuPizzeria.jsx       (pizze + ingredienti + varianti)
├── Tables.jsx             (zone + tavoli)
├── Waiters.jsx
├── Printers.jsx
├── ServiceSchedule.jsx
├── Reports.jsx
├── OrderHistory.jsx
├── DailyClosure.jsx
├── Settings.jsx
└── ActivityLogs.jsx

src/components/admin/
├── Sidebar.jsx
├── Header.jsx
├── DishForm.jsx           (modale aggiunta/modifica piatto)
├── PizzaForm.jsx
├── IngredientForm.jsx
├── ReportChart.jsx        (recharts)
├── ClosureWizard.jsx      (wizard multi-step)
└── PrinterTestButton.jsx
```

---

## AdminLayout.jsx

```jsx
import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/axios'

const NAV_ITEMS = [
  { to: '/admin',           icon: '⊞',  label: 'Dashboard' },
  { to: '/admin/menu',      icon: '🍽️', label: 'Menu cucina' },
  { to: '/admin/pizzeria',  icon: '🍕', label: 'Menu pizzeria' },
  { to: '/admin/tables',    icon: '🪑', label: 'Tavoli & zone' },
  { to: '/admin/waiters',   icon: '👤', label: 'Camerieri' },
  { to: '/admin/printers',  icon: '🖨️', label: 'Stampanti' },
  { to: '/admin/schedule',  icon: '📅', label: 'Calendario' },
  { to: '/admin/reports',   icon: '📊', label: 'Report' },
  { to: '/admin/history',   icon: '📋', label: 'Storico ordini' },
  { to: '/admin/closure',   icon: '🔒', label: 'Chiusura' },
  { to: '/admin/settings',  icon: '⚙️', label: 'Impostazioni' },
  { to: '/admin/logs',      icon: '📝', label: 'Log attività' },
]

export default function AdminLayout() {
  const { data: failedJobs } = useQuery({
    queryKey: ['failed-print-jobs'],
    queryFn: () => api.get('/print-jobs?status=failed').then(r => r.data.total ?? 0),
    refetchInterval: 30000,
  })

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, background: 'var(--color-background-secondary)',
        borderRight: '1px solid var(--color-border-tertiary)',
        display: 'flex', flexDirection: 'column', padding: '12px 0', overflowY: 'auto'
      }}>
        <div style={{ padding: '0 16px 16px', fontWeight: 600, fontSize: 14 }}>
          Gestione Comande
        </div>
        {NAV_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', fontSize: 13, textDecoration: 'none',
              color: isActive ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
              background: isActive ? 'var(--color-background-info)' : 'transparent',
              borderRadius: 6, margin: '1px 8px',
            })}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.to === '/admin/printers' && failedJobs > 0 && (
              <span style={{
                marginLeft: 'auto', background: 'var(--color-background-danger)',
                color: 'var(--color-text-danger)', borderRadius: 10,
                padding: '1px 6px', fontSize: 10, fontWeight: 600
              }}>{failedJobs}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
```

---

## Dashboard.jsx — Real-time sala

```jsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/axios'
import echo from '../../echo'
import { useEffect } from 'react'

export default function Dashboard() {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  })

  // WebSocket: aggiorna in real-time
  useEffect(() => {
    const ch = echo.private('admin.dashboard')
    ch.listen('DashboardUpdated', () => qc.invalidateQueries({ queryKey: ['dashboard'] }))
    return () => ch.stopListening('DashboardUpdated')
  }, [])

  const stats = [
    { label: 'Tavoli aperti',  value: data?.open_tables ?? 0 },
    { label: 'Coperti totali', value: data?.total_covers ?? 0 },
    { label: 'Incasso serata', value: `€ ${Number(data?.today_revenue ?? 0).toFixed(2)}` },
  ]

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Dashboard</h1>

      {/* Alert stampe fallite */}
      {data?.failed_prints > 0 && (
        <div style={{
          background: 'var(--color-background-danger)',
          border: '1px solid var(--color-border-danger)',
          borderRadius: 8, padding: '8px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
        }}>
          ⚠️ {data.failed_prints} stampe fallite in coda
          <a href="/admin/printers" style={{ marginLeft: 'auto', color: 'var(--color-text-info)' }}>
            Gestisci →
          </a>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--color-background-secondary)',
            borderRadius: 8, padding: '12px 16px',
            border: '1px solid var(--color-border-tertiary)'
          }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Grid tavoli per zona */}
      {data?.zones?.map(zone => (
        <div key={zone.id} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>{zone.name}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
            {zone.tables?.map(table => (
              <div key={table.id} style={{
                padding: '8px 10px', borderRadius: 8, textAlign: 'center', fontSize: 12,
                border: `1px solid ${table.status === 'in_corso' ? 'var(--color-border-info)' : table.status === 'occupato' ? 'var(--color-border-warning)' : 'var(--color-border-tertiary)'}`,
                background: table.status === 'in_corso' ? 'var(--color-background-info)' : 'var(--color-background-primary)',
              }}>
                <div style={{ fontWeight: 500 }}>Tav {table.number}{table.suffix ? ` ${table.suffix}` : ''}</div>
                <div style={{ fontSize: 10, marginTop: 2, color: 'var(--color-text-tertiary)' }}>
                  {table.status === 'libero' ? '—' : `${table.active_order?.covers ?? 0} cop.`}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## MenuKitchen.jsx — Gestione menu cucina

Implementa accordion con categorie espandibili:

```jsx
// Struttura UI:
// [+ Aggiungi categoria]
// 
// ▼ Antipasti (8 piatti attivi)
//   ┌─────────────────────────────────────────────┐
//   │ Bruschetta al Pomodoro  €6.00  ✅  [Edit] [Del] │
//   │ Tagliere Misto          €12.00 ⏸️  [Edit] [Act] │
//   └─────────────────────────────────────────────┘
//   [+ Aggiungi piatto]
//
// ▶ Primi (5 piatti attivi)
// ▶ Secondi ...

// Componenti necessari:
// - CategoryAccordion: espande/collassa lista piatti
// - DishRow: singola riga piatto con toggle e azioni
// - DishFormModal: modale con form completo (usa react-hook-form)
// - IngredientManager: gestione archivio ingredienti separato
```

**DishFormModal** deve includere:
- Nome, descrizione, prezzo, categoria (select)
- Toggle disponibile
- Multi-select ingredienti di default (da `GET /ingredients`)
- Multi-select ingredienti aggiuntivi disponibili

---

## Reports.jsx — Report con grafici

```jsx
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import DateRangePicker from '../../components/admin/DateRangePicker'

// Report da implementare con grafici:
//
// 1. Fatturato giornaliero → BarChart (asse x = data, asse y = €)
// 2. Piatti più ordinati → BarChart orizzontale (top 10)
// 3. Fatturato per fascia oraria → LineChart (ore 12-23)
// 4. Confronto settimanale → LineChart multi-linea
// 5. Performance camerieri → tabella sortabile
//
// Pulsante Export PDF → POST /reports/export → download automatico

async function exportPdf(reportType, params) {
  const response = await api.post('/reports/export',
    { report_type: reportType, params },
    { responseType: 'blob' }
  )
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## DailyClosure.jsx — Wizard chiusura giornaliera

```jsx
// Step 1: Verifica
//   GET /daily-closures/check
//   Se open_tables > 0: mostra lista con warning
//   Pulsante "Forza chiusura" o "Torna ai tavoli"
//
// Step 2: Anteprima report
//   GET /reports/daily?date=today
//   Mostra stats: incasso totale, tavoli serviti, coperti totali
//
// Step 3: Conferma
//   Dialog: "Sei sicuro? I dati verranno bloccati."
//   POST /daily-closures (con force=true se tavoli aperti)
//   Progress bar durante l'elaborazione
//
// Step 4: Successo
//   "Chiusura completata. Report generato."
//   Link download PDF
//   Pulsante torna alla dashboard

const [step, setStep] = useState(1) // 1-4
const [checkData, setCheckData] = useState(null)
const [force, setForce] = useState(false)
```

---

## Waiters.jsx — Gestione camerieri

```jsx
// Tabella camerieri con:
// - Nome, Username, Ruolo, Stato (badge), PIN (mascherato)
// - Azioni: Modifica, Toggle stato, Cambia PIN, Force logout
//
// Force logout:
//   POST /auth/force-logout/{id}
//   Mostra conferma: "Disconnetti Mario dal tablet?"
//
// Form nuovo cameriere:
//   Nome, Cognome, Username, Password, PIN (4-6 cifre)
```

---

## ServiceSchedule.jsx — Calendario reparti

```jsx
// Layout 2 colonne: Cucina | Pizzeria
// Per ogni reparto: 7 toggle (Lun-Dom)
// Toggle attivo = verde, inattivo = grigio
// Salva con PUT /service-schedule (array completo)
// Toast di conferma al salvataggio

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
```

---

## ActivityLogs.jsx — Log attività

```jsx
// Tabella con scroll infinito (useInfiniteQuery)
// Colonne: Timestamp, Utente, Azione (badge colorato per tipo), Descrizione
// Filtri: Utente (select), Tipo azione (multi-select), Range date
//
// Badge colori per azione:
// TABLE_CLOSED → rosso
// ORDER_SENT → blu
// DAILY_CLOSURE → viola
// USER_CREATED, PIN_CHANGED → verde
// DISH_TOGGLED → arancione
//
// Click riga → modal dettaglio con entity_type + entity_id
```

---

## Settings.jsx — Impostazioni sistema

```jsx
// Form con campi:
// - PIN tablet: input numerico + mostra/nascondi
// - Timeout inattività: numero (secondi)
// - Messaggio chiusura tavolo: textarea
//
// Salva con PUT /settings (array di {key, value})
// PUT /settings/pin shortcut per il PIN
```

---

## Criteri di completamento

- [ ] Dashboard aggiornata in real-time via WebSocket senza refresh
- [ ] Alert stampe fallite visibile con link alla gestione stampanti
- [ ] CRUD piatti funzionante — toggle disponibilità immediato
- [ ] PizzaForm include ingredienti default, aggiunte disponibili e varianti
- [ ] Test stampa dal backoffice invia fisicamente alla stampante
- [ ] Tutti i grafici report renderizzati con recharts
- [ ] Export PDF scaricabile per ogni tipo di report
- [ ] Wizard chiusura: check tavoli → anteprima → conferma → success + PDF
- [ ] Force logout cameriere funzionante (WebSocket)
- [ ] Service schedule salva correttamente 14 righe (7 giorni × 2 reparti)
- [ ] Activity logs con paginazione e filtri funzionanti
- [ ] Sidebar responsive su tablet (hamburger menu)
