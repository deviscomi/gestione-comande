import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/endpoints/admin'
import { useAuthStore } from '../../store/useAuthStore'
import echo from '../../echo'

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => adminApi.getDashboard().then(r => r.data),
    refetchInterval: 60000,
  })

  useEffect(() => {
    const ch = echo.private('admin.dashboard')
    ch.listen('.dashboard.updated', () => qc.invalidateQueries({ queryKey: ['dashboard'] }))
    ch.listen('.table.status',      () => qc.invalidateQueries({ queryKey: ['dashboard'] }))
    return () => {
      ch.stopListening('.dashboard.updated')
      ch.stopListening('.table.status')
      echo.leave('admin.dashboard')
    }
  }, [])

  const stats = [
    { label: 'Tavoli aperti',    value: data?.open_tables ?? '—' },
    { label: 'Coperti in sala',  value: data?.total_covers ?? '—' },
    { label: 'Incasso oggi',     value: `€ ${Number(data?.today_revenue ?? 0).toFixed(2)}` },
    { label: 'Stampe in coda',   value: data?.pending_prints ?? 0 },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Dashboard</h1>

      {data?.failed_prints > 0 && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 10,
          background: 'var(--color-background-danger)',
          border: '1px solid var(--color-border-danger)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
        }}>
          <span style={{ color: 'var(--color-text-danger)' }}>
            ⚠️ {data.failed_prints} stampe fallite
          </span>
          {isAdmin && (
            <Link to="/admin/printers" style={{ marginLeft: 'auto', color: 'var(--color-text-info)', fontSize: 12 }}>
              Gestisci →
            </Link>
          )}
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            padding: '16px 18px', borderRadius: 10,
            background: 'var(--color-background-secondary)',
            border: '1px solid var(--color-border-tertiary)'
          }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Mappa tavoli */}
      {data?.zones?.map(zone => (
        <div key={zone.id} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            {zone.name}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
            {zone.tables?.map(table => {
              const isCorso   = table.status === 'in_corso'
              const isOccupato = table.status === 'occupato'
              return (
                <div key={table.id} style={{
                  padding: '10px 12px', borderRadius: 10, textAlign: 'center', fontSize: 12,
                  border: `1px solid ${isCorso ? 'var(--color-border-info)' : isOccupato ? 'var(--color-border-warning)' : 'var(--color-border-tertiary)'}`,
                  background: isCorso ? 'var(--color-background-info)' : isOccupato ? 'var(--color-background-warning)' : 'var(--color-background-primary)',
                }}>
                  <div style={{ fontWeight: 600 }}>Tav {table.number}{table.suffix ? ` ${table.suffix}` : ''}</div>
                  <div style={{ fontSize: 10, marginTop: 3, color: 'var(--color-text-tertiary)' }}>
                    {table.status === 'libero' ? 'Libero' : `${table.active_order?.covers ?? 0} cop.`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
