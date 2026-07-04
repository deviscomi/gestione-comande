import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

// Stato fiscale → etichetta + colori (CSS variables, dark mode automatica)
const STATUS_META = {
  issued:  { label: 'Emesso',  bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
  failed:  { label: 'Fallito', bg: 'var(--color-background-danger)',  color: 'var(--color-text-danger)' },
  voided:  { label: 'Saltato', bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
  manual:  { label: 'Manuale', bg: 'var(--color-background-info)',    color: 'var(--color-text-info)' },
  pending: { label: 'In attesa', bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
}

const STATUS_OPTIONS = [
  { value: '',        label: 'Tutti gli stati' },
  { value: 'issued',  label: 'Emessi' },
  { value: 'failed',  label: 'Falliti' },
  { value: 'voided',  label: 'Saltati' },
  { value: 'manual',  label: 'Manuali' },
  { value: 'pending', label: 'In attesa' },
]

const filterStyle = {
  padding: '6px 10px', borderRadius: 8, fontSize: 12,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
}

export default function FiscalReceipts() {
  const [filters, setFilters] = useState({ fiscal_status: '', from: '', to: '' })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['fiscal-receipts', filters],
    queryFn: ({ pageParam = 1 }) => adminApi.getFiscalReceipts({ ...filters, page: pageParam }).then(r => r.data),
    // Collection paginata wrappata: { data: [...], meta: { current_page, last_page } }
    getNextPageParam: (last) => last.meta && last.meta.current_page < last.meta.last_page
      ? last.meta.current_page + 1
      : undefined,
  })

  const receipts = data?.pages.flatMap(p => p.data) ?? []

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Scontrini fiscali</h1>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select value={filters.fiscal_status} onChange={e => setFilters(p => ({ ...p, fiscal_status: e.target.value }))} style={filterStyle}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} style={filterStyle} />
        <input type="date" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} style={filterStyle} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--color-background-secondary)' }}>
            {['Data', 'Ordine / Tavolo', 'Importo', 'Cassiere', 'Stato', 'N. scontrino', 'Nota / Errore'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {receipts.map(r => {
            const meta = STATUS_META[r.fiscal_status] ?? { label: r.fiscal_status, bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                  {new Date(r.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {r.order_number ? `#${r.order_number}` : '—'}
                  {r.table_label && <span style={{ color: 'var(--color-text-tertiary)' }}> · {r.table_label}</span>}
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {r.amount != null ? `€ ${Number(r.amount).toFixed(2)}` : '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>{r.cashier ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{r.fiscal_receipt_number ?? '—'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{r.fiscal_error_message ?? '—'}</td>
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

      {receipts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessuno scontrino trovato</div>
      )}
    </div>
  )
}
