import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/endpoints/admin'

const STEPS = ['Verifica tavoli', 'Anteprima report', 'Conferma', 'Completata']

export default function DailyClosure() {
  const [step, setStep] = useState(1)
  const [force, setForce] = useState(false)
  const [closure, setClosure] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const navigate = useNavigate()

  const checkQ = useQuery({
    queryKey: ['closure-check'],
    queryFn: () => adminApi.checkClosure().then(r => r.data),
  })

  const today = new Date().toISOString().split('T')[0]
  const reportQ = useQuery({
    queryKey: ['report-daily-today'],
    queryFn: () => adminApi.getReportDaily({ date: today }).then(r => r.data),
    enabled: step === 2,
  })

  const closureMut = useMutation({
    mutationFn: () => adminApi.createClosure({ force }),
    onSuccess: (res) => {
      // response()->json(resource) non aggiunge il wrapper "data" — accesso diretto
      setClosure(res.data)
      setStep(4)
    },
    onError: (err) => {
      alert(err.response?.data?.message ?? 'Errore durante la chiusura giornaliera')
    },
  })

  const handleDownloadPdf = async () => {
    if (!closure?.id) return
    setPdfLoading(true)
    try {
      const res = await adminApi.getClosureReport(closure.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `report_chiusura_${today}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Errore nel download del report PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handlePrintThermal = async () => {
    if (!closure?.id) return
    setPrinting(true)
    try {
      const res = await adminApi.printClosureReportThermal(closure.id)
      alert(`Chiusura inviata in stampa (Job ID: ${res.data.job_id})`)
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

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Chiusura giornaliera</h1>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
        {STEPS.map((label, i) => {
          const n = i + 1
          const done = n < step
          const active = n === step
          return (
            <div key={n} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--color-primary)' : active ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                  color: done ? '#fff' : active ? 'var(--color-text-info)' : 'var(--color-text-tertiary)',
                  border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border-secondary)',
                  marginBottom: 4
                }}>{done ? '✓' : n}</div>
                <span style={{ fontSize: 10, color: active ? 'var(--color-text-info)' : 'var(--color-text-tertiary)', textAlign: 'center' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ height: 1, flex: 1, background: n < step ? 'var(--color-primary)' : 'var(--color-border-tertiary)', margin: '0 4px', marginBottom: 18 }} />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Verifica */}
      {step === 1 && (
        <div>
          {checkQ.isLoading && <div style={{ color: 'var(--color-text-tertiary)' }}>Verifica tavoli in corso...</div>}
          {checkQ.isError && (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', marginBottom: 16, fontSize: 13 }}>
              Errore durante la verifica dei tavoli. Riprova.
            </div>
          )}
          {checkQ.data && (
            <>
              {checkQ.data.can_close ? (
                <div style={{ padding: 16, borderRadius: 10, background: 'var(--color-background-success)', border: '1px solid var(--color-border-success)', marginBottom: 20, color: 'var(--color-text-success)', fontWeight: 600 }}>
                  ✓ Tutti i tavoli sono liberi. Puoi procedere con la chiusura.
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-background-warning)', border: '1px solid var(--color-border-warning)', marginBottom: 12, fontSize: 13, color: 'var(--color-text-warning)' }}>
                    ⚠️ {checkQ.data.open_tables.length} tavoli ancora aperti:
                  </div>
                  {checkQ.data.open_tables.map(t => (
                    <div key={t.id} style={{ padding: '6px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      • Tav {t.number} — {t.zone} ({t.status})
                    </div>
                  ))}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
                    Forza chiusura anche con tavoli aperti
                  </label>
                  {force && (
                    <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'var(--color-background-warning)', border: '1px solid var(--color-border-warning)', fontSize: 12, color: 'var(--color-text-warning)' }}>
                      I tavoli aperti verranno chiusi automaticamente e conteggiati nel report di oggi. Il numero comanda ripartirà da #0001 e tutti i print job (inclusi quelli falliti) verranno eliminati definitivamente.
                    </div>
                  )}
                </div>
              )}
              {checkQ.data.kds_in_preparazione_count > 0 && (
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-background-warning)', border: '1px solid var(--color-border-warning)', marginBottom: 20, fontSize: 13, color: 'var(--color-text-warning)' }}>
                  ⚠️ Ci sono {checkQ.data.kds_in_preparazione_count} comande ancora in preparazione o in attesa nei KDS:{' '}
                  {checkQ.data.kds_in_preparazione.map((k, i) => (
                    <span key={k.order_id}>
                      {i > 0 && ', '}Tav {k.table_number}{k.zone ? ` (${k.zone})` : ''}
                    </span>
                  ))}
                  . Procedendo con la chiusura verranno eliminate da tutti i monitor.
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => navigate('/admin')} style={{
                  padding: '9px 20px', borderRadius: 8, fontSize: 13,
                  border: '1px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)'
                }}>Torna alla dashboard</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!checkQ.data.can_close && !force}
                  style={{
                    padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'var(--color-primary)', color: '#fff', border: 'none',
                    opacity: (!checkQ.data.can_close && !force) ? 0.4 : 1
                  }}
                >Avanti →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: Anteprima */}
      {step === 2 && (
        <div>
          {reportQ.isLoading && <div style={{ color: 'var(--color-text-tertiary)', marginBottom: 20 }}>Caricamento report...</div>}

          {reportQ.isError && (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', marginBottom: 20, fontSize: 13 }}>
              Errore nel caricamento del report. Puoi procedere comunque.
            </div>
          )}

          {reportQ.data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Incasso totale',  value: `€ ${Number(reportQ.data.total ?? 0).toFixed(2)}` },
                { label: 'Tavoli serviti',  value: reportQ.data.orders_count ?? 0 },
                { label: 'Coperti',         value: reportQ.data.covers ?? 0 },
              ].map(s => (
                <div key={s.label} style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Bottoni sempre visibili nello step 2 */}
          {!reportQ.isLoading && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>← Indietro</button>
              <button onClick={() => setStep(3)} style={{ padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>Avanti →</button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Conferma */}
      {step === 3 && (
        <div>
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--color-background-warning)', border: '1px solid var(--color-border-warning)', marginBottom: 20, fontSize: 13, color: 'var(--color-text-warning)' }}>
            ⚠️ Sei sicuro? Gli ordini chiusi oggi verranno bloccati e non potranno essere modificati.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>← Indietro</button>
            <button onClick={() => closureMut.mutate()} disabled={closureMut.isPending} style={{ padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-text-danger)', color: '#fff', border: 'none', opacity: closureMut.isPending ? 0.7 : 1 }}>
              {closureMut.isPending ? 'Elaborazione...' : 'Conferma chiusura'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Successo */}
      {step === 4 && closure && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Chiusura completata</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Report generato con successo.</p>

          {/* Riepilogo chiusura forzata */}
          {force && checkQ.data?.open_tables?.length > 0 && (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-background-info)', border: '1px solid var(--color-border-secondary)', fontSize: 12, color: 'var(--color-text-info)', marginBottom: 20, textAlign: 'left' }}>
              ℹ️ {checkQ.data.open_tables.length} tavoli aperti sono stati chiusi automaticamente e conteggiati nel report di oggi.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => navigate('/admin')} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>Dashboard</button>
            {closure.report_url && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                style={{
                  padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary)', color: '#fff', border: 'none',
                  opacity: pdfLoading ? 0.7 : 1, cursor: pdfLoading ? 'default' : 'pointer'
                }}
              >
                {pdfLoading ? 'Download...' : 'Scarica PDF report'}
              </button>
            )}
            <button
              onClick={handlePrintThermal}
              disabled={printing}
              style={{
                padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-info)', color: 'var(--color-text-info)',
                opacity: printing ? 0.7 : 1, cursor: printing ? 'default' : 'pointer'
              }}
            >
              🖨 {printing ? 'Invio...' : 'Stampa chiusura'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
