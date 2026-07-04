import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'
import { useModule } from '../../hooks/useModule'
import { useAuthStore } from '../../store/useAuthStore'

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function ServiceSchedule() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [schedule, setSchedule] = useState({})
  const [saved, setSaved] = useState(false)

  const pizzeriaEnabled = useModule('pizzeria')
  const depts = pizzeriaEnabled ? ['cucina', 'pizzeria', 'bar'] : ['cucina', 'bar']

  const { data } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => adminApi.getSchedule().then(r => r.data),
  })

  useEffect(() => {
    if (data) setSchedule(data)
  }, [data])

  const saveMut = useMutation({
    mutationFn: () => {
      const rows = []
      depts.forEach(dept => {
        DAYS.forEach((_, i) => {
          rows.push({ department: dept, day_of_week: i, is_active: schedule[dept]?.[i] ?? true })
        })
      })
      return adminApi.updateSchedule(rows)
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000) },
    onError: (err) => { alert('Errore nel salvataggio: ' + (err?.response?.data?.message ?? err.message)) },
  })

  function toggle(dept, day) {
    setSchedule(prev => ({
      ...prev,
      [dept]: { ...prev[dept], [day]: !(prev[dept]?.[day] ?? true) }
    }))
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Calendario servizio</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && <span style={{ fontSize: 12, color: 'var(--color-text-success)' }}>✓ Salvato</span>}
          {isAdmin ? (
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: saveMut.isPending ? 0.7 : 1
            }}>{saveMut.isPending ? 'Salvataggio...' : 'Salva modifiche'}</button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Sola lettura</span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${depts.length}, 1fr)`, gap: 20 }}>
        {depts.map(dept => (
          <div key={dept} style={{ padding: 20, borderRadius: 12, background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, textTransform: 'capitalize' }}>{dept}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DAYS.map((day, i) => {
                const active = schedule[dept]?.[i] ?? true
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ fontSize: 13 }}>{day}</span>
                    <button onClick={() => isAdmin && toggle(dept, i)} disabled={!isAdmin} style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: isAdmin ? 'pointer' : 'not-allowed',
                      background: active ? 'var(--color-primary)' : 'var(--color-border-secondary)',
                      position: 'relative', transition: 'background .2s', opacity: isAdmin ? 1 : 0.6
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3,
                        left: active ? 22 : 4, transition: 'left .2s'
                      }} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
