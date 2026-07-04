import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

const DRIVERS = [
  { value: 'epson_fp',       label: 'Epson FP' },
  { value: 'custom',         label: 'Custom (da definire)' },
  { value: 'rch_webservice', label: 'RCH Webservice' },
  { value: 'generic_http',   label: 'Generico HTTP/JSON' },
  { value: 'generic_bridge', label: 'Generico Bridge locale' },
]

const CONNECTION_TYPES = [
  { value: 'lan_tcp',        label: 'LAN TCP/IP' },
  { value: 'http_webservice',label: 'Webservice HTTP' },
  { value: 'local_bridge',   label: 'Bridge locale' },
]

const EMPTY_FORM = {
  name: '', driver: 'generic_http', connection_type: 'http_webservice',
  ip_address: '', port: 9100, base_url: '', auth_token: '',
  fiscal_serial_number: '', vat_number: '', notes: '',
}

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
}
const labelStyle = { fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }

export default function FiscalDevices() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [testResult, setTestResult] = useState({})

  const { data: devices } = useQuery({
    queryKey: ['fiscal-devices'],
    queryFn: () => adminApi.getFiscalDevices().then(r => r.data.data),
  })

  const createMut = useMutation({
    mutationFn: (d) => adminApi.createFiscalDevice(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fiscal-devices'] }); setShowForm(false); setForm(EMPTY_FORM) },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante il salvataggio'),
  })
  const toggleMut = useMutation({ mutationFn: (id) => adminApi.toggleFiscalDevice(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-devices'] }) })
  const deleteMut = useMutation({ mutationFn: (id) => adminApi.deleteFiscalDevice(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-devices'] }) })

  const testMut = useMutation({
    mutationFn: (id) => adminApi.testFiscalDevice(id),
    onSuccess: (res, id) => setTestResult(p => ({ ...p, [id]: { ok: true, msg: res.data?.message ?? 'Connessione riuscita' } })),
    onError: (e, id) => setTestResult(p => ({ ...p, [id]: { ok: false, msg: e.response?.data?.message ?? 'Errore di connessione' } })),
  })

  const isLan = form.connection_type === 'lan_tcp'
  const isHttpLike = form.connection_type === 'http_webservice' || form.connection_type === 'local_bridge'

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Registratori Telematici</h1>
        <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true) }} style={{
          padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: 'var(--color-primary)', color: '#fff', border: 'none'
        }}>+ Aggiungi registratore</button>
      </div>

      {devices?.map(d => {
        const res = testResult[d.id]
        return (
          <div key={d.id} style={{
            padding: '14px 16px', borderRadius: 10, marginBottom: 10,
            border: '1px solid var(--color-border-tertiary)',
            background: 'var(--color-background-secondary)',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                <span style={{ fontWeight: 600 }}>{d.driver}</span>
                {' · '}{d.connection_type}
                {d.connection_type === 'lan_tcp' ? ` · ${d.ip_address}:${d.port}` : ` · ${d.base_url}`}
                {d.fiscal_serial_number && ` · Matricola ${d.fiscal_serial_number}`}
              </div>
              {res && <div style={{ fontSize: 11, marginTop: 3, color: res.ok ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{res.msg}</div>}
            </div>
            <button onClick={() => testMut.mutate(d.id)} disabled={testMut.isPending} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)'
            }}>Testa connessione</button>
            <button onClick={() => toggleMut.mutate(d.id)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: d.is_active ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
              color: d.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)'
            }}>{d.is_active ? 'Attivo' : 'Inattivo'}</button>
            <button onClick={() => { if (confirm(`Eliminare ${d.name}?`)) deleteMut.mutate(d.id) }} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-danger)',
              background: 'transparent', color: 'var(--color-text-danger)'
            }}>Elimina</button>
          </div>
        )
      })}

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: 400, maxHeight: '90vh', overflowY: 'auto', padding: 24, borderRadius: 12, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontWeight: 600 }}>Nuovo registratore telematico</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Nome</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Driver</label>
              <select value={form.driver} onChange={e => setForm(p => ({ ...p, driver: e.target.value }))} style={inputStyle}>
                {DRIVERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Tipo di collegamento</label>
              <select value={form.connection_type} onChange={e => setForm(p => ({ ...p, connection_type: e.target.value }))} style={inputStyle}>
                {CONNECTION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {isLan && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Indirizzo IP</label>
                  <input value={form.ip_address} onChange={e => setForm(p => ({ ...p, ip_address: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Porta</label>
                  <input type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} style={inputStyle} />
                </div>
              </>
            )}

            {isHttpLike && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>URL base</label>
                  <input placeholder="https://..." value={form.base_url} onChange={e => setForm(p => ({ ...p, base_url: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Token di autenticazione</label>
                  <input type="password" value={form.auth_token} onChange={e => setForm(p => ({ ...p, auth_token: e.target.value }))} style={inputStyle} />
                </div>
              </>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Matricola fiscale</label>
              <input value={form.fiscal_serial_number} onChange={e => setForm(p => ({ ...p, fiscal_serial_number: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Partita IVA</label>
              <input value={form.vat_number} onChange={e => setForm(p => ({ ...p, vat_number: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Note</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} />
            </div>

            <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} style={{
              width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: createMut.isPending ? 0.7 : 1
            }}>{createMut.isPending ? 'Salvataggio...' : 'Aggiungi registratore'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
