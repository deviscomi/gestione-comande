import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'
import { useModule } from '../../hooks/useModule'

function formatUptime(sec) {
  if (sec == null) return null
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}g ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function Printers() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', department: 'cucina', ip_address: '', port: 9100 })

  const pizzeriaEnabled = useModule('pizzeria')

  useEffect(() => {
    if (!pizzeriaEnabled && form.department === 'pizzeria') {
      setForm(p => ({ ...p, department: 'cucina' }))
    }
  }, [pizzeriaEnabled])
  const [testResult, setTestResult] = useState({})

  const { data: printers } = useQuery({
    queryKey: ['printers'],
    queryFn: () => adminApi.getPrinters().then(r => r.data.data),
  })

  const { data: failedJobs } = useQuery({
    queryKey: ['failed-jobs'],
    queryFn: () => adminApi.getFailedJobs().then(r => r.data.data),
  })

  // Stato dell'agente di stampa (Raspberry Pi). Presente solo in modalità
  // PRINT_DRIVER=agent; refetch periodico per riflettere online/offline.
  const { data: agent } = useQuery({
    queryKey: ['agent-status'],
    queryFn: () => adminApi.getAgentStatus().then(r => r.data),
    refetchInterval: 15000,
  })

  // Raggiungibilità per stampante riportata dall'agente: { [id]: {reachable, latency_ms} }
  const agentPrinters = {}
  if (agent?.applicable && agent?.online) {
    for (const p of agent.printers ?? []) agentPrinters[p.id] = p
  }

  const createMut  = useMutation({ mutationFn: (d) => adminApi.createPrinter(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['printers'] }); setShowForm(false) } })
  const toggleMut  = useMutation({ mutationFn: (id) => adminApi.togglePrinter(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }) })
  const deleteMut  = useMutation({ mutationFn: (id) => adminApi.deletePrinter(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }) })
  const retryMut   = useMutation({ mutationFn: (id) => adminApi.retryPrintJob(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['failed-jobs'] }) })
  const clearFailedMut = useMutation({
    mutationFn: () => adminApi.deleteFailedJobs(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['failed-jobs'] }),
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante l\'eliminazione'),
  })

  const testMut = useMutation({
    mutationFn: (id) => adminApi.testPrinter(id),
    onSuccess: (_, id) => setTestResult(p => ({ ...p, [id]: { ok: true, msg: 'Test inviato ✓' } })),
    onError: (e, id)  => setTestResult(p => ({ ...p, [id]: { ok: false, msg: e.response?.data?.message ?? 'Errore' } })),
  })

  const DEPT_COLOR = { cucina: 'var(--color-text-success)', pizzeria: 'var(--color-text-warning)', cassiere: 'var(--color-text-info)', bar: 'var(--color-text-danger)' }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Stampanti</h1>
        <button onClick={() => setShowForm(true)} style={{
          padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: 'var(--color-primary)', color: '#fff', border: 'none'
        }}>+ Aggiungi stampante</button>
      </div>

      {/* Stato agente di stampa (Raspberry Pi) — solo in modalità agent */}
      {agent?.applicable && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          border: `1px solid ${agent.online ? 'var(--color-border-success)' : 'var(--color-border-danger)'}`,
          background: agent.online ? 'var(--color-background-success)' : 'var(--color-background-danger)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: agent.online ? 'var(--color-text-success)' : 'var(--color-text-danger)'
          }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: agent.online ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
              Agente di stampa (Raspberry Pi) — {agent.online ? 'online' : 'offline'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {agent.online ? (
                <>
                  {agent.last_seen_at && <>visto {new Date(agent.last_seen_at).toLocaleTimeString()}</>}
                  {formatUptime(agent.uptime_seconds) && <> · attivo da {formatUptime(agent.uptime_seconds)}</>}
                  {agent.agent_version && <> · v{agent.agent_version}</>}
                </>
              ) : (
                <>Nessun heartbeat recente — il Raspberry potrebbe essere spento o senza rete.</>
              )}
            </div>
          </div>
        </div>
      )}

      {printers?.map(p => {
        const res = testResult[p.id]
        const reach = agentPrinters[p.id]
        return (
          <div key={p.id} style={{
            padding: '14px 16px', borderRadius: 10, marginBottom: 10,
            border: '1px solid var(--color-border-tertiary)',
            background: 'var(--color-background-secondary)',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                <span style={{ color: DEPT_COLOR[p.department], fontWeight: 600 }}>{p.department}</span>
                {' · '}{p.ip_address}:{p.port}
                {reach && (
                  <span style={{ color: reach.reachable ? 'var(--color-text-success)' : 'var(--color-text-danger)', fontWeight: 600 }}>
                    {' · '}{reach.reachable
                      ? `raggiungibile${reach.latency_ms != null ? ` (${reach.latency_ms}ms)` : ''}`
                      : 'non raggiungibile'}
                  </span>
                )}
              </div>
              {res && <div style={{ fontSize: 11, marginTop: 3, color: res.ok ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{res.msg}</div>}
            </div>
            <button onClick={() => testMut.mutate(p.id)} disabled={testMut.isPending} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)'
            }}>Test stampa</button>
            <button onClick={() => toggleMut.mutate(p.id)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: p.is_active ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
              color: p.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)'
            }}>{p.is_active ? 'Attiva' : 'Inattiva'}</button>
            <button onClick={() => { if (confirm(`Eliminare ${p.name}?`)) deleteMut.mutate(p.id) }} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-danger)',
              background: 'transparent', color: 'var(--color-text-danger)'
            }}>Elimina</button>
          </div>
        )
      })}

      {/* Stampe fallite */}
      {failedJobs?.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-danger)', margin: 0 }}>
              Stampe fallite ({failedJobs.length})
            </h2>
            <button
              onClick={() => {
                if (window.confirm(`Eliminare tutte le ${failedJobs.length} stampe fallite? I PDF di backup verranno rimossi.`))
                  clearFailedMut.mutate()
              }}
              disabled={clearFailedMut.isPending}
              style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--color-border-danger)',
                background: 'var(--color-background-danger)',
                color: 'var(--color-text-danger)',
                cursor: 'pointer',
                opacity: clearFailedMut.isPending ? 0.6 : 1,
              }}
            >
              {clearFailedMut.isPending ? 'Eliminazione...' : 'Elimina tutte'}
            </button>
          </div>
          {failedJobs.map(job => (
            <div key={job.id} style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 6,
              border: '1px solid var(--color-border-danger)',
              background: 'var(--color-background-danger)',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Job #{job.id} — {job.print_type}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{job.attempts} tentativi</div>
              </div>
              <button onClick={() => retryMut.mutate(job.id)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)'
              }}>Riprova</button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: 360, padding: 24, borderRadius: 12, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontWeight: 600 }}>Nuova stampante</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            {[
              { key: 'name', label: 'Nome' },
              { key: 'ip_address', label: 'Indirizzo IP' },
              { key: 'port', label: 'Porta', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type ?? 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Reparto</label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }}>
                <option value="cucina">Cucina</option>
                {pizzeriaEnabled && <option value="pizzeria">Pizzeria</option>}
                <option value="bar">Bar</option>
                <option value="cassiere">Cassiere</option>
              </select>
            </div>
            <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} style={{
              width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: createMut.isPending ? 0.7 : 1
            }}>{createMut.isPending ? 'Salvataggio...' : 'Aggiungi stampante'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
