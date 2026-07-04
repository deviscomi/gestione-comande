import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '../../api/endpoints/orders'
import { useAuthStore } from '../../store/useAuthStore'

const STATUS_COLOR = {
  libero:   { bg: 'var(--color-background-primary)',  text: 'var(--color-text-tertiary)' },
  occupato: { bg: 'var(--color-background-warning)',   text: 'var(--color-text-warning)' },
  in_corso: { bg: 'var(--color-background-info)',      text: 'var(--color-text-info)' },
}

export default function Tables() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const { data: zones } = useQuery({
    queryKey: ['zones-admin'],
    queryFn: () => ordersApi.getZones().then(r => r.data.data),
  })

  const dupMut = useMutation({
    mutationFn: ({ id, suffix }) => ordersApi.duplicateTable(id, suffix),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones-admin'] }),
  })

  const removeDupMut = useMutation({
    mutationFn: (id) => ordersApi.removeDuplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones-admin'] }),
  })

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Tavoli e Zone</h1>
        {isAdmin && (
          <Link to="/admin/zones" style={{
            fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
            background: 'var(--color-background-secondary)', color: 'var(--color-text-info)',
            border: '1px solid var(--color-border-tertiary)', textDecoration: 'none',
          }}>
            Gestisci Zone →
          </Link>
        )}
      </div>

      {zones?.map(zone => (
        <div key={zone.id} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            {zone.name} {zone.is_outdoor ? '(esterno)' : ''}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {zone.tables?.filter(t => !t.parent_table_id).map(table => {
              const c = STATUS_COLOR[table.status] ?? STATUS_COLOR.libero
              return (
                <div key={table.id} style={{
                  padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--color-border-tertiary)',
                  background: c.bg
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Tav {table.number}</div>
                  <div style={{ fontSize: 11, color: c.text, marginBottom: 8 }}>{table.status}</div>
                  {/* Duplicati esistenti */}
                  {table.children?.map(child => (
                    <div key={child.id} style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 6, marginBottom: 4,
                      background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)',
                      display: 'flex', justifyContent: 'space-between'
                    }}>
                      <span>{child.suffix}</span>
                      {child.status === 'libero' && (
                        <button onClick={() => { if (confirm(`Rimuovere tav ${table.number} ${child.suffix}?`)) removeDupMut.mutate(child.id) }} style={{
                          fontSize: 12, background: 'none', border: 'none', color: 'var(--color-text-danger)', cursor: 'pointer', padding: 0
                        }}>×</button>
                      )}
                    </div>
                  ))}
                  {/* Azioni duplicazione */}
                  {table.status === 'occupato' || table.status === 'in_corso' ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!table.children?.find(c => c.suffix === 'bis') && (
                        <button onClick={() => dupMut.mutate({ id: table.id, suffix: 'bis' })} style={{
                          flex: 1, fontSize: 10, padding: '2px 0', borderRadius: 4,
                          border: '1px solid var(--color-border-secondary)',
                          background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)'
                        }}>+bis</button>
                      )}
                      {table.children?.find(c => c.suffix === 'bis') && !table.children?.find(c => c.suffix === 'tris') && (
                        <button onClick={() => dupMut.mutate({ id: table.id, suffix: 'tris' })} style={{
                          flex: 1, fontSize: 10, padding: '2px 0', borderRadius: 4,
                          border: '1px solid var(--color-border-secondary)',
                          background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)'
                        }}>+tris</button>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
