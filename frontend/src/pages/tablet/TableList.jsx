import { useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/useAuthStore'
import { useNavigate } from 'react-router-dom'
import { ordersApi } from '../../api/endpoints/orders'
import { useModule } from '../../hooks/useModule'
import echo from '../../echo'
import ZoneSection from '../../components/tablet/ZoneSection'
import BottomNavBar from '../../components/tablet/BottomNavBar'

export default function TableList() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const pizzeriaEnabled = useModule('pizzeria')

  const subscribedRef = useRef(new Set())

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => ordersApi.getZones().then(r => r.data.data),
    refetchInterval: 30000, // fallback polling — aggiornamenti real-time via WebSocket
  })

  // Iscrizione ai canali tables.{id} per ogni tavolo caricato.
  // Il Set evita doppie iscrizioni se zones viene ricaricato (es. admin aggiunge un tavolo).
  useEffect(() => {
    if (!zones) return
    zones.flatMap(z => z.tables ?? []).forEach(t => {
      if (subscribedRef.current.has(t.id)) return
      subscribedRef.current.add(t.id)
      echo.private(`tables.${t.id}`).listen('.table.status', () => {
        qc.invalidateQueries({ queryKey: ['zones'] })
      })
    })
  }, [zones])

  // Cleanup a unmount
  useEffect(() => {
    return () => {
      subscribedRef.current.forEach(id => echo.leave(`tables.${id}`))
      subscribedRef.current.clear()
    }
  }, [])

  const { data: schedule } = useQuery({
    queryKey: ['schedule-today'],
    queryFn: () => ordersApi.getScheduleToday().then(r => r.data),
  })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background-primary)' }}>
      {/* TopBar */}
      <div style={{
        padding: '10px 16px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Tavoli</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {schedule && (
            <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 8,
                background: schedule.departments?.cucina ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
                color: schedule.departments?.cucina ? 'var(--color-text-success)' : 'var(--color-text-tertiary)',
                border: '1px solid var(--color-border-tertiary)'
              }}>Cucina</span>
              {pizzeriaEnabled && (
                <span style={{
                  padding: '2px 8px', borderRadius: 8,
                  background: schedule.departments?.pizzeria ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
                  color: schedule.departments?.pizzeria ? 'var(--color-text-success)' : 'var(--color-text-tertiary)',
                  border: '1px solid var(--color-border-tertiary)'
                }}>Pizzeria</span>
              )}
            </div>
          )}
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{user?.name}</span>
          <button onClick={() => navigate('/manage-tables')} title="Gestisci tavoli e zone" style={{
            fontSize: 16, padding: '3px 7px', borderRadius: 6,
            border: '1px solid var(--color-border-secondary)',
            background: 'transparent', color: 'var(--color-text-secondary)'
          }}>⊞</button>
          <button onClick={logout} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6,
            border: '1px solid var(--color-border-secondary)',
            background: 'transparent', color: 'var(--color-text-secondary)'
          }}>Esci</button>
        </div>
      </div>

      {/* Zones */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 80px' }}>
        {!zones && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Caricamento...</div>}
        {zones?.filter(z => z.is_enabled).map(zone => (
          <ZoneSection
            key={zone.id}
            zone={zone}
            onUpdate={() => qc.invalidateQueries({ queryKey: ['zones'] })}
          />
        ))}
      </div>

      <BottomNavBar active="tables" />
    </div>
  )
}
