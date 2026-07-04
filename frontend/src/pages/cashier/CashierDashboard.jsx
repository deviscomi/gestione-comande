import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { cashierApi } from '../../api/endpoints/cashier'

export default function CashierDashboard() {
  const navigate = useNavigate()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['cashier-orders'],
    queryFn: () => cashierApi.getOrders().then(r => r.data?.data ?? []),
    refetchInterval: 15000,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background-primary)' }}>
      <div style={{
        padding: '14px 16px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Cassa — Tavoli aperti</h1>
        <Link to="/admin" style={{ fontSize: 13, color: 'var(--color-text-info)', textDecoration: 'none' }}>
          ← Pannello
        </Link>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isLoading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            Caricamento...
          </div>
        )}

        {!isLoading && orders?.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            Nessun tavolo aperto
          </div>
        )}

        {orders?.map(order => (
          <button
            key={order.id}
            onClick={() => navigate(`/cassa/tavoli/${order.id}`)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 10, textAlign: 'left',
              border: '1px solid var(--color-border-tertiary)',
              background: 'var(--color-background-secondary)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Tav {order.table.number}{order.table.suffix ? ` ${order.table.suffix}` : ''} — {order.table.zone}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Ordine #{order.order_number}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-info)' }}>
                &euro; {Number(order.total).toFixed(2)}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 10,
                background: order.is_settled ? 'var(--color-background-success)' : 'var(--color-background-warning)',
                color: order.is_settled ? 'var(--color-text-success)' : 'var(--color-text-warning)',
              }}>
                {order.is_settled ? 'Saldato' : 'In corso'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
