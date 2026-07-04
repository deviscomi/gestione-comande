import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { adminApi } from '../../api/endpoints/admin'

export default function Reports() {
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab] = useState('daily')
  const [date, setDate] = useState(today)
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
  const [to, setTo]     = useState(today)
  const [exporting, setExporting] = useState(false)
  const [printing, setPrinting] = useState(false)

  const printersQ = useQuery({ queryKey: ['printers'], queryFn: () => adminApi.getPrinters().then(r => r.data.data) })
  const canPrint = (printersQ.data ?? []).some(p => p.department === 'cassiere' && p.is_active)

  const dailyQ     = useQuery({ queryKey: ['report-daily', date],     queryFn: () => adminApi.getReportDaily({ date }).then(r => r.data),           enabled: tab === 'daily' })
  const dishesQ    = useQuery({ queryKey: ['report-dishes', from, to], queryFn: () => adminApi.getReportDishes({ from, to }).then(r => r.data),       enabled: tab === 'dishes' })
  const hourlyQ    = useQuery({ queryKey: ['report-hourly', date],     queryFn: () => adminApi.getReportHourly({ date }).then(r => r.data),           enabled: tab === 'hourly' })
  const weeklyQ    = useQuery({ queryKey: ['report-weekly', from, to], queryFn: () => adminApi.getReportWeekly({ from, to }).then(r => r.data),       enabled: tab === 'weekly' })
  const waitersQ   = useQuery({ queryKey: ['report-waiters', from, to],queryFn: () => adminApi.getReportWaiters({ from, to }).then(r => r.data),      enabled: tab === 'waiters' })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await adminApi.exportReport({ type: tab, date, from, to })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      // Apri in nuova scheda; se bloccato dal popup blocker, garantisci il download
      const win = window.open(url, '_blank')

      const a = document.createElement('a')
      a.href = url
      a.download = `report-${tab}-${today}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Non revocare subito: la nuova scheda potrebbe non aver ancora caricato il PDF
      setTimeout(() => URL.revokeObjectURL(url), 10000)

      if (!win) {
        console.warn('Apertura in nuova scheda bloccata dal popup blocker: PDF scaricato.')
      }
    } catch (err) {
      console.error('Errore esportazione PDF:', err)
      alert('Errore durante l\'esportazione del PDF. Riprova o controlla i filtri selezionati.')
    } finally {
      setExporting(false)
    }
  }

  async function handlePrintThermal() {
    setPrinting(true)
    try {
      const res = await adminApi.printReportThermal({ type: tab, date, from, to })
      alert(`Report inviato in stampa (Job ID: ${res.data.job_id})`)
    } catch (err) {
      if (err.response?.status === 400) {
        alert('Stampante cassa non configurata')
      } else {
        const msg = err.response?.data?.error || err.response?.data?.message || 'Errore durante l\'invio in stampa'
        alert(msg)
      }
    } finally {
      setPrinting(false)
    }
  }

  const TABS = [
    { key: 'daily', label: 'Fatturato giorno' },
    { key: 'hourly', label: 'Per ora' },
    { key: 'dishes', label: 'Piatti top' },
    { key: 'weekly', label: 'Settimanale' },
    { key: 'waiters', label: 'Camerieri' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Report</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} disabled={exporting} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)'
          }}>{exporting ? 'Esportazione...' : 'Esporta PDF'}</button>
          <button onClick={handlePrintThermal} disabled={printing || !canPrint}
            title={canPrint ? 'Stampa il report sulla stampante termica della cassa' : 'Nessuna stampante cassa configurata'}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-info)', color: 'var(--color-text-info)',
              opacity: (printing || !canPrint) ? 0.5 : 1,
              cursor: (printing || !canPrint) ? 'not-allowed' : 'pointer'
            }}>🖨 {printing ? 'Stampa...' : 'Stampa Cassa'}</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: '1px solid var(--color-border-secondary)',
            background: tab === t.key ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
            color: tab === t.key ? 'var(--color-text-info)' : 'var(--color-text-secondary)'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {(tab === 'daily' || tab === 'hourly') && (
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        )}
        {(tab === 'dishes' || tab === 'weekly' || tab === 'waiters') && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
            <span style={{ alignSelf: 'center', color: 'var(--color-text-tertiary)' }}>→</span>
            <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={inputStyle} />
          </>
        )}
      </div>

      {/* Daily KPI */}
      {tab === 'daily' && dailyQ.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Fatturato', value: `€ ${Number(dailyQ.data.total).toFixed(2)}` },
            { label: 'Tavoli serviti', value: dailyQ.data.orders_count },
            { label: 'Coperti', value: dailyQ.data.covers },
          ].map(s => (
            <div key={s.label} style={{ padding: '14px 18px', borderRadius: 10, background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Hourly chart */}
      {tab === 'hourly' && hourlyQ.data && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={hourlyQ.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
            <XAxis dataKey="hour" tickFormatter={h => `${h}:00`} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => `€ ${Number(v).toFixed(2)}`} />
            <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Fatturato" />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Dishes top chart */}
      {tab === 'dishes' && dishesQ.data && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dishesQ.data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="dish_id" tick={{ fontSize: 10 }} width={100} />
            <Tooltip />
            <Bar dataKey="total_qty" fill="var(--color-primary)" name="Quantità" />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Weekly chart */}
      {tab === 'weekly' && weeklyQ.data && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyQ.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
            <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => `€ ${Number(v).toFixed(2)}`} />
            <Bar dataKey="revenue" fill="var(--color-primary)" name="Fatturato" />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Waiters table */}
      {tab === 'waiters' && waitersQ.data && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)' }}>
              {['Cameriere', 'Tavoli', 'Coperti', 'Fatturato'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {waitersQ.data.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <td style={{ padding: '9px 12px' }}>{row.user?.name} {row.user?.surname}</td>
                <td style={{ padding: '9px 12px' }}>{row.tables_served}</td>
                <td style={{ padding: '9px 12px' }}>{row.total_covers}</td>
                <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--color-text-info)' }}>€ {Number(row.revenue).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const inputStyle = {
  padding: '6px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)'
}
