import { useState } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

const ACTION_COLORS = {
  TABLE_CLOSED:   { bg: 'var(--color-background-danger)',  color: 'var(--color-text-danger)' },
  ORDER_SENT:     { bg: 'var(--color-background-info)',    color: 'var(--color-text-info)' },
  DAILY_CLOSURE:  { bg: '#f3e8ff',                         color: '#7c3aed' },
  USER_CREATED:   { bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
  PIN_CHANGED:    { bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
  DISH_TOGGLED:   { bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
  PRINTER_TEST:   { bg: 'var(--color-background-info)',    color: 'var(--color-text-info)' },
}

// Etichette in italiano dei codici azione. Le voci non mappate usano il fallback "umanizzato".
const ACTION_LABELS = {
  login:                        'Login',
  logout:                       'Logout',
  force_logout:                 'Logout forzato',
  ORDER_CREATED:                'Ordine creato',
  ORDER_SENT:                   'Comanda inviata',
  ORDER_REPRINTED:              'Comanda ristampata',
  ORDER_MOVED:                  'Ordine spostato',
  TABLE_CLOSED:                 'Tavolo chiuso',
  TABLE_DUPLICATED:             'Tavolo duplicato',
  PRE_CONTO_PRINTED:            'Pre-conto stampato',
  PRE_CONTO_PDF_VIEWED:         'Pre-conto PDF visualizzato',
  PAYMENT_REGISTERED:           'Pagamento registrato',
  PAYMENT_VOIDED:               'Pagamento annullato',
  FISCAL_RECEIPT_ISSUED:        'Scontrino fiscale emesso',
  FISCAL_RECEIPT_FAILED:        'Scontrino fiscale fallito',
  FISCAL_RECEIPT_SKIPPED:       'Scontrino fiscale saltato',
  FISCAL_RECEIPT_MANUAL:        'Incasso con scontrino fiscale manuale',
  FISCAL_DEVICE_CREATED:        'Registratore RT aggiunto',
  FISCAL_DEVICE_UPDATED:        'Registratore RT aggiornato',
  FISCAL_DEVICE_DELETED:        'Registratore RT eliminato',
  FISCAL_DEVICE_TEST:           'Test registratore RT',
  DAILY_CLOSURE:                'Chiusura giornaliera',
  PRINTER_CREATED:              'Stampante creata',
  PRINTER_UPDATED:              'Stampante aggiornata',
  PRINTER_DELETED:              'Stampante eliminata',
  PRINTER_TEST:                 'Test stampante',
  PRINT_RETRY:                  'Stampa: nuovo tentativo',
  PRINT_REPRINT:                'Stampa: ristampa',
  PRINT_JOBS_CLEARED:           'Code di stampa svuotate',
  USER_CREATED:                 'Utente creato',
  USER_UPDATED:                 'Utente aggiornato',
  USER_DELETED:                 'Utente eliminato',
  USER_TOGGLED:                 'Utente attivato/disattivato',
  PIN_CHANGED:                  'PIN modificato',
  SETTINGS_UPDATED:             'Impostazioni aggiornate',
  SETTING_UPDATED:              'Impostazione aggiornata',
  ACTIVITY_LOGS_PURGED:         'Pulizia log eseguita',
  DATA_EXPORTED:                'Dati esportati',
  DATA_IMPORTED:                'Dati importati',
  CATEGORY_CREATED:             'Categoria creata',
  CATEGORY_UPDATED:             'Categoria aggiornata',
  CATEGORY_DELETED:             'Categoria eliminata',
  CATEGORY_TOGGLED:             'Categoria attivata/disattivata',
  DISH_CREATED:                 'Piatto creato',
  DISH_UPDATED:                 'Piatto aggiornato',
  DISH_DELETED:                 'Piatto eliminato',
  DISH_TOGGLED:                 'Piatto attivato/disattivato',
  DISH_VARIANT_GROUP_CREATED:   'Gruppo variante creato',
  DISH_VARIANT_GROUP_UPDATED:   'Gruppo variante aggiornato',
  DISH_VARIANT_GROUP_DELETED:   'Gruppo variante eliminato',
  DISH_VARIANT_GROUP_TOGGLED:   'Gruppo variante attivato/disattivato',
  PIZZA_CREATED:                'Pizza creata',
  PIZZA_DELETED:                'Pizza eliminata',
  PIZZA_TOGGLED:                'Pizza attivata/disattivata',
  PIZZA_VARIANT_CREATED:        'Variante pizza creata',
  PIZZA_INGREDIENT_CREATED:     'Ingrediente pizza creato',
  INGREDIENT_CREATED:           'Ingrediente creato',
  INGREDIENT_UPDATED:           'Ingrediente aggiornato',
  INGREDIENT_DELETED:           'Ingrediente eliminato',
  INGREDIENT_TOGGLED:           'Ingrediente attivato/disattivato',
  INGREDIENT_CATEGORY_CREATED:  'Categoria ingrediente creata',
  INGREDIENT_CATEGORY_UPDATED:  'Categoria ingrediente aggiornata',
  INGREDIENT_CATEGORY_DELETED:  'Categoria ingrediente eliminata',
  INGREDIENT_CATEGORY_TOGGLED:  'Categoria ingrediente attivata/disattivata',
  WINE_CREATED:                 'Vino creato',
  WINE_UPDATED:                 'Vino aggiornato',
  WINE_DELETED:                 'Vino eliminato',
  WINE_TOGGLED:                 'Vino attivato/disattivato',
  WINE_QUANTITY_CREATED:        'Formato vino creato',
  WINE_QUANTITY_UPDATED:        'Formato vino aggiornato',
  WINE_QUANTITY_DELETED:        'Formato vino eliminato',
  WINE_QUANTITY_TOGGLED:        'Formato vino attivato/disattivato',
  ZONE_CREATED:                 'Zona creata',
  ZONE_TOGGLED:                 'Zona attivata/disattivata',
}

// Fallback per codici non mappati: "INGREDIENT_TOGGLED" -> "Ingredient toggled"
function humanize(code) {
  return String(code).replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}
function actionLabel(code) {
  return ACTION_LABELS[code] ?? humanize(code)
}

// Data (YYYY-MM-DD) di N mesi fa, per i preset di pulizia
function monthsAgoISO(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().split('T')[0]
}

const EMPTY_FILTERS = { action: '', from: '', to: '' }

const inputStyle = {
  padding: '6px 10px', borderRadius: 8, fontSize: 12,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
}

export default function ActivityLogs() {
  const [draft, setDraft] = useState(EMPTY_FILTERS)       // valori dei campi
  const [filters, setFilters] = useState(EMPTY_FILTERS)   // valori applicati (queryKey)
  const [showPurge, setShowPurge] = useState(false)
  const [purgeDate, setPurgeDate] = useState(() => monthsAgoISO(6))
  const qc = useQueryClient()

  // Azioni realmente presenti, per popolare la tendina
  const { data: actionOptions = [] } = useQuery({
    queryKey: ['activity-log-actions'],
    queryFn: () => adminApi.getActivityLogActions().then(r => r.data),
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['activity-logs', filters],
    queryFn: ({ pageParam = 1 }) => adminApi.getActivityLogs({ ...filters, page: pageParam }).then(r => r.data),
    // Collection paginata wrappata: { data: [...], meta: { current_page, last_page } }
    getNextPageParam: (last) => last.meta && last.meta.current_page < last.meta.last_page
      ? last.meta.current_page + 1
      : undefined,
  })

  const logs = data?.pages.flatMap(p => p.data) ?? []

  // Anteprima: quanti log verrebbero eliminati con la data scelta
  const { data: purgeCount, isFetching: purgeCounting } = useQuery({
    queryKey: ['activity-logs-count', purgeDate],
    queryFn: () => adminApi.getActivityLogsCount(purgeDate).then(r => r.data.count),
    enabled: showPurge && !!purgeDate,
  })

  const purgeMut = useMutation({
    mutationFn: () => adminApi.purgeActivityLogs(purgeDate).then(r => r.data),
    onSuccess: (res) => {
      setShowPurge(false)
      qc.invalidateQueries({ queryKey: ['activity-logs'] })
      qc.invalidateQueries({ queryKey: ['activity-log-actions'] })
      alert(`Eliminati ${res.deleted} log attività.`)
    },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la pulizia dei log'),
  })

  function applyFilters() { setFilters(draft) }
  function resetFilters() { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS) }

  function confirmPurge() {
    if (!purgeDate) { alert('Seleziona una data'); return }
    const human = new Date(purgeDate).toLocaleDateString('it-IT')
    if (!confirm(`Eliminare definitivamente tutti i log precedenti al ${human}? L'operazione è irreversibile.`)) return
    purgeMut.mutate()
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Log attività</h1>
        <button onClick={() => setShowPurge(true)} style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--color-border-danger)',
          background: 'transparent', color: 'var(--color-text-danger)', cursor: 'pointer',
        }}>Pulisci vecchi log</button>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={draft.action} onChange={e => setDraft(p => ({ ...p, action: e.target.value }))} style={{ ...inputStyle, minWidth: 200 }}>
          <option value="">Tutte le azioni</option>
          {actionOptions.map(code => (
            <option key={code} value={code}>{actionLabel(code)}</option>
          ))}
        </select>
        <input type="date" value={draft.from} onChange={e => setDraft(p => ({ ...p, from: e.target.value }))} style={inputStyle} />
        <input type="date" value={draft.to} onChange={e => setDraft(p => ({ ...p, to: e.target.value }))} style={inputStyle} />

        <button onClick={applyFilters} style={{
          padding: '6px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
        }}>Cerca</button>
        <button onClick={resetFilters} style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12,
          border: '1px solid var(--color-border-secondary)',
          background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>Azzera</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--color-background-secondary)' }}>
            {['Timestamp', 'Utente', 'Azione', 'Descrizione'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const c = ACTION_COLORS[log.action] ?? { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }
            return (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td style={{ padding: '8px 12px' }}>{log.user?.name ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span title={log.action} style={{ padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color }}>
                    {actionLabel(log.action)}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{log.description}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {hasNextPage && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} style={{
            padding: '7px 20px', borderRadius: 8, fontSize: 12,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)'
          }}>{isFetchingNextPage ? 'Caricamento...' : 'Carica altri'}</button>
        </div>
      )}

      {logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun log trovato</div>
      )}

      {/* Modal pulizia log */}
      {showPurge && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            width: '100%', maxWidth: 380, padding: 22, borderRadius: 14,
            background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Pulisci vecchi log</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Verranno eliminati definitivamente tutti i log <strong>precedenti</strong> alla data scelta.
              L'operazione è irreversibile e resta tracciata nel log stesso.
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[3, 6, 12].map(m => (
                <button key={m} onClick={() => setPurgeDate(monthsAgoISO(m))} style={{
                  flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12,
                  border: '1px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', cursor: 'pointer',
                }}>{m} mesi</button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              Elimina i log precedenti al:
            </label>
            <input type="date" value={purgeDate} onChange={e => setPurgeDate(e.target.value)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, marginBottom: 12,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', boxSizing: 'border-box',
            }} />

            {/* Anteprima conteggio */}
            <div style={{
              fontSize: 12, fontWeight: 600, marginBottom: 18,
              color: purgeCount > 0 ? 'var(--color-text-danger)' : 'var(--color-text-tertiary)',
            }}>
              {!purgeDate
                ? 'Seleziona una data'
                : purgeCounting
                  ? 'Calcolo in corso…'
                  : (purgeCount > 0
                    ? `Verranno eliminati ${purgeCount} log precedenti al ${new Date(purgeDate).toLocaleDateString('it-IT')}`
                    : `Nessun log precedente al ${new Date(purgeDate).toLocaleDateString('it-IT')}`)}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowPurge(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', cursor: 'pointer',
              }}>Annulla</button>
              <button onClick={confirmPurge} disabled={purgeMut.isPending || purgeCounting || !purgeCount} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'var(--color-text-danger)', color: '#fff', border: 'none',
                cursor: (purgeMut.isPending || purgeCounting || !purgeCount) ? 'default' : 'pointer',
                opacity: (purgeMut.isPending || purgeCounting || !purgeCount) ? 0.5 : 1,
              }}>{purgeMut.isPending ? 'Pulizia...' : 'Elimina'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
