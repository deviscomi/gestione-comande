import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

export default function OrderHistory() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  const { data } = useQuery({
    queryKey: ['order-history', date],
    queryFn: () => adminApi.getOrderHistory({ date }).then(r => r.data.data),
  })

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Storico ordini</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
          padding: '6px 10px', borderRadius: 8, fontSize: 13,
          border: '1px solid var(--color-border-secondary)',
          background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
        }} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--color-background-secondary)' }}>
            {['#', 'Tavolo', 'Cameriere', 'Coperti', 'Totale', 'Stato', 'Chiuso alle'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.map(order => (
            <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
              <td style={{ padding: '9px 12px', color: 'var(--color-text-tertiary)' }}>#{order.order_number}</td>
              <td style={{ padding: '9px 12px' }}>Tav {order.table?.number} {order.table?.zone?.name}</td>
              <td style={{ padding: '9px 12px' }}>{order.user?.name}</td>
              <td style={{ padding: '9px 12px' }}>{order.covers}</td>
              <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--color-text-info)' }}>€ {Number(order.total).toFixed(2)}</td>
              <td style={{ padding: '9px 12px' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 6, fontSize: 11,
                  background: order.status === 'locked' ? 'var(--color-background-danger)' : 'var(--color-background-success)',
                  color: order.status === 'locked' ? 'var(--color-text-danger)' : 'var(--color-text-success)'
                }}>{order.status}</span>
              </td>
              <td style={{ padding: '9px 12px', color: 'var(--color-text-tertiary)', fontSize: 11 }}>
                {order.closed_at ? new Date(order.closed_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.length && <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary)' }}>Nessun ordine per questa data</div>}
    </div>
  )
}
